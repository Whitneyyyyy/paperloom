import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname, basename, join } from 'node:path';
import { request as httpRequest } from 'node:http';
import { createPaperloomServer } from '../server/create-server.mjs';
import { containedPath } from '../server/storage.mjs';

async function temporary() {
  const dir = await mkdtemp(join(tmpdir(), 'paperloom-test-'));
  return {
    dir,
    async remove() {
      if (
        dirname(resolve(dir)) !== resolve(tmpdir()) ||
        !basename(dir).startsWith('paperloom-test-')
      )
        throw Error('Unsafe test cleanup path');
      await rm(dir, { recursive: true, force: true });
    },
  };
}
const record = {
  id: 'local-paper',
  title: 'Building facade crack segmentation',
  topics: [],
  tags: [],
  authors: [],
  collectionIds: [],
  note: 'A persistent test note',
  year: 2025,
  filename: 'test.pdf',
};
const write = (origin, path, method, value, extra = {}) =>
  fetch(origin + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...extra },
    body: JSON.stringify(value),
  });

test('standalone server persists metadata, PDF, identity and restore state across a restart', async () => {
  const temp = await temporary();
  let app;
  try {
    app = await createPaperloomServer({ dataDir: temp.dir, port: 0, crossref: false });
    let origin = await app.start();
    const identity = await (await fetch(origin + '/api/session')).json();
    assert.equal(identity.user.email, '');
    assert.equal((await fetch(origin + '/')).status, 200);
    assert.equal((await fetch(origin + '/vendor/pdf.mjs')).status, 200);
    assert.equal(
      (await write(origin, '/api/papers/local-paper', 'PUT', { paper: record, version: 0 })).status,
      200,
    );
    const pdf = new TextEncoder().encode('%PDF-1.4\nSynthetic test fixture\n%%EOF');
    assert.equal(
      (
        await fetch(origin + '/api/papers/local-paper/pdf', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/pdf' },
          body: pdf,
        })
      ).status,
      200,
    );
    await app.close();
    app = null;
    app = await createPaperloomServer({ dataDir: temp.dir, port: 0, crossref: false });
    origin = await app.start();
    assert.equal(
      (await (await fetch(origin + '/api/session')).json()).user.userId,
      identity.user.userId,
    );
    const library = await (await fetch(origin + '/api/library')).json();
    assert.equal(library.papers[0].note, record.note);
    assert.equal(library.papers[0].hasFile, true);
    assert.deepEqual(
      new Uint8Array(await (await fetch(origin + '/api/papers/local-paper/pdf')).arrayBuffer()),
      pdf,
    );
    assert.equal(
      (await write(origin, '/api/papers/local-paper', 'DELETE', { version: 1 })).status,
      200,
    );
    assert.equal((await fetch(origin + '/api/papers/local-paper/pdf')).status, 404);
    assert.equal(
      (await write(origin, '/api/papers/local-paper/restore', 'POST', { version: 2 })).status,
      200,
    );
    assert.equal((await fetch(origin + '/api/papers/local-paper/pdf')).status, 200);
  } finally {
    if (app) await app.close();
    await temp.remove();
  }
});

test('local server rejects cross-origin writes, hostile hosts, private paths and spoofed identities', async () => {
  const temp = await temporary();
  let app;
  try {
    app = await createPaperloomServer({ dataDir: temp.dir, port: 0, crossref: false });
    const origin = await app.start();
    assert.equal(app.server.address().address, '127.0.0.1');
    assert.equal(
      (
        await write(
          origin,
          '/api/papers/local-paper',
          'PUT',
          { paper: record, version: 0 },
          { Origin: 'https://untrusted.example' },
        )
      ).status,
      403,
    );
    for (const path of [
      '/.env',
      '/server/storage.mjs',
      '/data/paperloom.sqlite',
      '/%2eenv',
      '/vendor/%2e%2e/%2e%2e/package.json',
    ])
      assert.equal((await fetch(origin + path)).status, 404);
    const identity = await (
      await fetch(origin + '/api/session', {
        headers: { 'oai-authenticated-user-id': 'forged', 'x-forwarded-user': 'forged' },
      })
    ).json();
    assert.notEqual(identity.user.userId, 'forged');
    const hostile = await new Promise((resolve, reject) => {
      const req = httpRequest(origin, { headers: { Host: 'untrusted.example' } }, (res) => {
        res.resume();
        resolve(res.statusCode);
      });
      req.on('error', reject);
      req.end();
    });
    assert.equal(hostile, 403);
    assert.equal(
      (await fetch(origin + '/api/library')).headers.get('cache-control'),
      'private, no-store',
    );
    assert.throws(() => containedPath(temp.dir, '../outside.pdf'));
    assert.equal((await fetch(origin + '/health')).status, 200);
  } finally {
    if (app) await app.close();
    await temp.remove();
  }
});
