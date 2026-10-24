import { copyFileSync } from 'node:fs';
copyFileSync(
  new URL('../lib/analysis.mjs', import.meta.url),
  new URL('../public/analysis.js', import.meta.url),
);
copyFileSync(
  new URL('../lib/graph-model.mjs', import.meta.url),
  new URL('../public/graph-model.js', import.meta.url),
);
for (const name of [
  'categories',
  'annotations',
  'reading-state',
  'publication',
  'pdf-search',
  'translation',
])
  copyFileSync(
    new URL('../lib/' + name + '.mjs', import.meta.url),
    new URL('../public/' + name + '.mjs', import.meta.url),
  );
