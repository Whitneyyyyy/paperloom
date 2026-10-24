import test from 'node:test';
import assert from 'node:assert/strict';
import {
  graphMetrics,
  layoutGraph,
  fitCamera,
  zoomCamera,
  CATEGORY_COLORS,
} from '../lib/graph-model.mjs';
import { extractPublicationYear } from '../public/pdf-reader.js';
const papers = ['a', 'b', 'c', 'd'].map((id) => ({ id, topics: ['building-defects'] }));
test('node size uses summed relationship strength without counting duplicate neighbors', () => {
  const edges = [
    { source: 'a', target: 'b', type: 'topic', score: 0.9 },
    { source: 'a', target: 'c', type: 'topic', score: 0.7 },
    { source: 'a', target: 'b', type: 'author' },
  ];
  const m = graphMetrics(papers, edges);
  assert.ok(m.get('a').radius > m.get('b').radius);
  assert.ok(m.get('b').radius > m.get('d').radius);
  assert.equal(m.get('a').degree, 2);
  assert.equal(m.get('d').radius, 10);
});
test('layout retains unconnected papers separately without adding artificial edges', () => {
  const edges = [{ source: 'a', target: 'b', type: 'topic', score: 0.8 }];
  const layout = layoutGraph(papers, edges);
  assert.deepEqual(layout.isolates, ['c', 'd']);
  assert.equal(edges.length, 1);
  assert.equal(layout.positions.size, 4);
  assert.ok(layout.positions.get('c').x > layout.positions.get('a').x);
  for (const n of layout.positions.values())
    assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y));
});
test('zoom keeps the world point under the pointer stationary', () => {
  const camera = { scale: 0.8, x: 60, y: 40 },
    point = { x: 400, y: 300 };
  const next = zoomCamera(camera, 1.5, point);
  assert.ok(Math.abs((point.x - next.x) / next.scale - (point.x - camera.x) / camera.scale) < 1e-9);
  assert.ok(Math.abs((point.y - next.y) / next.scale - (point.y - camera.y) / camera.scale) < 1e-9);
  assert.equal(zoomCamera(camera, 100, point).scale, 4);
});
test('fit includes the graph in the visible canvas and category colors differ', () => {
  const b = { x: 100, y: 100, width: 700, height: 450 },
    c = fitCamera(b, 800, 650);
  assert.ok(b.x * c.scale + c.x >= 0);
  assert.ok((b.x + b.width) * c.scale + c.x <= 800);
  assert.notEqual(CATEGORY_COLORS.vision, CATEGORY_COLORS['building-defects']);
  assert.notEqual(CATEGORY_COLORS.agents, CATEGORY_COLORS.vision);
});
test('publication year uses publication context and excludes arbitrary reference or received years', () => {
  assert.equal(extractPublicationYear('Published online: 14 March 2024\nAbstract'), 2024);
  assert.equal(extractPublicationYear('Advanced Engineering Informatics 61 (2024) 102123'), 2024);
  assert.equal(extractPublicationYear('© 2023 Elsevier Ltd.'), 2023);
  assert.equal(
    extractPublicationYear('Received 10 March 2020\nModels for 2050\nReferences\nPublished 2019'),
    null,
  );
  assert.equal(extractPublicationYear('CreationDate: 2025'), null);
});
