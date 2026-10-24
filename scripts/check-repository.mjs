import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, relative, join, extname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const issues = [];
const excluded = new Set(['.git', 'node_modules', 'data', 'coverage']);
async function walk(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!excluded.has(entry.name)) result.push(...(await walk(join(directory, entry.name))));
    } else result.push(join(directory, entry.name));
  }
  return result;
}
const files = await walk(root);
const readable = new Set([
  '.js',
  '.mjs',
  '.json',
  '.md',
  '.html',
  '.css',
  '.svg',
  '.sql',
  '.yml',
  '.yaml',
  '.txt',
]);
const rules = [
  ['private email', /[\w.+-]+@(?:gmail|qq|163|outlook|hotmail)\.com\b/i],
  ['personal Windows path', /[A-Z]:\\Users\\[^\\\s]+/i],
  ['personal Unix path', /\/(?:Users|home)\/[a-zA-Z0-9_-]+\//],
  ['private hosted site', /[a-z0-9-]+\.[a-z0-9-]+\.chatgpt\.site\b/i],
  ['deployment identity', /appg(?:prj|ver|dep)_[a-f0-9]{20,}/i],
  [
    'credential-like value',
    /\b(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9]{30,}|AKIA[A-Z0-9]{16})\b/,
  ],
];
for (const file of files) {
  const name = relative(root, file).replaceAll('\\', '/');
  if (
    /(?:^|\/)(?:\.openai|\.wrangler|\.sites-runtime)(?:\/|$)/.test(name) ||
    /\.(?:pdf|sqlite|db|pem|key|p12|pfx|zip)$/.test(name) ||
    /(?:^|\/)\.env(?:$|\.(?!example$))/.test(name)
  )
    issues.push(name + ': runtime or private artifact');
  if (readable.has(extname(file)) || name === '.env.example') {
    const source = await readFile(file, 'utf8');
    for (const [label, pattern] of rules)
      if (pattern.test(source)) issues.push(name + ': ' + label);
    if (/\.(?:mjs|js)$/.test(name) && !name.startsWith('public/vendor/')) {
      const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
      if (result.status !== 0) issues.push(name + ': JavaScript syntax error');
    }
    if (name.endsWith('.md')) {
      for (const match of source.matchAll(/!?\[[^\]]*\]\(([^\s)]+)\)|(?:src|href)="([^"]+)"/g)) {
        const link = match[1] || match[2];
        if (/^(?:[a-z]+:|#|\/\/)/i.test(link)) continue;
        const target = resolve(file, '..', decodeURIComponent(link.split('#')[0]));
        try {
          await stat(target);
        } catch {
          issues.push(name + ': missing relative resource ' + link);
        }
      }
    }
  }
}
for (const [source, target] of [
  ['analysis.mjs', 'analysis.js'],
  ['graph-model.mjs', 'graph-model.js'],
  ...['categories', 'annotations', 'reading-state', 'publication', 'pdf-search', 'translation'].map(
    (n) => [n + '.mjs', n + '.mjs'],
  ),
]) {
  if (
    (await readFile(join(root, 'lib', source), 'utf8')).replaceAll('\r\n', '\n') !==
    (await readFile(join(root, 'public', target), 'utf8')).replaceAll('\r\n', '\n')
  )
    issues.push('Shared module out of date: ' + target + '; run npm run prepare:client');
}
for (const name of [
  'README.md',
  'README.en.md',
  'LICENSE',
  'THIRD_PARTY_NOTICES.md',
  '.gitignore',
  'docs/assets/hero.svg',
  'docs/assets/graph.jpg',
  'docs/assets/library.jpg',
  'docs/assets/reader.jpg',
])
  try {
    await stat(join(root, name));
  } catch {
    issues.push('Missing release file: ' + name);
  }
if (issues.length) {
  for (const issue of issues) console.error(issue);
  process.exitCode = 1;
} else
  console.log(
    `Checked ${files.length} repository files: syntax, privacy patterns, shared modules and documentation resources passed.`,
  );
