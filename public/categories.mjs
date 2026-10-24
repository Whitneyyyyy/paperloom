export const BROAD_CATEGORIES = [
  { id: 'engineering', name: '工程与建造', color: '#b46b49' },
  { id: 'computing', name: '计算机与人工智能', color: '#577eab' },
  { id: 'environment', name: '地球与环境', color: '#4e9087' },
  { id: 'cities', name: '城市与人类活动', color: '#b18b4f' },
  { id: 'life', name: '生命科学与医学', color: '#758d7b' },
  { id: 'society', name: '社会与经济', color: '#99739b' },
  { id: 'research', name: '科研方法与知识组织', color: '#8b8958' },
  { id: 'other', name: '其他研究', color: '#929292' },
];
const groups = {
  engineering: ['building-defects', 'civil', 'materials', 'energy', 'transport', 'robotics'],
  computing: ['vision', 'agents', 'learning', 'federated', 'nlp', 'optimization', 'software'],
  environment: ['remote', 'climate', 'water', 'ecology'],
  cities: ['heat', 'mobility', 'urban'],
  life: ['health', 'biology'],
  society: ['economics', 'social', 'education'],
  research: ['science'],
  other: ['other'],
};
const mapping = new Map(
  Object.entries(groups).flatMap(([id, topics]) => topics.map((topic) => [topic, id])),
);
export function categoryForPaper(paper) {
  return paper.categoryId || mapping.get(paper.topics?.[0]) || 'other';
}
export function matchesCategories(paper, selected) {
  return !selected.size || selected.has(categoryForPaper(paper));
}
export function assignBroadCategory(paper) {
  if (paper.categorySource === 'manual' && paper.categoryId) return paper;
  return {
    ...paper,
    categoryId: mapping.get(paper.topics?.[0]) || 'other',
    categorySource: 'automatic',
  };
}
export function libraryCategories(overrides = []) {
  return [...new Map([...BROAD_CATEGORIES, ...overrides].map((c) => [c.id, c])).values()];
}
export function mergeCategories(...lists) {
  const merged = new Map();
  for (const category of lists.flat()) {
    const current = merged.get(category.id);
    if (!current || String(category.updatedAt || '') >= String(current.updatedAt || ''))
      merged.set(category.id, category);
  }
  return [...merged.values()];
}
