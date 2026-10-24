import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePaper, buildRelations, ANALYSIS_VERSION } from '../lib/analysis.mjs';
import { extractFields, pageText } from '../public/pdf-reader.js';
const paper = (id, title, abstract = '', extra = {}) =>
  analyzePaper({ id, title, abstract, tags: [], authors: [], ...extra });
test('building inspection is classified without pre-existing keywords', () => {
  const p = paper(
    'a',
    'High resolution UAV images for façade defect assessment',
    'We quantify cracks and spalling using instance segmentation for building inspection.',
  );
  assert.equal(p.topics[0], 'building-defects');
  assert.ok(p.topics.includes('vision'));
  assert.ok(p.tags.includes('图像分割'));
  assert.ok(p.tags.includes('建筑外立面'));
  assert.equal(p.analysisVersion, ANALYSIS_VERSION);
});
test('Chinese titles and specialist model aliases classify directly', () => {
  const p = paper('a', '筑安智巡 FacadeFixer：外立面缺陷检测');
  assert.equal(p.topics[0], 'building-defects');
  const q = paper('b', 'Crack segmentation with a segment anything foundation model');
  assert.equal(q.topics[0], 'building-defects');
  assert.ok(q.concepts.includes('sam'));
});
test('a user-edited category is preserved', () => {
  const p = analyzePaper({
    id: 'a',
    title: 'Satellite observations of urban heat',
    tags: ['My keyword'],
    topics: ['science'],
    analysisSource: 'manual',
  });
  assert.deepEqual(p.topics, ['science']);
  assert.deepEqual(p.tags, ['My keyword']);
});
test('related engineering papers connect even with different author keywords', () => {
  const a = paper(
    'a',
    'Instance segmentation of concrete cracks',
    'High-resolution UAV inspection of building facades.',
    { tags: ['Pixel masks'] },
  );
  const b = paper(
    'b',
    'Domain knowledge for bridge damage description',
    'UAV imagery and concrete crack detection support bridge visual inspection.',
    { tags: ['Narrative reports'] },
  );
  const edges = buildRelations([a, b]);
  assert.ok(edges.some((e) => e.type === 'topic'));
  assert.match(edges[0].reason, /建筑与结构检测/);
  assert.equal(edges.filter((e) => e.type === 'citation').length, 0);
});
test('unrelated papers are not forced into a connected graph', () => {
  const a = paper('a', 'Façade crack detection using images');
  const b = paper('b', 'Genomic protein expression in cellular biology');
  assert.equal(buildRelations([a, b]).length, 0);
  assert.equal(buildRelations([a]).length, 0);
});
test('citation edges require a DOI in the references and exclude deleted nodes', () => {
  const a = paper('a', 'A study of bridge damage', '', { referenceDois: ['10.1234/example'] });
  const b = paper('b', 'Another bridge inspection study', '', { doi: '10.1234/example' });
  assert.ok(
    buildRelations([a, b]).some(
      (e) => e.type === 'citation' && e.source === 'a' && e.target === 'b',
    ),
  );
  assert.equal(buildRelations([a, { ...b, deletedAt: new Date().toISOString() }]).length, 0);
});
test('multiline PDF keywords are extracted as separate terms', () => {
  const fields = extractFields(
    'Keywords:\nBuilding inspection\nInstance segmentation\nUAV imaging\n\nAbstract\nThis study presents an automated framework for building facade defect assessment and measurement.\n1 Introduction\nMore text.',
  );
  assert.deepEqual(fields.tags, ['Building inspection', 'Instance segmentation', 'UAV imaging']);
  assert.match(fields.abstract, /automated framework/);
});

test('PDF layout gaps keep footer text out of keyword extraction', () => {
  const items = [
    ['Keywords:', 700],
    ['Building inspection; UAV', 680],
    ['Fictional footer text.', 80],
  ].map(([str, y]) => ({ str, height: 11, hasEOL: true, transform: [11, 0, 0, 11, 60, y] }));
  assert.deepEqual(extractFields(pageText(items)).tags, ['Building inspection', 'UAV']);
});

test('a broad category alone does not connect unrelated studies', () => {
  const a = paper(
    'a',
    'Flood runoff simulation in urban catchments',
    'Hydrological routing with rainfall observations',
  );
  const b = paper(
    'b',
    'Groundwater isotope chemistry',
    'Aquifer geochemistry and dissolved solute dating',
  );
  assert.equal(a.topics[0], b.topics[0]);
  assert.equal(buildRelations([a, b]).length, 0);
});
