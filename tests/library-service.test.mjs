import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { createLibraryHandler } from '../lib/library-service.mjs';

function fixture(
  publicationFetch = async () => {
    throw Error('No external network in tests');
  },
) {
  const sql = new DatabaseSync(':memory:');
  for (const name of readdirSync(new URL('../drizzle/', import.meta.url)).filter((n) =>
    n.endsWith('.sql'),
  ))
    sql.exec(readFileSync(new URL('../drizzle/' + name, import.meta.url), 'utf8'));
  const DB = {
    prepare(query) {
      return {
        bind(...values) {
          const statement = sql.prepare(query);
          return {
            async first() {
              return statement.get(...values) || null;
            },
            async all() {
              return { results: statement.all(...values) };
            },
            async run() {
              return { meta: { changes: Number(statement.run(...values).changes) } };
            },
          };
        },
      };
    },
  };
  const files = new Map();
  const BUCKET = {
    async put(key, value) {
      files.set(key, new Uint8Array(value));
    },
    async get(key) {
      return files.has(key) ? { body: files.get(key) } : null;
    },
  };
  const handler = createLibraryHandler(
    { DB, BUCKET },
    async (request) => {
      const id = request.headers.get('test-user');
      return id ? { userId: id, email: id + '@example.test', displayName: id } : null;
    },
    { publicationFetch },
  );
  async function request(user, path, method = 'GET', body, headers = {}) {
    return handler(
      new Request('https://paperloom.example' + path, {
        method,
        headers: {
          ...(user ? { 'test-user': user } : {}),
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        ...(body
          ? {
              body:
                typeof body === 'string' || body instanceof Uint8Array
                  ? body
                  : JSON.stringify(body),
            }
          : {}),
      }),
    );
  }
  const paper = {
    id: 'paper-one',
    title: 'Test paper',
    year: 2025,
    authors: ['Test Author'],
    topics: ['heat'],
    tags: ['Urban heat'],
    collectionIds: [],
    note: 'Initial note',
    status: 'unread',
    filename: 'test.pdf',
  };
  return { request, paper, files, close: () => sql.close() };
}
test('anonymous clients cannot read or modify a library', async () => {
  const f = fixture();
  try {
    assert.equal((await f.request(null, '/api/library')).status, 401);
    assert.equal(
      (await f.request(null, '/api/papers/paper-one', 'PUT', { paper: f.paper, version: 0 }))
        .status,
      401,
    );
  } finally {
    f.close();
  }
});

test('delete removes a paper from the library and restore retains PDF and notes', async () => {
  const f = fixture();
  try {
    await f.request('alice', '/api/papers/paper-one', 'PUT', { paper: f.paper, version: 0 });
    const pdf = new TextEncoder().encode('%PDF-1.4\nTest document\n%%EOF');
    await f.request('alice', '/api/papers/paper-one/pdf', 'PUT', pdf, {
      'Content-Type': 'application/pdf',
    });
    const deleted = await f.request('alice', '/api/papers/paper-one', 'DELETE', { version: 1 });
    assert.equal(deleted.status, 200);
    assert.equal((await deleted.json()).paper.cloudVersion, 2);
    const library = await (await f.request('alice', '/api/library')).json();
    assert.equal(library.papers.length, 0);
    assert.equal(library.trash.length, 1);
    assert.equal(library.trash[0].note, 'Initial note');
    assert.equal((await f.request('alice', '/api/papers/paper-one/pdf')).status, 404);
    assert.equal(
      (await f.request('alice', '/api/papers/paper-one', 'PUT', { paper: f.paper, version: 1 }))
        .status,
      410,
    );
    const restore = await f.request('alice', '/api/papers/paper-one/restore', 'POST', {
      version: 2,
    });
    assert.equal(restore.status, 200);
    assert.equal((await restore.json()).paper.deletedAt, null);
    const restored = await (await f.request('alice', '/api/library')).json();
    assert.equal(restored.papers.length, 1);
    assert.equal(restored.trash.length, 0);
    assert.deepEqual(
      new Uint8Array(await (await f.request('alice', '/api/papers/paper-one/pdf')).arrayBuffer()),
      pdf,
    );
  } finally {
    f.close();
  }
});
test('another account cannot delete or restore a user paper', async () => {
  const f = fixture();
  try {
    await f.request('alice', '/api/papers/paper-one', 'PUT', { paper: f.paper, version: 0 });
    assert.equal(
      (await f.request('bob', '/api/papers/paper-one', 'DELETE', { version: 1 })).status,
      404,
    );
    assert.equal(
      (await f.request('bob', '/api/papers/paper-one/restore', 'POST', { version: 1 })).status,
      404,
    );
    assert.equal((await (await f.request('alice', '/api/library')).json()).papers.length, 1);
  } finally {
    f.close();
  }
});
test('automatic classification is persisted for imports with no category', async () => {
  const f = fixture();
  try {
    const paper = {
      ...f.paper,
      title: 'Bridge crack segmentation and visual inspection',
      abstract: 'Automatic building defect detection from UAV imagery.',
      topics: [],
      tags: [],
    };
    const response = await f.request('alice', '/api/papers/paper-one', 'PUT', {
      paper,
      version: 0,
    });
    assert.equal(response.status, 200);
    const record = (await (await f.request('alice', '/api/library')).json()).papers[0];
    assert.equal(record.topics[0], 'building-defects');
    assert.ok(record.concepts.includes('cracks'));
    assert.ok(record.tags.length > 0);
  } finally {
    f.close();
  }
});
test('user ownership isolates records and PDF access', async () => {
  const f = fixture();
  try {
    assert.equal(
      (await f.request('alice', '/api/papers/paper-one', 'PUT', { paper: f.paper, version: 0 }))
        .status,
      200,
    );
    assert.equal((await (await f.request('bob', '/api/library')).json()).papers.length, 0);
    assert.equal((await f.request('bob', '/api/papers/paper-one/pdf')).status, 404);
    const update = await f.request('bob', '/api/papers/paper-one', 'PUT', {
      paper: { ...f.paper, note: 'attempt' },
      version: 1,
    });
    assert.equal(update.status, 409);
    assert.equal(
      (await (await f.request('alice', '/api/library')).json()).papers[0].note,
      'Initial note',
    );
  } finally {
    f.close();
  }
});
test('concurrent stale changes cannot overwrite the new version', async () => {
  const f = fixture();
  try {
    await f.request('alice', '/api/papers/paper-one', 'PUT', { paper: f.paper, version: 0 });
    const first = await f.request('alice', '/api/papers/paper-one', 'PUT', {
      paper: { ...f.paper, note: 'Device A' },
      version: 1,
    });
    assert.equal((await first.json()).version, 2);
    const second = await f.request('alice', '/api/papers/paper-one', 'PUT', {
      paper: { ...f.paper, note: 'Device B' },
      version: 1,
    });
    assert.equal(second.status, 409);
    assert.equal((await second.json()).current.note, 'Device A');
  } finally {
    f.close();
  }
});
test('an independent client can retrieve a saved PDF and notes', async () => {
  const f = fixture();
  try {
    await f.request('alice', '/api/papers/paper-one', 'PUT', { paper: f.paper, version: 0 });
    const pdf = new TextEncoder().encode('%PDF-1.4\nSynthetic test fixture\n%%EOF');
    assert.equal(
      (
        await f.request('alice', '/api/papers/paper-one/pdf', 'PUT', pdf, {
          'Content-Type': 'application/pdf',
        })
      ).status,
      200,
    );
    const library = await (await f.request('alice', '/api/library')).json();
    assert.equal(library.papers[0].hasFile, true);
    assert.equal(library.papers[0].note, 'Initial note');
    const downloaded = await f.request('alice', '/api/papers/paper-one/pdf');
    assert.equal(downloaded.headers.get('Content-Type'), 'application/pdf');
    assert.deepEqual(new Uint8Array(await downloaded.arrayBuffer()), pdf);
    assert.equal(f.files.size, 1);
    assert.ok([...f.files.keys()][0].startsWith('papers/'));
  } finally {
    f.close();
  }
});
test('invalid PDFs, oversize uploads and mismatched hashes are rejected', async () => {
  const f = fixture();
  try {
    await f.request('alice', '/api/papers/paper-one', 'PUT', {
      paper: { ...f.paper, hash: 'a'.repeat(64) },
      version: 0,
    });
    assert.equal(
      (
        await f.request('alice', '/api/papers/paper-one/pdf', 'PUT', 'not a PDF', {
          'Content-Type': 'application/pdf',
        })
      ).status,
      415,
    );
    assert.equal(
      (
        await f.request('alice', '/api/papers/paper-one/pdf', 'PUT', '%PDF-1.4', {
          'Content-Type': 'application/pdf',
          'Content-Length': String(31 * 1024 * 1024),
        })
      ).status,
      413,
    );
    assert.equal(
      (
        await f.request('alice', '/api/papers/paper-one/pdf', 'PUT', '%PDF-1.4', {
          'Content-Type': 'application/pdf',
        })
      ).status,
      422,
    );
    assert.equal(f.files.size, 0);
  } finally {
    f.close();
  }
});
test('cross-origin changes and invalid metadata are rejected', async () => {
  const f = fixture();
  try {
    assert.equal(
      (
        await f.request(
          'alice',
          '/api/papers/paper-one',
          'PUT',
          { paper: f.paper, version: 0 },
          { Origin: 'https://other.example' },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await f.request('alice', '/api/papers/paper-one', 'PUT', {
          paper: { ...f.paper, title: '' },
          version: 0,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await f.request('alice', '/api/papers/paper-one', 'PUT', {
          paper: { ...f.paper, note: 'x'.repeat(50001) },
          version: 0,
        })
      ).status,
      400,
    );
  } finally {
    f.close();
  }
});
test('collections and manual graph relations persist with version checks', async () => {
  const f = fixture();
  try {
    const settings = {
      collections: [{ id: 'collection-one', name: 'My project', color: '#52769a' }],
      customEdges: [
        {
          id: 'edge-one',
          source: 'paper-one',
          target: 'paper-two',
          type: 'manual',
          reason: 'Compare methods',
        },
      ],
    };
    assert.equal(
      (await f.request('alice', '/api/settings', 'PUT', { settings, version: 0 })).status,
      200,
    );
    assert.equal(
      (await f.request('alice', '/api/settings', 'PUT', { settings, version: 0 })).status,
      409,
    );
    const result = await (await f.request('alice', '/api/library')).json();
    assert.deepEqual(result.settings.collections, settings.collections);
    assert.equal(result.settings.customEdges[0].reason, 'Compare methods');
    assert.equal(
      (await (await f.request('bob', '/api/library')).json()).settings.collections.length,
      0,
    );
  } finally {
    f.close();
  }
});

test('category names, custom category membership and PDF highlights persist per account', async () => {
  const f = fixture();
  try {
    const annotation = {
      id: 'hl-one',
      page: 1,
      color: 'green',
      rects: [{ x: 0.12, y: 0.2, width: 0.35, height: 0.025 }],
      quote: 'A selected passage',
      note: 'A cross-device reading note',
      createdAt: '2026-10-24T00:00:00Z',
      updatedAt: '2026-10-24T00:00:00Z',
    };
    const paper = {
      ...f.paper,
      categoryId: 'cat-project',
      categorySource: 'manual',
      annotations: [annotation],
    };
    assert.equal(
      (await f.request('alice', '/api/papers/paper-one', 'PUT', { paper, version: 0 })).status,
      200,
    );
    const settings = {
      collections: [],
      customEdges: [],
      categories: [
        {
          id: 'cat-project',
          name: '我的工程论文',
          color: '#56789a',
          updatedAt: '2026-10-24T00:00:00Z',
        },
      ],
    };
    assert.equal(
      (await f.request('alice', '/api/settings', 'PUT', { settings, version: 0 })).status,
      200,
    );
    const library = await (await f.request('alice', '/api/library')).json();
    assert.equal(library.papers[0].categoryId, 'cat-project');
    assert.deepEqual(library.papers[0].annotations, [annotation]);
    assert.equal(library.settings.categories[0].name, '我的工程论文');
    const other = await (await f.request('bob', '/api/library')).json();
    assert.equal(other.papers.length, 0);
    assert.equal(other.settings.categories.length, 0);
    await f.request('alice', '/api/papers/paper-one', 'DELETE', { version: 1 });
    await f.request('alice', '/api/papers/paper-one/restore', 'POST', { version: 2 });
    const restored = await (await f.request('alice', '/api/library')).json();
    assert.deepEqual(restored.papers[0].annotations, [annotation]);
    const bad = {
      ...restored.papers[0],
      annotations: [{ ...annotation, rects: [{ x: -1, y: 0, width: 0.3, height: 0.2 }] }],
    };
    assert.equal(
      (await f.request('alice', '/api/papers/paper-one', 'PUT', { paper: bad, version: 3 })).status,
      400,
    );
  } finally {
    f.close();
  }
});

test('opening records and publication names survive retrieval and trash restoration', async () => {
  const f = fixture();
  try {
    const readingActivity = {
      openCount: 1,
      firstOpenedAt: '2026-10-24T12:00:00Z',
      lastOpenedAt: '2026-10-24T12:00:00Z',
    };
    const paper = {
      ...f.paper,
      note: '',
      journal: 'Example Journal',
      publisher: 'Example Press',
      readingActivity,
      publicationSource: 'Crossref DOI 出版记录',
      publicationCheckedVersion: 1,
    };
    assert.equal(
      (await f.request('alice', '/api/papers/paper-one', 'PUT', { paper, version: 0 })).status,
      200,
    );
    let saved = (await (await f.request('alice', '/api/library')).json()).papers[0];
    assert.equal(saved.status, 'reading');
    assert.deepEqual(saved.readingActivity, readingActivity);
    assert.equal(saved.publisher, 'Example Press');
    assert.equal(saved.journal, 'Example Journal');
    const annotated = { ...saved, note: 'A useful passage', status: 'unread' };
    assert.equal(
      (await f.request('alice', '/api/papers/paper-one', 'PUT', { paper: annotated, version: 1 }))
        .status,
      200,
    );
    saved = (await (await f.request('alice', '/api/library')).json()).papers[0];
    assert.equal(saved.status, 'annotated');
    await f.request('alice', '/api/papers/paper-one', 'DELETE', { version: 2 });
    await f.request('alice', '/api/papers/paper-one/restore', 'POST', { version: 3 });
    saved = (await (await f.request('alice', '/api/library')).json()).papers[0];
    assert.deepEqual(saved.readingActivity, readingActivity);
    assert.equal(saved.publisher, 'Example Press');
    const bad = { ...saved, readingActivity: { ...readingActivity, openCount: -1 } };
    assert.equal(
      (await f.request('alice', '/api/papers/paper-one', 'PUT', { paper: bad, version: 4 })).status,
      400,
    );
  } finally {
    f.close();
  }
});

test('publication lookup requires an account and a valid DOI', async () => {
  const f = fixture(async () =>
    Response.json({
      message: {
        DOI: '10.1234/example',
        'container-title': ['Example Journal'],
        publisher: 'Example Press',
      },
    }),
  );
  try {
    assert.equal(
      (await f.request(null, '/api/publication', 'POST', { doi: '10.1234/example' })).status,
      401,
    );
    assert.equal(
      (await f.request('alice', '/api/publication', 'POST', { doi: 'https://internal.test' }))
        .status,
      400,
    );
    const response = await f.request('alice', '/api/publication', 'POST', {
      doi: '10.1234/example',
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).journal, 'Example Journal');
  } finally {
    f.close();
  }
});

test('retired cloud translation never forwards text and tells stale clients to refresh', async () => {
  const f = fixture();
  try {
    assert.equal(
      (await f.request(null, '/api/translate', 'POST', { text: 'Urban heat.' })).status,
      401,
    );
    const response = await f.request('alice', '/api/translate', 'POST', {
      text: 'Urban heat.',
      target: 'zh-CN',
    });
    assert.equal(response.status, 410);
    assert.equal((await response.json()).code, 'TRANSLATION_MOVED_TO_DEVICE');
    assert.equal((await (await f.request('alice', '/api/library')).json()).papers.length, 0);
  } finally {
    f.close();
  }
});
