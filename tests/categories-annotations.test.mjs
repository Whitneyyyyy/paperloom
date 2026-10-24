import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePaper, buildRelations } from '../lib/analysis.mjs';
import {
  BROAD_CATEGORIES,
  categoryForPaper,
  libraryCategories,
  mergeCategories,
} from '../lib/categories.mjs';
import { validateAnnotations, normalizedRect, HIGHLIGHT_COLORS } from '../lib/annotations.mjs';
test('specialist topics map to a bounded set of broad categories', () => {
  const a = analyzePaper({ title: 'Facade crack segmentation', tags: [] }),
    b = analyzePaper({ title: 'Bridge damage inspection with UAV imagery', tags: [] }),
    c = analyzePaper({ title: 'Large language models for scientific research', tags: [] });
  assert.equal(categoryForPaper(a), 'engineering');
  assert.equal(categoryForPaper(b), 'engineering');
  assert.ok(BROAD_CATEGORIES.some((t) => t.id === categoryForPaper(c)));
  assert.equal(BROAD_CATEGORIES.length, 8);
  assert.equal(libraryCategories().length, 8);
});
test('manual paper membership and renamed categories survive automatic reanalysis', () => {
  const p = analyzePaper({
    title: 'Facade inspection',
    categoryId: 'cat-my-project',
    categorySource: 'manual',
    tags: [],
  });
  assert.equal(p.categoryId, 'cat-my-project');
  const categories = libraryCategories([
    { id: 'engineering', name: '我的工程文献', color: '#123456' },
  ]);
  assert.equal(categories.find((c) => c.id === 'engineering').name, '我的工程文献');
  assert.equal(categories.length, 8);
});
test('related papers still link across manually assigned broad categories', () => {
  const a = analyzePaper({
      id: 'a',
      title: 'UAV facade crack segmentation',
      tags: [],
      categoryId: 'engineering',
      categorySource: 'manual',
    }),
    b = analyzePaper({
      id: 'b',
      title: 'Deep vision models for UAV facade crack segmentation',
      tags: [],
      categoryId: 'computing',
      categorySource: 'manual',
    });
  assert.notEqual(a.categoryId, b.categoryId);
  assert.ok(buildRelations([a, b]).some((e) => e.type === 'topic'));
});
test('category name sync keeps the newer explicit edit', () => {
  const old = {
      id: 'engineering',
      name: 'Old',
      color: '#123456',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    fresh = { ...old, name: 'New', updatedAt: '2026-02-01T00:00:00.000Z' };
  assert.equal(mergeCategories([fresh], [old])[0].name, 'New');
});
test('highlights use normalized coordinates and retain their note and chosen color', () => {
  const rect = normalizedRect(
    { left: 150, top: 250, right: 250, bottom: 270 },
    { left: 100, top: 200, width: 500, height: 1000 },
  );
  for (const [key, expected] of Object.entries({ x: 0.1, y: 0.05, width: 0.2, height: 0.02 }))
    assert.ok(Math.abs(rect[key] - expected) < 1e-9);
  const a = {
    id: 'hl-one',
    page: 2,
    color: 'blue',
    rects: [rect],
    quote: 'Selected text',
    note: 'My reading note',
  };
  assert.equal(validateAnnotations([a])[0].note, 'My reading note');
  assert.equal(Object.keys(HIGHLIGHT_COLORS).length, 5);
  assert.throws(() =>
    validateAnnotations([{ ...a, rects: [{ x: 0, y: 0, width: 3, height: 0.1 }] }]),
  );
  assert.throws(() => validateAnnotations([{ ...a, color: 'javascript' }]));
  assert.throws(() => validateAnnotations([a, a]));
});
