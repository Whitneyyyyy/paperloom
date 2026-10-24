import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openStorage } from '../server/storage.mjs';
import { createLibraryHandler } from '../lib/library-service.mjs';
import { createPaperloomServer } from '../server/create-server.mjs';
import { demoPdf } from './demo-pdf.mjs';

const dataDir = resolve(process.env.PAPERLOOM_DATA_DIR || 'data/demo');
const storage = await openStorage(dataDir);
try {
  const handler = createLibraryHandler(storage, async () => storage.user);
  const request = (path, method, body, type = 'application/json') =>
    handler(
      new Request('http://localhost' + path, {
        method,
        headers: { 'Content-Type': type },
        body: type === 'application/json' ? JSON.stringify(body) : body,
      }),
    );
  const state = await (await handler(new Request('http://localhost/api/library'))).json();
  if (!state.papers.length && !state.trash.length) {
    const examples = JSON.parse(
      await readFile(new URL('../examples/demo-library.json', import.meta.url), 'utf8'),
    );
    const now = new Date().toISOString();
    for (let i = 0; i < examples.length; i++) {
      const record = {
        ...examples[i],
        authors: ['Demo Researcher ' + String.fromCharCode(65 + i)],
        journal: 'Synthetic demo document',
        year: 2026,
        categorySource: 'manual',
        topics: [],
        collectionIds: [],
        filename: examples[i].id + '.pdf',
        metadataSource: '合成演示文献，不代表真实发表论文',
        importedAt: new Date(Date.now() - i * 60000).toISOString(),
        publicationCheckedVersion: 1,
      };
      if (i === 0)
        record.annotations = [
          {
            id: 'demo-green',
            page: 1,
            color: 'green',
            quote: 'Image segmentation links visual evidence with building inspection.',
            note: '对照阅读时，把图像方法与具体工程问题一起看。',
            rects: [{ x: 52 / 612, y: (792 - 448 - 12) / 792, width: 365 / 612, height: 15 / 792 }],
            createdAt: now,
            updatedAt: now,
          },
          {
            id: 'demo-yellow',
            page: 1,
            color: 'yellow',
            quote: 'Additional observations help explain the limits of each method.',
            note: '',
            rects: [{ x: 52 / 612, y: (792 - 423 - 12) / 792, width: 338 / 612, height: 15 / 792 }],
            createdAt: now,
            updatedAt: now,
          },
        ];
      const response = await request('/api/papers/' + record.id, 'PUT', {
        paper: record,
        version: 0,
      });
      if (!response.ok) throw Error('Demo metadata could not be saved');
      const file = await request(
        '/api/papers/' + record.id + '/pdf',
        'PUT',
        demoPdf(record),
        'application/pdf',
      );
      if (!file.ok) throw Error('Demo PDF could not be saved');
    }
    await request('/api/settings', 'PUT', {
      version: 0,
      settings: {
        collections: [{ id: 'demo-review', name: '文献综述 · 演示', color: '#777777' }],
        customEdges: [],
        categories: [],
      },
    });
    console.log('Created 8 synthetic demo papers. No private papers were included.');
  } else if (
    !state.papers.every((p) => p.id.startsWith('demo-')) ||
    state.trash.some((p) => !p.id.startsWith('demo-'))
  ) {
    throw Error(
      'This directory contains a personal library. Demo setup did not change it. Use the default data/demo directory or a new empty directory.',
    );
  }
} finally {
  storage.close();
}
const app = await createPaperloomServer({
  dataDir,
  port: Number(process.env.PAPERLOOM_PORT || 3000),
  crossref: false,
});
try {
  console.log(
    `Paperloom demo: ${await app.start()}\nAll papers are synthetic. Press Ctrl+C to stop.`,
  );
} catch (error) {
  await app.close();
  throw error;
}
let closing = false;
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    if (closing) return;
    closing = true;
    try {
      await app.close();
    } finally {
      process.exit(0);
    }
  });
