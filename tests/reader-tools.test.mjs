import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPageSearchIndex, findPageMatches } from '../lib/pdf-search.mjs';

test('PDF search finds words across lines and maps to the original text div offsets', () => {
  const index = buildPageSearchIndex([
    { str: 'Urban heat', hasEOL: true },
    { str: 'exposure and mobility.' },
  ]);
  assert.deepEqual(findPageMatches(index, 'HEAT exposure'), [
    { start: { item: 0, offset: 6 }, end: { item: 1, offset: 8 } },
  ]);
  assert.equal(findPageMatches(index, 'not present').length, 0);
});
test('PDF search handles line-end hyphens, ligatures and Chinese text fragments', () => {
  const hyphen = buildPageSearchIndex([{ str: 'segmen-', hasEOL: true }, { str: 'tation' }]);
  assert.equal(findPageMatches(hyphen, 'segmentation').length, 1);
  const ligature = buildPageSearchIndex([{ str: 'ﬁeld observations' }]);
  assert.deepEqual(findPageMatches(ligature, 'field')[0], {
    start: { item: 0, offset: 0 },
    end: { item: 0, offset: 4 },
  });
  const chinese = buildPageSearchIndex([{ str: '城市' }, { str: '热环境' }]);
  assert.equal(findPageMatches(chinese, '城市热环境').length, 1);
  const repeated = buildPageSearchIndex([{ str: 'Heat heat heat' }]);
  assert.equal(findPageMatches(repeated, 'heat', 2).length, 2);
  assert.equal(findPageMatches(repeated, '').length, 0);
});
