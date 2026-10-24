import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readingStatus,
  recordPaperOpened,
  validateReadingActivity,
} from '../lib/reading-state.mjs';
import { matchesCategories } from '../lib/categories.mjs';
import { extractPublication, lookupPublication } from '../lib/publication.mjs';

test('category selection is a union and an empty selection shows every category', () => {
  const papers = [
    { categoryId: 'engineering' },
    { categoryId: 'computing' },
    { categoryId: 'cities' },
  ];
  assert.equal(papers.filter((p) => matchesCategories(p, new Set())).length, 3);
  assert.deepEqual(
    papers.filter((p) => matchesCategories(p, new Set(['engineering', 'cities']))),
    [papers[0], papers[2]],
  );
  assert.equal(papers.filter((p) => matchesCategories(p, new Set(['computing']))).length, 1);
});

test('opening and notes determine status without assuming that opening means finishing', () => {
  const paper = { status: 'unread', note: '', annotations: [] };
  assert.equal(readingStatus(paper), 'unread');
  recordPaperOpened(paper, '2026-10-24T10:00:00Z');
  assert.equal(readingStatus(paper), 'reading');
  assert.equal(paper.readingActivity.openCount, 1);
  recordPaperOpened(paper, '2026-10-24T11:00:00Z');
  assert.equal(paper.readingActivity.firstOpenedAt, '2026-10-24T10:00:00Z');
  assert.equal(paper.readingActivity.lastOpenedAt, '2026-10-24T11:00:00Z');
  assert.equal(paper.readingActivity.openCount, 2);
  paper.note = 'A useful finding';
  assert.equal(readingStatus(paper), 'annotated');
  paper.note = '';
  paper.annotations = [{ id: 'hl-one' }];
  assert.equal(readingStatus(paper), 'annotated');
  paper.annotations = [];
  assert.equal(readingStatus(paper), 'reading');
  assert.equal(readingStatus({ status: 'read' }), 'reading');
  assert.equal(readingStatus({ note: 'Old library note' }), 'annotated');
});

test('reading records reject invalid counts and reversed dates', () => {
  assert.equal(validateReadingActivity(undefined), null);
  assert.throws(() => validateReadingActivity({ openCount: -1 }));
  assert.throws(() =>
    validateReadingActivity({
      openCount: 1,
      firstOpenedAt: '2026-10-25',
      lastOpenedAt: '2026-10-24',
    }),
  );
  assert.deepEqual(
    validateReadingActivity({
      openCount: 2,
      firstOpenedAt: '2026-10-24T10:00:00Z',
      lastOpenedAt: '2026-10-24T11:00:00Z',
    }),
    { openCount: 2, firstOpenedAt: '2026-10-24T10:00:00Z', lastOpenedAt: '2026-10-24T11:00:00Z' },
  );
});

test('publication extraction uses front matter and ignores references and ordinary prose', () => {
  assert.equal(
    extractPublication(
      'Automation in Construction 163 (2024) 105332\nArticle title\nAbstract\nA study',
    ).journal,
    'Automation in Construction',
  );
  assert.equal(
    extractPublication(
      'Contents lists available at ScienceDirect\nUrban Climate\njournal homepage: example.test',
    ).journal,
    'Urban Climate',
  );
  assert.equal(
    extractPublication('期刊名称：遥感学报\n出版社：中国科学出版社').publisher,
    '中国科学出版社',
  );
  assert.equal(
    extractPublication('© 2024 Elsevier Ltd. All rights reserved.').publisher,
    'Elsevier Ltd.',
  );
  assert.equal(
    extractPublication(
      'This study considers a journal ranking method.\nReferences\nNature 500 (2024) 100',
    ).journal,
    '',
  );
});

test('DOI lookup returns only the matching work and never guesses from its title', async () => {
  const result = await lookupPublication(
    'https://doi.org/10.1234/example',
    async (url, options) => {
      assert.equal(options.redirect, 'manual');
      assert.equal(url, 'https://api.crossref.org/works/10.1234%2Fexample');
      return Response.json({
        message: {
          DOI: '10.1234/example',
          'container-title': ['Example Journal'],
          publisher: 'Example Press',
        },
      });
    },
  );
  assert.equal(result.journal, 'Example Journal');
  assert.equal(result.publisher, 'Example Press');
  const mismatch = await lookupPublication('10.1234/example', async () =>
    Response.json({ message: { DOI: '10.1234/other', 'container-title': ['Wrong Journal'] } }),
  );
  assert.equal(mismatch.status, 'missing');
  assert.equal(mismatch.journal, '');
  const unavailable = await lookupPublication('10.1234/example', async () => {
    throw Error('network unavailable');
  });
  assert.equal(unavailable.status, 'unavailable');
  assert.equal(
    (
      await lookupPublication('not-a-doi', () => {
        throw Error('must not fetch');
      })
    ).status,
    'missing',
  );
});
