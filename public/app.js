import { CloudLibrary, readLegacyLibrary } from './cloud.js?v=9.0';
import {
  CATEGORIES,
  ANALYSIS_VERSION,
  analyzePaper,
  buildRelations,
  normalizeText,
} from './analysis.js?v=9.0';
import { readPaperPdf } from './pdf-reader.js?v=9.0';
import { ImportTasks } from './import-tasks.js?v=9.0';
import { PaperGraph } from './graph.js?v=9.0';
import {
  libraryCategories,
  categoryForPaper,
  mergeCategories,
  matchesCategories,
} from './categories.mjs?v=9.0';
import { PdfReader } from './reader.js?v=9.0';
import { readingStatus, recordPaperOpened } from './reading-state.mjs?v=9.0';
import { extractPublication, PUBLICATION_VERSION } from './publication.mjs?v=9.0';
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
let categoryOverrides = [];
let topics = libraryCategories();
const demoPapers = [
  {
    id: 'p1',
    title: 'Urban heat exposure in a changing climate',
    authors: ['Maya Chen', 'Daniel Wu', 'Elena Park'],
    affiliation: 'Institute for Urban Climate Studies · 示例研究机构',
    journal: 'Urban Climate Research · 示例期刊',
    year: 2025,
    topics: ['heat', 'climate'],
    tags: ['Urban heat', 'Climate adaptation', 'Heat exposure'],
    abstract:
      'Cities face growing challenges from extreme heat, yet exposure is unevenly distributed across neighborhoods. This illustrative study brings together high-resolution temperature observations and population activity patterns to examine when and where heat exposure occurs. The findings suggest that combining environmental conditions with everyday mobility can reveal opportunities for more equitable urban cooling.',
    starred: true,
    status: 'reading',
    note: '关注将动态人口暴露与城市降温结合的思路。下一步：比较静态居住人口与活动人口两种暴露评估方式。',
    x: 442,
    y: 326,
  },
  {
    id: 'p2',
    title: 'Green infrastructure and neighborhood cooling',
    authors: ['Elena Park', 'Lucas Rivera'],
    affiliation: 'Center for Sustainable Cities · 示例研究机构',
    journal: 'Landscape & Urban Systems · 示例期刊',
    year: 2024,
    topics: ['heat'],
    tags: ['Urban cooling', 'Green infrastructure', 'Equity'],
    abstract:
      'This demonstration paper examines how the spatial arrangement of urban vegetation may influence neighborhood cooling. It illustrates a framework for comparing tree cover, built form, and local thermal conditions across residential areas.',
    starred: true,
    status: 'read',
    note: '可作为绿色基础设施与热环境研究的示例分支。',
    x: 206,
    y: 222,
  },
  {
    id: 'p3',
    title: 'Mapping land surface temperature from space',
    authors: ['Daniel Wu', 'Sofia Patel'],
    affiliation: 'Earth Observation Laboratory · 示例研究机构',
    journal: 'Remote Sensing Frontiers · 示例期刊',
    year: 2023,
    topics: ['remote', 'heat'],
    tags: ['Land surface temperature', 'Satellite imagery', 'Urban heat'],
    abstract:
      'A demonstration of using multi-temporal satellite observations to describe spatial patterns of land surface temperature. The example connects remote sensing measurements with the interpretation of urban thermal environments.',
    starred: false,
    status: 'read',
    note: '',
    x: 687,
    y: 213,
  },
  {
    id: 'p4',
    title: 'Daily mobility reshapes personal heat exposure',
    authors: ['Maya Chen', 'Noah Smith'],
    affiliation: 'Human Mobility & Cities Lab · 示例研究机构',
    journal: 'Cities & Society Review · 示例期刊',
    year: 2025,
    topics: ['mobility', 'heat'],
    tags: ['Human mobility', 'Heat exposure', 'Dynamic population'],
    abstract:
      'Daily movement changes the places and times at which people encounter heat. This example paper outlines a mobility-aware approach to exposure assessment and demonstrates how trip timing and destination choice can change estimates of individual risk.',
    starred: true,
    status: 'reading',
    note: '值得在图谱中与 p1 一起查看：都讨论暴露，但这里强调移动过程。',
    x: 325,
    y: 470,
  },
  {
    id: 'p5',
    title: 'Compound heat and dust events in growing cities',
    authors: ['Amir Hassan', 'Maya Chen'],
    affiliation: 'Climate & Environment Institute · 示例研究机构',
    journal: 'Environmental Change Letters · 示例期刊',
    year: 2026,
    topics: ['climate', 'heat'],
    tags: ['Compound events', 'Dust', 'Heat exposure'],
    abstract:
      'An illustrative investigation of coincident heat and dust conditions in expanding urban regions. It connects event identification, exposure patterns, and adaptation planning to show how multiple environmental pressures can be studied together.',
    starred: false,
    status: 'reading',
    note: '',
    x: 605,
    y: 439,
  },
  {
    id: 'p6',
    title: 'Unequal access to cooling resources',
    authors: ['Lucas Rivera', 'Hana Kim'],
    affiliation: 'Urban Equity Research Group · 示例研究机构',
    journal: 'Sustainable Cities Perspectives · 示例期刊',
    year: 2024,
    topics: ['heat', 'climate'],
    tags: ['Cooling access', 'Equity', 'Climate adaptation'],
    abstract:
      'This example explores differences in access to shaded public spaces and indoor cooling. It illustrates the connection between neighborhood resources, socioeconomic conditions, and opportunities to reduce heat exposure.',
    starred: false,
    status: 'unread',
    note: '',
    x: 141,
    y: 371,
  },
  {
    id: 'p7',
    title: 'Reading cities through satellite time series',
    authors: ['Sofia Patel', 'Oliver Lee'],
    affiliation: 'Earth Observation Laboratory · 示例研究机构',
    journal: 'Remote Sensing Frontiers · 示例期刊',
    year: 2025,
    topics: ['remote'],
    tags: ['Satellite imagery', 'Time series', 'Urban change'],
    abstract:
      'A sample paper about using satellite time series to identify urban change. The record is included to demonstrate a remote sensing topic cluster and its connections to thermal environment research.',
    starred: false,
    status: 'unread',
    note: '',
    x: 837,
    y: 332,
  },
  {
    id: 'p8',
    title: 'Urban form and local thermal comfort',
    authors: ['Hana Kim', 'Elena Park'],
    affiliation: 'Center for Sustainable Cities · 示例研究机构',
    journal: 'Built Environment Science · 示例期刊',
    year: 2023,
    topics: ['heat'],
    tags: ['Thermal comfort', 'Urban form', 'Urban cooling'],
    abstract:
      'An example of studying the relationship between built form and outdoor thermal comfort. The demonstration connects building density, street geometry, shading, and environmental observations.',
    starred: false,
    status: 'read',
    note: '',
    x: 396,
    y: 168,
  },
  {
    id: 'p9',
    title: 'Climate extremes and population health',
    authors: ['Amir Hassan', 'Isabel Torres'],
    affiliation: 'Population Health & Climate Center · 示例研究机构',
    journal: 'Climate & Health Studies · 示例期刊',
    year: 2024,
    topics: ['climate'],
    tags: ['Climate extremes', 'Population health', 'Vulnerability'],
    abstract:
      'This illustrative review organizes potential pathways connecting climate extremes and population health. It highlights exposure, vulnerability, and adaptation as complementary components of a research framework.',
    starred: true,
    status: 'reading',
    note: '',
    x: 760,
    y: 537,
  },
  {
    id: 'p10',
    title: 'Activity spaces beyond the residential neighborhood',
    authors: ['Noah Smith', 'Yuki Tanaka'],
    affiliation: 'Human Mobility & Cities Lab · 示例研究机构',
    journal: 'Human Geography Review · 示例期刊',
    year: 2022,
    topics: ['mobility'],
    tags: ['Activity space', 'Human mobility', 'Dynamic population'],
    abstract:
      'A demonstration record describing how activity spaces extend beyond residential neighborhoods. The example supports exploration of links between movement, access to resources, and environmental exposure.',
    starred: false,
    status: 'read',
    note: '',
    x: 168,
    y: 562,
  },
  {
    id: 'p11',
    title: 'Detecting urban vegetation at fine scales',
    authors: ['Oliver Lee', 'Lucas Rivera'],
    affiliation: 'Geospatial Analytics Center · 示例研究机构',
    journal: 'Geospatial Methods · 示例期刊',
    year: 2024,
    topics: ['remote', 'heat'],
    tags: ['Green infrastructure', 'Satellite imagery', 'Urban cooling'],
    abstract:
      'This sample demonstrates a connection between fine-scale vegetation mapping and urban cooling research. It is an illustrative record rather than a published research finding.',
    starred: false,
    status: 'unread',
    note: '',
    x: 861,
    y: 170,
  },
  {
    id: 'p12',
    title: 'Adaptation pathways for heat-resilient cities',
    authors: ['Isabel Torres', 'Daniel Wu'],
    affiliation: 'Institute for Urban Climate Studies · 示例研究机构',
    journal: 'Urban Futures Journal · 示例期刊',
    year: 2026,
    topics: ['climate', 'heat'],
    tags: ['Climate adaptation', 'Resilience', 'Urban heat'],
    abstract:
      'An example paper organizing city-scale adaptation pathways for extreme heat. The record illustrates how a planning-oriented paper can connect to exposure measurement and environmental monitoring.',
    starred: false,
    status: 'unread',
    note: '',
    x: 554,
    y: 589,
  },
  {
    id: 'p13',
    title: 'How weather influences everyday travel',
    authors: ['Yuki Tanaka', 'Noah Smith'],
    affiliation: 'Human Mobility & Cities Lab · 示例研究机构',
    journal: 'Mobility & Environment · 示例期刊',
    year: 2023,
    topics: ['mobility', 'climate'],
    tags: ['Human mobility', 'Weather', 'Adaptation'],
    abstract:
      'A demonstration of a travel behavior study that examines the role of weather in everyday movement. It provides a bridge between the human activity cluster and climate adaptation research.',
    starred: false,
    status: 'unread',
    note: '',
    x: 355,
    y: 605,
  },
  {
    id: 'p14',
    title: 'Fusing observations for urban climate research',
    authors: ['Sofia Patel', 'Daniel Wu'],
    affiliation: 'Geospatial Analytics Center · 示例研究机构',
    journal: 'Environmental Data Science · 示例期刊',
    year: 2025,
    topics: ['remote', 'climate'],
    tags: ['Data fusion', 'Satellite imagery', 'Urban heat'],
    abstract:
      'This illustrative methods paper combines environmental observations across scales. It shows how data-focused work can connect remote sensing, urban heat assessment, and research on environmental exposure.',
    starred: false,
    status: 'reading',
    note: '',
    x: 600,
    y: 133,
  },
].map((p) => ({
  ...p,
  demo: true,
  doi: '',
  filename: '',
  collectionIds: [],
  metadataSource: '演示数据',
  reviewed: true,
}));
const demoEdges = [
  ['p1', 'p2', 'topic', '共同关注城市降温与热暴露'],
  ['p1', 'p3', 'citation', '示例：p1 引用了 p3，演示有向引用连线'],
  ['p1', 'p4', 'author', '共同作者：Maya Chen'],
  ['p1', 'p5', 'topic', '共同标签：Heat exposure'],
  ['p1', 'p6', 'topic', '共同标签：Climate adaptation'],
  ['p1', 'p8', 'topic', '共同研究主题：城市热环境'],
  ['p1', 'p12', 'topic', '共同标签：Urban heat、Climate adaptation'],
  ['p1', 'p14', 'author', '共同作者：Daniel Wu'],
  ['p2', 'p6', 'topic', '共同讨论城市资源与环境公平'],
  ['p2', 'p8', 'author', '共同作者：Elena Park'],
  ['p2', 'p11', 'topic', '共同标签：Green infrastructure、Urban cooling'],
  ['p3', 'p7', 'author', '共同作者：Sofia Patel'],
  ['p3', 'p14', 'topic', '共同标签：Satellite imagery、Urban heat'],
  ['p7', 'p11', 'topic', '共同标签：Satellite imagery'],
  ['p7', 'p14', 'citation', '示例：p7 引用了 p14，演示有向引用连线'],
  ['p4', 'p10', 'topic', '共同标签：Human mobility、Dynamic population'],
  ['p4', 'p13', 'author', '共同作者：Noah Smith'],
  ['p5', 'p9', 'topic', '共同研究主题：气候与健康'],
  ['p9', 'p12', 'author', '共同作者：Isabel Torres'],
  ['p10', 'p13', 'topic', '共同标签：Human mobility'],
  ['p8', 'p12', 'manual', '示例笔记：将城市形态与适应策略对照阅读'],
].map((e, i) => ({
  id: 'de' + i,
  source: e[0],
  target: e[1],
  type: e[2],
  reason: e[3],
  demo: true,
}));
let papers = [],
  trash = [],
  customEdges = [],
  collections = [],
  db;
let state = {
  nav: 'all',
  collection: '',
  query: '',
  categories: new Set(),
  year: '',
  view: 'list',
  selected: '',
  tab: 'related',
  zoom: 1,
  pan: { x: 0, y: 0 },
  edgeTypes: new Set(['topic', 'citation', 'author', 'manual']),
};
let previewURL = '',
  toastTimer,
  saveTimer,
  enrichingPublications = false;
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('#toast').hidden = true), 4300);
}
function openModal(html, wide = false) {
  $('#modal').classList.toggle('preview-dialog', wide);
  $('#modal-content').innerHTML = html;
  if (!$('#modal').open) $('#modal').showModal();
  $$('[data-close]').forEach((b) => (b.onclick = () => $('#modal').close()));
}
function modalHeader(title) {
  return `<div class="modal-header"><h2>${esc(title)}</h2><button type="button" data-close aria-label="关闭">${icon('close')}</button></div>`;
}
function topicColor(p) {
  return topics.find((c) => c.id === categoryForPaper(p))?.color || '#929292';
}
function topicName(id) {
  return topics.find((t) => t.id === id)?.name || id;
}
function getPaper(id) {
  return [...papers, ...trash].find((p) => p.id === id);
}
function statusName(s) {
  return { unread: '待读', reading: '已打开', annotated: '已做笔记' }[s] || '待读';
}
function visiblePapers() {
  const q = state.query.toLowerCase();
  const source = state.nav === 'trash' ? trash : papers;
  return source.filter(
    (p) =>
      (state.nav !== 'starred' || p.starred) &&
      (state.nav !== 'reading' || p.status === 'reading') &&
      (state.nav !== 'notes' || p.note?.trim() || p.annotations?.length) &&
      (!state.collection || p.collectionIds?.includes(state.collection)) &&
      matchesCategories(p, state.categories) &&
      (!state.year || String(p.year) === state.year) &&
      (!q ||
        [
          p.title,
          ...(p.authors || []),
          p.journal,
          p.publisher,
          p.affiliation,
          ...(p.tags || []),
          p.abstract,
          p.doi,
        ]
          .join(' ')
          .toLowerCase()
          .includes(q)),
  );
}
let relationCache = { key: '', edges: [] };
function allEdges() {
  const key = JSON.stringify([
    papers.map((p) => [
      p.id,
      p.title,
      p.abstract,
      p.tags,
      p.topics,
      p.concepts,
      p.authors,
      p.doi,
      p.referenceDois,
    ]),
    customEdges,
  ]);
  if (key !== relationCache.key)
    relationCache = { key, edges: buildRelations(papers, [...demoEdges, ...customEdges]) };
  return relationCache.edges;
}
function visibleEdges(vp = visiblePapers()) {
  const ids = new Set(vp.map((p) => p.id));
  return allEdges().filter(
    (e) => ids.has(e.source) && ids.has(e.target) && state.edgeTypes.has(e.type),
  );
}
let cloudStatus = {},
  legacyLibrary = null,
  autoClassifying = false;
const sourceFiles = new Map();
const transfers = new ImportTasks({ onRetry: retryTransfer });
function applySnapshot(snapshot) {
  papers = snapshot.papers || [];
  trash = snapshot.trash || [];
  collections = snapshot.settings.collections;
  customEdges = snapshot.settings.customEdges;
  categoryOverrides = snapshot.settings.categories || [];
  topics = libraryCategories(categoryOverrides);
  if (!getPaper(state.selected))
    state.selected = (state.nav === 'trash' ? trash : papers)[0]?.id || '';
}
const cloud = new CloudLibrary({
  onStatus: updateCloudStatus,
  onTransfer: (event) => transfers.transfer(event),
  onRefresh: (snapshot) => {
    if (
      reader.isOpen ||
      $('#modal').open ||
      $('#category-filter-menu').open ||
      document.activeElement?.id === 'note-input' ||
      paperGraph.isInteracting ||
      importing ||
      autoClassifying ||
      enrichingPublications
    )
      return;
    applySnapshot(snapshot);
    render();
    transfers.reconcile(papers);
    analyzeExisting().then(enrichExistingPublications);
  },
});
async function dbGet(store, key) {
  if (store === 'files') return cloud.getFile(key);
  throw new Error('不支持的缓存读取');
}
async function dbPut(store, value, key) {
  if (store === 'files') return cloud.cacheFile(key, value);
  if (store === 'papers') return persistPaper(value);
  throw new Error('不支持的缓存写入');
}
async function persistPaper(p) {
  p.status = readingStatus(p);
  const result = await cloud.savePaper(p);
  if (state.selected === p.id) {
    const label = $('#detail-panel .automatic-reading-state');
    if (label) {
      label.textContent = statusName(readingStatus(p));
      label.className = 'automatic-reading-state ' + readingStatus(p);
    }
  }
  if (result.conflict) toast('其他窗口有更新。本机修改已保留，请点击同步状态处理。');
  return result;
}
async function persistSettings() {
  const merged = await cloud.saveSettings({
    collections,
    customEdges,
    categories: categoryOverrides,
  });
  collections = merged.collections;
  customEdges = merged.customEdges;
  categoryOverrides = merged.categories || [];
  topics = libraryCategories(categoryOverrides);
}
function updateCloudStatus(status) {
  cloudStatus = status;
  const label = $('#sync-label');
  const isLocal = status.localPreview;
  label.textContent = status.conflicts
    ? '有修改冲突'
    : status.inflight
      ? '正在保存…'
      : status.pending
        ? `${status.pending} 项待同步`
        : status.online
          ? '已保存到本机'
          : '连接已断开';
  $('#sync-status').className =
    'sync-status ' +
    (status.conflicts ? 'conflict' : status.pending || !status.online ? 'pending' : '');
  $('#account-name').textContent = status.user?.displayName || '本机论文库';
  $('#account-email').textContent = status.user?.email || '';
  $('#menu-account-email').textContent = '单人 · 本机保存';
  $('#local-preview-notice').hidden = !isLocal;
}
async function init() {
  try {
    const snapshot = await cloud.start();
    db = cloud.db;
    transfers.bind(cloud.user);
    applySnapshot(snapshot);
    legacyLibrary = await readLegacyLibrary();
    if (legacyLibrary) {
      const existing = new Set(papers.map((p) => p.hash || p.id));
      legacyLibrary.papers = legacyLibrary.papers.filter((p) => !existing.has(p.hash || p.id));
    }
    state.selected = papers[0]?.id || '';
    render();
    renderMigration();
    transfers.reconcile(papers);
    analyzeExisting().then(enrichExistingPublications);
  } catch (error) {
    render();
    $('#access-notice').hidden = false;
    $('#access-message').textContent = error.message || '无法连接论文库，请启动服务后重试。';
    $('#signin-link').hidden = error.status !== 401;
    $('#import').disabled = true;
    $('#export').disabled = true;
    $('#add-collection').disabled = true;
    $$('[data-empty-import]').forEach((b) => (b.disabled = true));
    updateCloudStatus({ online: false, pending: 0, user: null });
  }
}
async function analyzeExisting() {
  if (autoClassifying) return;
  const pending = papers.filter((p) => !p.demo && (p.analysisVersion || 0) < ANALYSIS_VERSION);
  if (!pending.length) return;
  autoClassifying = true;
  $('#analysis-notice').hidden = false;
  try {
    for (let i = 0; i < pending.length; i++) {
      const p = pending[i];
      $('#analysis-message').textContent =
        `正在自动整理已有论文 ${i + 1}/${pending.length}：${p.title}`;
      if (p.hasFile && (!p.year || (!p.abstract && !p.textExcerpt))) {
        try {
          const file = await cloud.getFile(p.id);
          const parsed = await readPaperPdf(await file.arrayBuffer(), p.filename || 'paper.pdf');
          p.year = p.year || parsed.year;
          p.abstract = p.abstract || parsed.abstract;
          p.textExcerpt = parsed.textExcerpt;
          p.referenceDois = parsed.referenceDois;
          if (!p.authors?.length) p.authors = parsed.authors;
          p.tags = [...new Set([...(p.tags || []), ...parsed.tags])];
        } catch {}
      }
      Object.assign(p, analyzePaper(p));
      render();
      await persistPaper(p);
    }
  } catch (error) {
    toast('自动整理已保留在本机，稍后重试同步：' + error.message);
  } finally {
    autoClassifying = false;
    $('#analysis-notice').hidden = true;
    render();
  }
}
function renderMigration() {
  const banner = $('#migration-banner');
  const count = legacyLibrary?.papers?.length || 0;
  banner.hidden = !count;
  $('#migration-message').textContent = `此浏览器有 ${count} 篇旧版论文尚未迁移到本机服务。`;
}
function render() {
  const visible = visiblePapers();
  if (!visible.some((p) => p.id === state.selected)) state.selected = visible[0]?.id || '';
  renderSummary();
  renderFilters();
  renderCollections();
  renderList();
  renderGraph();
  renderDetail();
}
function renderSummary() {
  const count = visiblePapers().length,
    source = state.nav === 'trash' ? trash : papers;
  $('#nav-count').textContent = papers.length;
  $('#trash-count').textContent = trash.length;
  $('#note-count').textContent = papers.filter(
    (p) => p.note?.trim() || p.annotations?.length,
  ).length;
  $('#total-papers').textContent = source.length;
  $('#total-edges').textContent = state.nav === 'trash' ? 0 : allEdges().length;
  $('#total-topics').textContent = new Set(source.map(categoryForPaper)).size;
  $('#result-count').textContent = count + ' 篇论文';
  $('#demo-info').hidden = !source.some((p) => p.demo);
  $('#page-title').textContent = state.collection
    ? collections.find((c) => c.id === state.collection)?.name
    : {
        all: '我的论文库',
        starred: '我的收藏',
        reading: '正在阅读',
        notes: '阅读笔记',
        trash: '回收站',
      }[state.nav];
  $$('[data-nav]').forEach((b) =>
    b.classList.toggle('active', b.dataset.nav === state.nav && !state.collection),
  );
  $('.library-panel').classList.toggle('is-empty', source.length === 0);
  $('.workspace').classList.toggle('graph-mode', state.view === 'graph' && state.nav !== 'trash');
  if (state.nav === 'trash') state.view = 'list';
  $('#graph-view').disabled = state.nav === 'trash';
  $('#graph-panel').hidden = state.view !== 'graph';
  $('#list-panel').hidden = state.view !== 'list';
  $('#graph-view').classList.toggle('active', state.view === 'graph');
  $('#list-view').classList.toggle('active', state.view === 'list');
  $('#graph-view').setAttribute('aria-pressed', state.view === 'graph');
  $('#list-view').setAttribute('aria-pressed', state.view === 'list');
}
function renderFilters() {
  const source = state.nav === 'trash' ? trash : papers;
  const years = [...new Set(source.map((p) => p.year).filter(Boolean))].sort((a, b) => b - a);
  $('#year-filter').innerHTML =
    '<option value="">所有年份</option>' +
    years
      .map(
        (y) =>
          `<option value="${esc(y)}" ${String(y) === state.year ? 'selected' : ''}>${esc(y)} 年</option>`,
      )
      .join('');
  const categories = topics
    .map((t) => ({ t, count: source.filter((p) => categoryForPaper(p) === t.id).length }))
    .filter((v) => v.count);
  const buttons = categories
    .map(
      ({ t, count }) =>
        `<button class="collection category-choice ${state.categories.has(t.id) ? 'active' : ''}" role="checkbox" aria-label="${esc(t.name)}，${count} 篇论文" aria-checked="${state.categories.has(t.id)}" data-filter-category="${esc(t.id)}"><span class="category-check">${icon('check')}</span><span class="collection-name">${esc(t.name)}</span><span class="count">${count}</span></button>`,
    )
    .join('');
  $('#auto-categories').innerHTML = buttons;
  $('#mobile-category-options').innerHTML = buttons;
  $('#category-selection-hint').textContent = state.categories.size
    ? `已选 ${state.categories.size} 类 · 点击可增减`
    : '点击类别可多选';
  $('#mobile-category-count').textContent = state.categories.size ? state.categories.size : '';
  $$('[data-clear-categories]').forEach((b) => {
    b.disabled = !state.categories.size;
    b.onclick = () => {
      state.categories.clear();
      render();
    };
  });
  $$('[data-filter-category]').forEach(
    (b) =>
      (b.onclick = () => {
        const id = b.dataset.filterCategory,
          container = b.closest('#mobile-category-options')
            ? '#mobile-category-options'
            : '#auto-categories';
        state.categories.has(id) ? state.categories.delete(id) : state.categories.add(id);
        state.collection = '';
        render();
        $(container).querySelector(`[data-filter-category="${id}"]`)?.focus();
      }),
  );
}
function publicationLine(p) {
  const journal = p.journal?.trim(),
    publisher = p.publisher?.trim();
  if (!journal && !publisher) return '';
  return `<div class="row-publication" title="${esc([journal, publisher].filter(Boolean).join(' · '))}"><span class="publication-name">${esc(journal || publisher)}</span>${journal && publisher && journal.toLowerCase() !== publisher.toLowerCase() ? `<span class="publication-publisher"> · ${esc(publisher)}</span>` : ''}</div>`;
}
async function completePublication(p) {
  const before = JSON.stringify([
    p.journal,
    p.publisher,
    p.publicationSource,
    p.publicationCheckedVersion,
  ]);
  const local = extractPublication(p.textExcerpt || '');
  let filled = false;
  for (const key of ['journal', 'publisher'])
    if (!p[key] && local[key]) {
      p[key] = local[key];
      filled = true;
    }
  if (filled) p.publicationSource = local.publicationSource;
  if (p.doi && !p.journal) {
    try {
      const response = await fetch('/api/publication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doi: p.doi }),
        signal: AbortSignal.timeout(8500),
      });
      if (!response.ok)
        return (
          before !==
          JSON.stringify([p.journal, p.publisher, p.publicationSource, p.publicationCheckedVersion])
        );
      const result = await response.json();
      if (result.status === 'unavailable')
        return (
          before !==
          JSON.stringify([p.journal, p.publisher, p.publicationSource, p.publicationCheckedVersion])
        );
      let changed = false;
      for (const key of ['journal', 'publisher'])
        if (!p[key] && result[key]) {
          p[key] = result[key];
          changed = true;
        }
      if (changed) p.publicationSource = result.publicationSource;
    } catch {
      return (
        before !==
        JSON.stringify([p.journal, p.publisher, p.publicationSource, p.publicationCheckedVersion])
      );
    }
  }
  p.publicationCheckedVersion = PUBLICATION_VERSION;
  return (
    before !==
    JSON.stringify([p.journal, p.publisher, p.publicationSource, p.publicationCheckedVersion])
  );
}
async function enrichExistingPublications() {
  if (enrichingPublications) return;
  const pending = papers.filter(
    (p) =>
      !p.demo &&
      !p.syncPending &&
      !p.journal &&
      (p.publicationCheckedVersion || 0) < PUBLICATION_VERSION,
  );
  if (!pending.length) return;
  enrichingPublications = true;
  $('#analysis-notice').hidden = false;
  try {
    for (let i = 0; i < pending.length; i++) {
      const p = pending[i];
      if (!papers.includes(p)) continue;
      $('#analysis-message').textContent = `正在补充期刊与出版社 ${i + 1}/${pending.length}`;
      try {
        if (await completePublication(p)) {
          if (!papers.includes(p)) continue;
          await persistPaper(p);
          renderList();
          if (state.selected === p.id && !reader.isOpen && state.tab !== 'note') renderDetail();
        }
      } catch {}
    }
  } finally {
    enrichingPublications = false;
    $('#analysis-notice').hidden = true;
  }
}
function renderCollections() {
  $('#collection-count').textContent = collections.length;
  if (state.collection) $('#project-collections').open = true;
  $('#collections').innerHTML =
    collections
      .map(
        (c) =>
          `<button class="collection ${state.collection === c.id ? 'active' : ''}" data-collection="${esc(c.id)}"><span class="collection-dot" style="background:${esc(c.color)}"></span><span class="collection-name">${esc(c.name)}</span><span class="count">${papers.filter((p) => p.collectionIds?.includes(c.id)).length}</span></button>`,
      )
      .join('') || '<p class="project-empty">点击 + 创建一个项目集合。</p>';
  $$('[data-collection]').forEach(
    (b) =>
      (b.onclick = () => {
        state.collection = b.dataset.collection;
        state.nav = 'all';
        state.categories.clear();
        render();
      }),
  );
}
function selectPaper(id, mobile = true) {
  state.selected = id;
  state.tab = 'related';
  $('#edge-tooltip').hidden = true;
  renderList();
  renderGraph();
  renderDetail();
  $('#detail-panel').scrollTop = 0;
  if (mobile && matchMedia('(max-width:680px)').matches)
    $('#detail-panel').classList.add('mobile-open');
}
function renderList() {
  const vp = visiblePapers(),
    inTrash = state.nav === 'trash';
  $('#paper-list').innerHTML = vp.length
    ? vp
        .map(
          (p) =>
            `<article class="paper-row ${state.selected === p.id ? 'selected' : ''}" tabindex="0" role="button" data-paper="${esc(p.id)}" aria-label="阅读 ${esc(p.title)}"><span class="pdf-icon">PDF</span><div><h3>${esc(p.title)}</h3><div class="row-meta">${esc(p.authors?.length ? p.authors.slice(0, 2).join(', ') + (p.authors.length > 2 ? ' et al.' : '') : '')}</div>${publicationLine(p)}<div class="row-tags"><button class="row-category category-edit-button" data-classify="${esc(p.id)}" ${inTrash ? 'disabled' : ''} aria-label="更改类别 ${esc(p.title)}">${esc(topicName(categoryForPaper(p)))} ${icon('edit')}</button>${(
              p.tags || []
            )
              .slice(0, 2)
              .map((t) => `<span># ${esc(t)}</span>`)
              .join(
                '',
              )}<span class="row-upload-state">${inTrash ? '已移入回收站' : p.hasFile && !p.syncPending ? '已保存到本机' : '等待上传 / 同步'}</span></div></div><span class="row-year">${esc(p.year || '')}</span><span class="row-status ${readingStatus(p)}" title="根据阅读和笔记行为自动记录">${statusName(readingStatus(p))}</span><button class="row-detail-button" data-show-detail="${esc(p.id)}" aria-label="论文详情 ${esc(p.title)}">详情</button><button class="row-action" data-${inTrash ? 'restore' : 'delete'}="${esc(p.id)}" aria-label="${inTrash ? '恢复' : '删除'} ${esc(p.title)}" title="${inTrash ? '恢复文献' : '删除文献'}">${icon(inTrash ? 'restore' : 'trash')}<span>${inTrash ? '恢复' : '删除'}</span></button></article>`,
        )
        .join('')
    : `<div class="empty-state"><h3>${inTrash ? '回收站为空' : papers.length ? '没有符合条件的论文' : '论文库还没有文献'}</h3><p>${inTrash ? '删除的论文会出现在这里，可以恢复。' : papers.length ? '调整搜索条件，或导入新的 PDF。' : '导入 PDF 后自动分类，并建立论文关联。'}</p>${inTrash ? '' : '<button class="button primary" data-empty-import>导入 PDF</button>'}</div>`;
  $$('[data-empty-import]').forEach((b) => (b.onclick = showImport));
  $$('[data-paper]').forEach((row) => {
    row.onclick = () => {
      const p = getPaper(row.dataset.paper);
      if (inTrash) selectPaper(p.id);
      else openPDF(p);
    };
    row.onkeydown = (e) => {
      if (e.target === row && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        if (inTrash) selectPaper(row.dataset.paper);
        else openPDF(getPaper(row.dataset.paper));
      }
    };
  });
  $$('[data-show-detail]').forEach(
    (b) =>
      (b.onclick = (e) => {
        e.stopPropagation();
        selectPaper(b.dataset.showDetail);
      }),
  );
  $$('[data-classify]').forEach(
    (b) =>
      (b.onclick = (e) => {
        e.stopPropagation();
        classifyPaper(getPaper(b.dataset.classify));
      }),
  );
  $$('[data-delete]').forEach(
    (b) =>
      (b.onclick = (e) => {
        e.stopPropagation();
        deletePaperById(b.dataset.delete, b);
      }),
  );
  $$('[data-restore]').forEach(
    (b) =>
      (b.onclick = (e) => {
        e.stopPropagation();
        restorePaperById(b.dataset.restore, b);
      }),
  );
}
async function deletePaperById(id, button) {
  const p = getPaper(id);
  if (!p) return;
  if (button) button.disabled = true;
  try {
    if (state.selected === id && $('#note-input')) {
      clearTimeout(saveTimer);
      await persistPaper(p);
    }
    const removed = await cloud.deletePaper(p);
    papers = papers.filter((v) => v.id !== id);
    trash = [removed, ...trash.filter((v) => v.id !== id)];
    if (state.selected === id) state.selected = papers[0]?.id || '';
    render();
    toast('已移入回收站，PDF、笔记和关联可恢复。');
  } catch (error) {
    toast('删除未完成：' + error.message);
    if (button) button.disabled = false;
  }
}
async function restorePaperById(id, button) {
  const p = getPaper(id);
  if (!p) return;
  if (button) button.disabled = true;
  try {
    const restored = await cloud.restorePaper(p);
    trash = trash.filter((v) => v.id !== id);
    papers = [restored, ...papers.filter((v) => v.id !== id)];
    state.selected = state.nav === 'trash' ? trash[0]?.id || '' : restored.id;
    render();
    toast('论文已恢复，关联图谱已更新。');
    return restored;
  } catch (error) {
    toast('恢复未完成：' + error.message);
    if (button) button.disabled = false;
    return null;
  }
}
const edgeColors = { topic: '#b7b7b7', citation: '#999999', author: '#a7a7a7', manual: '#9f9f9f' };
const edgeNames = {
  topic: '内容相关',
  citation: '引用关系',
  author: '共同作者',
  manual: '手动关联',
};
function labelLines(title, max = 23) {
  const words = title.split(/\s+/);
  let lines = [''];
  for (const word of words) {
    let i = lines.length - 1;
    if ((lines[i] + ' ' + word).trim().length > max && lines[i] && lines.length < 2)
      lines.push(word);
    else lines[lines.length - 1] += (lines[lines.length - 1] ? ' ' : '') + word;
  }
  if (lines[1]?.length > max + 7) lines[1] = lines[1].slice(0, max + 4) + '…';
  if (lines[0]?.length > max + 9) lines[0] = lines[0].slice(0, max + 6) + '…';
  return lines;
}
function renderGraph() {
  paperGraph.render({
    papers: visiblePapers().map((p) => ({ ...p, topics: [categoryForPaper(p)] })),
    edges: visibleEdges(),
    selected: state.selected,
  });
}
function showEdge(edge) {
  if (!edge) return;
  $('#edge-tooltip').innerHTML =
    `<button id="close-edge" aria-label="关闭关系说明">${icon('close')}</button><strong>${esc(edgeNames[edge.type])}${edge.demo ? ' · 演示关系' : ''}</strong><p>${esc(edge.reason)}</p><p>${esc(getPaper(edge.source)?.title)} ${edge.type === 'citation' ? '→' : '↔'} ${esc(getPaper(edge.target)?.title)}</p>${edge.type === 'topic' ? '<p>依据共同研究内容、具体方法与文本相似度建立；同一大类本身不会产生连线。</p>' : ''}`;
  $('#edge-tooltip').hidden = false;
  $('#close-edge').onclick = () => ($('#edge-tooltip').hidden = true);
}
function renderDetail() {
  const p = getPaper(state.selected);
  if (p?.deletedAt) {
    $('#detail-panel').innerHTML =
      `<div class="detail-topline"><span>回收站</span><button class="mobile-detail-back" id="close-detail" aria-label="关闭详情">${icon('close')}</button></div><h2 class="paper-title" style="margin-top:22px">${esc(p.title)}</h2><p class="note-hint">文献已从论文库和图谱移除。恢复后可继续阅读，原 PDF、笔记和关联会保留。</p><button class="button primary" id="restore-detail">${icon('restore')}恢复论文</button>`;
    $('#restore-detail').onclick = () => restorePaperById(p.id, $('#restore-detail'));
    $('#close-detail').onclick = () => $('#detail-panel').classList.remove('mobile-open');
    return;
  }
  if (!p) {
    $('#detail-panel').innerHTML =
      `<div class="detail-empty">${icon('book')}<span>选择一篇论文，开始探索</span></div>`;
    return;
  }
  const edges = allEdges().filter((e) => e.source === p.id || e.target === p.id);
  const relationships = edges
    .map((e) => ({ edge: e, paper: getPaper(e.source === p.id ? e.target : e.source) }))
    .filter((v) => v.paper);
  const unique = [...new Map(relationships.map((r) => [r.paper.id, r])).values()];
  $('#detail-panel').innerHTML =
    `<div class="detail-topline"><span>论文详情</span><div><button class="mobile-detail-back" id="close-detail" aria-label="关闭详情">${icon('close')}</button><button id="detail-star" class="${p.starred ? 'starred' : ''}" aria-label="${p.starred ? '取消收藏' : '收藏论文'}">${icon('star')}</button><button id="edit-paper" aria-label="编辑论文信息">${icon('edit')}</button><button id="delete-paper" aria-label="删除论文" title="删除论文">${icon('trash')}</button></div></div><div class="paper-type">${icon('file')} JOURNAL ARTICLE <span>${p.demo ? '演示条目' : p.analysisSource === 'manual' ? '已编辑' : '自动分类'}</span></div><h2 class="paper-title">${esc(p.title)}</h2>${p.authors?.length ? `<p class="paper-authors">${esc(p.authors.join(', '))}</p>` : ''}${p.journal || p.publisher || p.year || p.doi ? `<div class="paper-journal">${esc([p.journal, p.publisher, p.year].filter(Boolean).join(' · '))}${p.doi ? '<br>DOI: ' + esc(p.doi) : ''}</div>` : ''}<div class="paper-actions"><button class="button primary" id="open-pdf">${icon('book')}${p.demo ? '预览示例' : '阅读 PDF'}</button><button class="button secondary" id="add-relation">${icon('link')}添加关联</button></div><div class="section-label"><strong>阅读状态</strong><span class="automatic-reading-state ${readingStatus(p)}" title="打开 PDF、高亮和笔记自动记录">${statusName(readingStatus(p))}</span></div><div class="detail-section"><div class="section-label"><strong>摘要</strong><span>${p.demo ? '示例摘要' : 'PDF 摘要'}</span></div><p class="abstract ${/[\u4e00-\u9fa5]/.test(p.abstract || '') ? 'zh' : ''}">${esc(p.abstract || '未提取到摘要。')}</p></div>${p.affiliation ? `<div class="detail-section"><div class="section-label"><strong>作者单位</strong></div><p class="affiliation">${esc(p.affiliation)}</p></div>` : ''}<div class="detail-section"><div class="section-label"><strong>关键词与主题</strong><span>${p.demo ? '演示标签' : '研究主题与方法'}</span></div><div class="tags">${(p.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('') || '<span class="pending-value">已按论文内容分类</span>'}</div></div><div class="detail-tabs"><button id="related-tab" class="${state.tab === 'related' ? 'active' : ''}">关联论文 <span>${unique.length}</span></button><button id="note-tab" class="${state.tab === 'note' ? 'active' : ''}">阅读笔记${p.note ? ' ·' : ''}</button><button id="info-tab" class="${state.tab === 'info' ? 'active' : ''}">资料</button></div><div class="detail-section" style="border-top:0" id="detail-tab-content">${state.tab === 'related' ? unique.map(({ edge, paper: q }) => `<button class="related-paper" data-related="${esc(q.id)}"><i class="related-dot" style="background:${topicColor(q)}"></i><span><strong>${esc(q.title)}</strong><small>${q.year ? esc(q.year) + ' · ' : ''}${esc(edgeNames[edge.type])}${edge.demo ? ' · 示例' : ''}</small></span>${icon('chevron')}</button>`).join('') || '<p class="note-hint">暂无内容相关的论文。导入同一方向的文献后会自动建立关联。</p>' : state.tab === 'note' ? `<textarea class="note-area" id="note-input" aria-label="阅读笔记" placeholder="记下关键观点、研究启发或下一步想法…">${esc(p.note || '')}</textarea><p class="note-hint" id="note-save-hint">笔记自动保存，并同步到当前账号。</p>` : `<p class="note-hint">信息来源：${esc(p.metadataSource)}${p.publicationSource ? '<br>出版信息：' + esc(p.publicationSource) : ''}<br>文件：${esc(p.filename || '演示条目未附真实 PDF')}<br>${p.demo ? '本条目的标题、作者、期刊及引用均为虚构演示。' : 'PDF 在浏览器中解析，原文件与资料保存在你的本机服务论文库。尚未接入完整文献解析或引用数据库。'}</p><button class="button secondary" id="organize-paper">${icon('folder')}加入项目集合</button>`}</div>`;
  $('#detail-star').onclick = async () => {
    p.starred = !p.starred;
    await persistPaper(p);
    renderSummary();
    renderDetail();
    if (state.nav === 'starred') {
      renderList();
      renderGraph();
    }
  };
  $('#edit-paper').onclick = () => editPaper(p);
  $('#delete-paper').onclick = () => deletePaperById(p.id, $('#delete-paper'));
  $('#open-pdf').onclick = () => openPDF(p).catch((error) => toast(error.message));
  $('#add-relation').onclick = () => addRelation(p);
  $('#close-detail').onclick = () => $('#detail-panel').classList.remove('mobile-open');
  $('#related-tab').onclick = () => {
    state.tab = 'related';
    renderDetail();
  };
  $('#note-tab').onclick = () => {
    state.tab = 'note';
    renderDetail();
  };
  $('#info-tab').onclick = () => {
    state.tab = 'info';
    renderDetail();
  };
  $$('[data-related]').forEach((b) => (b.onclick = () => selectPaper(b.dataset.related, false)));
  if ($('#note-input'))
    $('#note-input').oninput = (e) => {
      p.note = e.target.value;
      $('#note-save-hint').textContent = '保存中…';
      clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        try {
          await persistPaper(p);
          const hint = $('#note-save-hint');
          if (hint)
            hint.textContent = p.syncPending
              ? '已保存在本机，等待本机服务同步。'
              : '已保存到本机。';
          renderSummary();
          renderList();
          if (state.nav === 'notes') renderGraph();
        } catch {
          const hint = $('#note-save-hint');
          if (hint) hint.textContent = '尚未同步，请点击顶部同步状态检查。';
        }
      }, 350);
    };
  if ($('#organize-paper')) $('#organize-paper').onclick = () => organize(p);
}
function classifyPaper(p) {
  openModal(
    `<form id="classify-form" class="modal-inner">${modalHeader('调整论文类别')}<p class="modal-subtitle">${esc(p.title)}</p><label class="field">论文类别<select name="category">${topics.map((c) => `<option value="${esc(c.id)}" ${categoryForPaper(p) === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label><p class="note-hint">改变类别不会删除内容关联，跨类别论文仍可相互联系。</p><div class="modal-actions"><button type="button" class="button secondary" data-close>取消</button><button class="button primary" type="submit">保存归类</button></div></form>`,
  );
  $('#classify-form').onsubmit = async (e) => {
    e.preventDefault();
    p.categoryId = new FormData(e.target).get('category');
    p.categorySource = 'manual';
    await persistPaper(p);
    $('#modal').close();
    render();
    toast(p.syncPending ? '归类已保存在本机，等待同步。' : '论文归类已保存。');
  };
}
function manageCategories() {
  if (!db) {
    toast('请先登录论文库。');
    return;
  }
  let drafts = structuredClone(topics),
    assignments = new Map(papers.map((p) => [p.id, categoryForPaper(p)]));
  const collect = () => {
    for (const c of drafts) {
      const input = $(`[data-category-name="${c.id}"]`),
        color = $(`[data-category-color="${c.id}"]`);
      if (input) c.name = input.value.trim();
      if (color) c.color = color.value;
    }
    for (const input of $$('[data-paper-category]'))
      assignments.set(input.dataset.paperCategory, input.value);
  };
  const draw = () => {
    openModal(
      `<form id="category-manager-form" class="modal-inner category-manager">${modalHeader('管理类别与文献归属')}<p class="modal-subtitle">用少量大类整理论文。具体方法保留在关键词中，不会自动创建类别；关联可跨越类别。</p><h3>类别名称与颜色</h3><div class="category-name-list">${drafts.map((c) => `<div class="category-name-row"><input type="color" data-category-color="${esc(c.id)}" value="${esc(c.color)}" aria-label="${esc(c.name || '新类别')}颜色"><input data-category-name="${esc(c.id)}" value="${esc(c.name)}" maxlength="60" required aria-label="${esc(c.name || '新类别')}名称"><span>${papers.filter((p) => assignments.get(p.id) === c.id).length} 篇</span></div>`).join('')}</div><button id="add-category" type="button" class="category-add">＋ 新增自定义类别</button><h3>调整每篇论文的类别</h3><div class="category-paper-list">${papers.map((p) => `<label class="category-paper-row"><span title="${esc(p.title)}">${esc(p.title)}</span><select data-paper-category="${esc(p.id)}" aria-label="${esc(p.title)}的类别">${drafts.map((c) => `<option value="${esc(c.id)}" ${assignments.get(p.id) === c.id ? 'selected' : ''}>${esc(c.name || '新类别')}</option>`).join('')}</select></label>`).join('') || '<p class="note-hint">导入论文后可以在这里调整归属。</p>'}</div><p class="note-hint" id="category-manager-status" role="status"></p><div class="modal-actions"><button type="button" class="button secondary" data-close>取消</button><button id="save-categories" type="submit" class="button primary">保存类别与归类</button></div></form>`,
      true,
    );
    $('#add-category').onclick = () => {
      collect();
      drafts.push({ id: 'cat-' + crypto.randomUUID(), name: '', color: '#7e8b97' });
      draw();
    };
    $('#category-manager-form').onsubmit = async (e) => {
      e.preventDefault();
      collect();
      const names = drafts.map((c) => c.name.trim().toLowerCase());
      if (names.some((n) => !n) || new Set(names).size !== names.length) {
        $('#category-manager-status').textContent = '请填写不重复的类别名称。';
        return;
      }
      $('#save-categories').disabled = true;
      try {
        const now = new Date().toISOString();
        categoryOverrides = drafts.map((c) => {
          const old = topics.find((t) => t.id === c.id);
          return {
            ...c,
            updatedAt: old?.name === c.name && old?.color === c.color ? old.updatedAt || '' : now,
          };
        });
        await persistSettings();
        let count = 0;
        for (const p of papers) {
          const category = assignments.get(p.id);
          if (category && category !== categoryForPaper(p)) {
            p.categoryId = category;
            p.categorySource = 'manual';
            $('#category-manager-status').textContent = `正在保存文献归类 ${++count}…`;
            await persistPaper(p);
          }
        }
        $('#modal').close();
        render();
        toast(
          cloud.pending.length
            ? '类别与归类已保存在本机，等待同步。'
            : '类别名称和文献归属已保存。',
        );
      } catch (error) {
        $('#category-manager-status').textContent = '保存未完成：' + error.message;
        $('#save-categories').disabled = false;
      }
    };
  };
  draw();
}
function editPaper(p) {
  openModal(
    `<form id="edit-form" class="modal-inner">${modalHeader('编辑论文信息')}<p class="modal-subtitle">类别用于整理文献，关键词和内容用于发现跨类别关联。</p><div class="form-grid"><label class="field full">标题<input name="title" required value="${esc(p.title)}"></label><label class="field full">作者（用分号分隔）<input name="authors" value="${esc((p.authors || []).join('; '))}"></label><label class="field full">作者单位<input name="affiliation" value="${esc(p.affiliation)}"></label><label class="field">期刊 / 会议 / 书名<input name="journal" value="${esc(p.journal)}"></label><label class="field">出版社<input name="publisher" value="${esc(p.publisher)}"></label><label class="field">年份<input name="year" type="number" min="1600" max="2100" value="${p.year || ''}"></label><label class="field full">DOI<input name="doi" value="${esc(p.doi)}"></label><label class="field full">论文类别<select name="category">${topics.map((t) => `<option value="${esc(t.id)}" ${categoryForPaper(p) === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label><label class="field full">关键词（用分号分隔）<input name="tags" value="${esc((p.tags || []).join('; '))}"></label><label class="field full">摘要<textarea name="abstract">${esc(p.abstract)}</textarea></label></div><div class="modal-actions"><button type="button" class="button secondary" data-close>取消</button><button type="submit" class="button primary">保存修改</button></div></form>`,
  );
  $('#edit-form').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    p.title = f.get('title').trim();
    p.authors = splitValues(f.get('authors'));
    p.affiliation = f.get('affiliation').trim();
    p.journal = f.get('journal').trim();
    p.publisher = f.get('publisher').trim();
    p.year = Number(f.get('year')) || null;
    const previousDoi = p.doi;
    p.doi = f.get('doi').trim();
    if (previousDoi !== p.doi) p.publicationCheckedVersion = 0;
    const chosen = f.get('category');
    if (chosen !== categoryForPaper(p)) {
      p.categoryId = chosen;
      p.categorySource = 'manual';
    }
    p.tags = splitValues(f.get('tags'));
    p.abstract = f.get('abstract').trim();
    Object.assign(p, analyzePaper(p));
    if (!p.journal && (p.publicationCheckedVersion || 0) < PUBLICATION_VERSION)
      await completePublication(p);
    await persistPaper(p);
    $('#modal').close();
    render();
    toast('论文信息与类别已保存。');
  };
}
function splitValues(v) {
  return [
    ...new Set(
      String(v || '')
        .split(/[;；，\n]/)
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  ];
}
function addRelation(p) {
  const others = papers.filter((q) => q.id !== p.id);
  openModal(
    `<form id="relation-form" class="modal-inner">${modalHeader('添加论文关联')}<p class="modal-subtitle">把你在阅读中发现的联系记录下来，之后可以在图谱中查看。</p><div class="form-grid"><label class="field full">当前论文<input readonly value="${esc(p.title)}"></label><label class="field full">关联到<select name="target" required>${others.map((q) => `<option value="${esc(q.id)}">${esc(q.title)}</option>`).join('')}</select></label><label class="field full">关联说明<textarea name="reason" required maxlength="500" placeholder="例如：使用了相同的数据集，适合对照阅读。"></textarea></label></div><div class="modal-actions"><button type="button" class="button secondary" data-close>取消</button><button type="submit" class="button primary" ${others.length ? '' : 'disabled'}>建立关联</button></div></form>`,
  );
  $('#relation-form').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const target = f.get('target');
    if (
      customEdges.some(
        (r) =>
          r.type === 'manual' &&
          [r.source, r.target].includes(p.id) &&
          [r.source, r.target].includes(target),
      )
    ) {
      toast('这两篇论文已经有手动关联。');
      return;
    }
    customEdges.push({
      id: 'm-' + crypto.randomUUID(),
      source: p.id,
      target,
      type: 'manual',
      reason: f.get('reason').trim(),
      demo: false,
    });
    await persistSettings();
    $('#modal').close();
    render();
    toast('已添加手动关联，可点击图谱连线查看。');
  };
}
async function openPDF(p) {
  if (!p) return;
  if (p.demo) {
    toast('演示条目没有 PDF，请导入自己的论文。');
    return;
  }
  state.selected = p.id;
  if (location.hash !== '#read=' + encodeURIComponent(p.id))
    history.pushState({ paperloomReader: true }, '', '#read=' + encodeURIComponent(p.id));
  await reader.open(p);
}
function organize(p) {
  openModal(
    `<form id="organize-form" class="modal-inner">${modalHeader('加入项目集合')}<p class="modal-subtitle">按具体课题收集论文，可以跨越多个类别。同一篇论文可以放入多个项目集合。</p>${collections.length ? collections.map((c) => `<label class="collection-option"><input type="checkbox" name="collection" value="${esc(c.id)}" ${p.collectionIds?.includes(c.id) ? 'checked' : ''}>${esc(c.name)}</label>`).join('') : '<p class="note-hint">请先在左侧创建一个项目集合。</p>'}<div class="modal-actions"><button type="button" class="button secondary" data-close>取消</button><button type="submit" class="button primary">保存</button></div></form>`,
  );
  $('#organize-form').onsubmit = async (e) => {
    e.preventDefault();
    p.collectionIds = new FormData(e.target).getAll('collection');
    await persistPaper(p);
    $('#modal').close();
    render();
    toast('项目集合已更新。');
  };
}
function showImport() {
  openModal(
    `<div class="modal-inner">${modalHeader('导入 PDF')}<p class="modal-subtitle">选择文件后自动读取、分类、建立关联并上传本机服务。无需逐篇确认。</p><div class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="选择 PDF 文件">${icon('upload')}<strong>拖拽 PDF 到这里，或点击选择</strong><span>可批量导入 · 单个 PDF 最大 30 MB</span></div><p class="import-footnote">导入进度会持续显示在右下角“导入任务”中。只有显示“已上传并保存”才表示本机服务保存成功；需要修改时直接编辑论文信息即可。</p><button class="button secondary restore-button" id="restore-backup">${icon('download')}从 Paperloom 备份恢复</button></div>`,
  );
  const dz = $('#dropzone');
  dz.onclick = () => $('#file-input').click();
  dz.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      $('#file-input').click();
    }
  };
  dz.ondragover = (e) => {
    e.preventDefault();
    dz.classList.add('dragover');
  };
  dz.ondragleave = () => dz.classList.remove('dragover');
  dz.ondrop = (e) => {
    e.preventDefault();
    importFiles([...e.dataTransfer.files]);
  };
  $('#restore-backup').onclick = () => $('#restore-input').click();
}
let importing = false;
async function processImport(file, job) {
  sourceFiles.set(job.id, file);
  try {
    if (!/\.pdf$/i.test(file.name)) throw new Error('请选择 PDF 文件');
    if (file.size > 30 * 1024 * 1024) throw new Error('文件超过 30 MB');
    transfers.update(job, { phase: 'reading', progress: 1, message: '读取文件并检查重复' });
    const bytes = await file.arrayBuffer();
    if (!new TextDecoder().decode(bytes.slice(0, 1024)).includes('%PDF-'))
      throw new Error('文件内容不是有效 PDF');
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('');
    job.paperId = 'pdf-' + hash.slice(0, 20);
    const existing = papers.find((p) => p.hash === hash || p.id === job.paperId),
      deleted = trash.find((p) => p.hash === hash || p.id === job.paperId);
    if (deleted) {
      const restored = await restorePaperById(deleted.id);
      if (!restored) throw new Error('恢复未完成，请检查网络后重试');
      const result = restored.hasFile
        ? { queued: false }
        : await cloud.uploadFile(restored, new Blob([bytes], { type: 'application/pdf' }));
      transfers.update(job, {
        phase: result.queued ? 'queued' : 'complete',
        message: result.queued ? '已恢复资料，PDF 等待上传' : '已从回收站恢复相同 PDF',
      });
      if (!result.queued) sourceFiles.delete(job.id);
      render();
      return;
    }
    if (existing?.hasFile) {
      transfers.update(job, { phase: 'duplicate', progress: 100, message: '论文库中已有这份 PDF' });
      sourceFiles.delete(job.id);
      return;
    }
    await cloud.cacheFile(job.paperId, new Blob([bytes], { type: 'application/pdf' }));
    const parsed = await readPaperPdf(bytes, file.name, (step) =>
      transfers.update(job, {
        phase: 'reading',
        progress: 5 + (step.page / step.total) * 15,
        message: `解析第 ${step.page}/${step.total} 页`,
      }),
    );
    transfers.update(job, {
      phase: 'classifying',
      progress: 24,
      message: '识别研究主题、方法与关键词',
    });
    const p = analyzePaper({
      ...existing,
      ...parsed,
      id: job.paperId,
      hash,
      filename: file.name,
      affiliation: existing?.affiliation || '',
      journal: existing?.journal || parsed.journal || '',
      publisher: existing?.publisher || parsed.publisher || '',
      year: existing?.year || parsed.year || null,
      starred: existing?.starred || false,
      status: existing?.status || 'unread',
      note: existing?.note || '',
      demo: false,
      reviewed: true,
      collectionIds: existing?.collectionIds || (state.collection ? [state.collection] : []),
      importedAt: existing?.importedAt || new Date().toISOString(),
      x: existing?.x || 200 + ((papers.length * 113) % 570),
      y: existing?.y || 200 + ((papers.length * 79) % 360),
    });
    if (
      p.doi &&
      papers.some((q) => q.id !== p.id && normalizeText(q.doi) === normalizeText(p.doi))
    ) {
      transfers.update(job, {
        phase: 'duplicate',
        progress: 100,
        message: '论文库中已有相同 DOI 的文献',
      });
      return;
    }
    transfers.update(job, { phase: 'classifying', progress: 26, message: '补充期刊与出版社信息' });
    await completePublication(p);
    transfers.update(job, {
      phase: 'metadata',
      progress: 28,
      message: '分类为 ' + topicName(categoryForPaper(p)),
    });
    await persistPaper(p);
    papers = [p, ...papers.filter((q) => q.id !== p.id)];
    state.selected = p.id;
    state.nav = 'all';
    state.categories.clear();
    state.year = '';
    state.collection = '';
    state.query = '';
    $('#search').value = '';
    render();
    const uploaded = await cloud.uploadFile(p, new Blob([bytes], { type: 'application/pdf' }));
    if (uploaded.queued) {
      transfers.update(job, { phase: 'queued', message: 'PDF 暂存本机，等待网络恢复后同步' });
    } else {
      const links = allEdges().filter((e) => e.source === p.id || e.target === p.id).length;
      transfers.update(job, {
        phase: 'complete',
        message: `${topicName(categoryForPaper(p))} · ${links} 条论文关联${parsed.scanned ? ' · 已按标题分类' : ''}`,
      });
      sourceFiles.delete(job.id);
    }
    render();
  } catch (error) {
    transfers.update(job, { phase: 'failed', message: error.message || '导入未完成，可点击重试' });
    render();
  }
}
async function importFiles(files) {
  if (importing) {
    toast('正在处理当前批次，请稍后再添加文件。');
    return;
  }
  if (!db) {
    toast('请先登录并连接论文库。');
    return;
  }
  if ($('#modal').open) $('#modal').close();
  const jobs = files.map((file) => ({ file, job: transfers.add(file) }));
  importing = true;
  try {
    for (const { file, job } of jobs) await processImport(file, job);
  } finally {
    importing = false;
    $('#file-input').value = '';
    render();
  }
}
async function retryTransfer(job) {
  if (importing) {
    toast('请等待当前批次处理完成。');
    return;
  }
  try {
    const file = sourceFiles.get(job.id);
    if (file) {
      importing = true;
      try {
        await processImport(file, job);
      } finally {
        importing = false;
      }
      return;
    }
    if (job.paperId) {
      const blob = await cloud.getFile(job.paperId);
      importing = true;
      try {
        await processImport(new File([blob], job.name, { type: 'application/pdf' }), job);
      } finally {
        importing = false;
      }
      return;
    }
    toast('请重新选择这个 PDF 文件。');
    showImport();
  } catch (error) {
    transfers.update(job, { phase: 'failed', message: '请重新选择 PDF：' + error.message });
  }
}
async function createCollection() {
  openModal(
    `<form id="collection-form" class="modal-inner">${modalHeader('创建项目集合')}<p class="modal-subtitle">例如为一个课题、综述或论文章节收集文献。可包含不同类别；在论文详情的“资料”中加入集合。</p><label class="field">集合名称<input name="name" maxlength="30" required placeholder="例如：我的博士论文 / 研究方法"></label><div class="modal-actions"><button type="button" class="button secondary" data-close>取消</button><button type="submit" class="button primary">创建集合</button></div></form>`,
  );
  $('#collection-form').onsubmit = async (e) => {
    e.preventDefault();
    const name = new FormData(e.target).get('name').trim();
    if (!name) return;
    const c = { id: 'c-' + crypto.randomUUID(), name, color: topics[collections.length % 4].color };
    collections.push(c);
    await persistSettings();
    state.collection = c.id;
    state.nav = 'all';
    state.categories.clear();
    $('#modal').close();
    render();
    toast('集合已创建。在论文详情的“资料”中将论文加入集合。');
  };
}
function showHelp() {
  $('#account-menu').open = false;
  openModal(
    `<div class="modal-inner">${modalHeader('使用说明')}<div class="help-copy"><h3>本机论文库</h3><p>PDF、论文信息、笔记与关联保存到当前电脑的数据目录。浏览器中也有缓存；看到“已保存到本机”表示资料已经写入本机服务。</p><h3>导入与分类</h3><p>上传文字型 PDF 后自动提取标题、摘要、DOI、关键词与出版信息，并按研究大类分类。可编辑类别名称、颜色与文章归属，手动修改会保留。扫描件暂不支持 OCR。</p><h3>论文关系图</h3><p>颜色表示类别，节点大小表示关联强度。滚轮缩放、拖动空白处平移、拖动节点调整位置，点击论文进入阅读。类别可多选，无关联论文独立显示。内容关联来自文本特征；引用连线只在参考文献 DOI 匹配时建立，也可添加手动关联。</p><h3>阅读与笔记</h3><p>划选文字或框选区域，选择半透明高亮颜色；点击已有高亮后可补写笔记。阅读状态根据打开、标记和笔记自动记录。阅读工具栏“查找”或 Ctrl/Cmd F 可搜索全文文字。</p><h3>本机翻译</h3><p>选中文字后点击“翻译”。使用支持该功能的桌面 Chrome 或 Edge，浏览器首次会准备语言模型。选段在本机处理，不发送给翻译服务器；不需要 API Key。手机浏览器暂不支持。</p><h3>出版信息补全</h3><p>有 DOI 且缺少期刊时，会向 Crossref 查询该 DOI。不发送 PDF、笔记或账号信息。可以通过启动配置关闭补全，详见项目文档。</p><h3>备份与恢复</h3><p>“导出资料 → 完整备份”包含 PDF、元信息、类别、高亮笔记与手动关联，可在另一台电脑的 Paperloom 中恢复。回收站保留原文件，删除条目后仍可恢复。建议定期备份。</p><h3>当前版本</h3><p>此开源版本提供本机单人模式，服务仅监听本机回环地址。它不提供公共注册与跨设备云同步；请勿把本机接口直接暴露到公网。</p></div><div class="modal-actions"><button class="button primary" data-close>关闭</button></div></div>`,
  );
}
async function showSync() {
  if (!db) {
    toast('尚未连接账号，请登录或重新连接。');
    return;
  }
  const pending = await cloud.listPending();
  openModal(
    `<div class="modal-inner">${modalHeader('同步状态')}<p class="modal-subtitle">${'PDF、笔记和论文资料保存到本机数据目录。'} ${esc(cloud.user.email)}</p>${pending.length ? pending.map((item) => `<div class="sync-item"><strong>${esc(item.type === 'paper' ? item.data.title : item.type === 'file' ? getPaper(item.id)?.title || 'PDF 文件' : '集合与论文关联')}</strong><span>${item.conflict ? '其他窗口有更新，请选择要保留的版本。' : item.error ? esc(item.error) : '资料保留在本机，等待同步。'}</span>${item.conflict ? `<div class="compare-notes"><label>本机笔记<textarea readonly>${esc(item.data.note || '（无笔记）')}</textarea></label><label>本机服务笔记<textarea readonly>${esc(item.current?.note || '（无笔记）')}</textarea></label></div><p>标题：本机 ${esc(item.data.title)} / 本机服务 ${esc(item.current?.title || '未找到')}</p><div class="modal-actions"><button class="button secondary" data-resolve-cloud="${esc(item.key)}">保留本机服务版本</button><button class="button primary" data-resolve-local="${esc(item.key)}">使用本机版本</button></div>` : ''}</div>`).join('') : '<div class="source-label">没有待保存的修改。刷新保存状态可检查其他浏览器窗口的更新。</div>'}<div class="modal-actions"><button class="button secondary" data-close>关闭</button><button class="button primary" id="retry-sync">刷新保存状态</button></div></div>`,
  );
  $('#retry-sync').onclick = async (e) => {
    e.target.disabled = true;
    e.target.textContent = '正在同步…';
    await cloud.retryFailed();
    $('#modal').close();
    await cloud.sync();
    toast(cloud.pending.length ? '仍有修改待同步，请查看状态。' : '同步已完成。');
  };
  $$('[data-resolve-cloud]').forEach(
    (b) => (b.onclick = () => resolveCloudConflict(b.dataset.resolveCloud, false)),
  );
  $$('[data-resolve-local]').forEach(
    (b) => (b.onclick = () => resolveCloudConflict(b.dataset.resolveLocal, true)),
  );
}
async function resolveCloudConflict(key, useLocal) {
  try {
    await cloud.resolveConflict(key, useLocal);
    $('#modal').close();
    await cloud.sync();
    toast('已处理版本冲突。');
  } catch (error) {
    toast('同步未完成：' + error.message);
  }
}
async function migrateLegacy() {
  if (!legacyLibrary?.papers?.length) return;
  const source = legacyLibrary;
  openModal(
    `<div class="modal-inner">${modalHeader('迁移旧版资料')}<p class="modal-subtitle">将此浏览器的 ${source.papers.length} 篇论文、笔记和 PDF 上传到当前账号。原本机资料会保留，虚构演示条目不迁移。</p><p id="migration-progress" class="source-label">准备就绪</p><div class="modal-actions"><button class="button secondary" data-close>暂不迁移</button><button class="button primary" id="confirm-migrate">开始迁移</button></div></div>`,
  );
  $('#confirm-migrate').onclick = async (e) => {
    e.target.disabled = true;
    let count = 0;
    try {
      const ids = new Set(source.papers.map((p) => p.id));
      for (const p of source.papers) {
        $('#migration-progress').textContent =
          `正在迁移 ${++count} / ${source.papers.length}：${p.title}`;
        const file = await source.getFile(p.id);
        const record = structuredClone(p);
        delete record.cloudVersion;
        delete record.hasFile;
        delete record.syncPending;
        await persistPaper(record);
        if (file) await cloud.uploadFile(record, file);
        if (!getPaper(record.id)) papers.push(record);
      }
      collections = [
        ...new Map(
          [...collections, ...(source.settings.collections || [])].map((c) => [c.id, c]),
        ).values(),
      ];
      customEdges = [
        ...new Map(
          [
            ...customEdges,
            ...(source.settings.customEdges || []).filter(
              (edge) => ids.has(edge.source) && ids.has(edge.target),
            ),
          ].map((edge) => [edge.id, edge]),
        ).values(),
      ];
      await persistSettings();
      source.close();
      legacyLibrary = null;
      $('#modal').close();
      renderMigration();
      render();
      await cloud.sync();
      toast(cloud.pending.length ? '资料已保留，部分内容等待同步。' : '旧版资料已迁移到本机服务。');
    } catch (error) {
      $('#migration-progress').textContent =
        '迁移未完成：' + error.message + '。原本机资料仍然保留。';
      e.target.disabled = false;
    }
  };
}
function downloadBlob(blob, name) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 5000);
}
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result.split(',')[1]);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}
function showExport() {
  openModal(
    `<div class="modal-inner">${modalHeader('导出与备份')}<p class="modal-subtitle">资料已保存在本机数据目录。你也可以另存一份完整备份，包含 PDF、笔记和关联。</p><div class="help-copy"><p>当前有 <strong>${papers.length}</strong> 篇论文、<strong>${papers.filter((p) => !p.demo).length}</strong> 个导入的 PDF。</p><p>“仅导出资料”包含论文信息、类别、集合、高亮笔记与手动关联，不含 PDF 原文件。</p></div><div class="modal-actions"><button class="button secondary" id="export-meta">仅导出资料</button><button class="button primary" id="export-full">${icon('download')}完整备份（含 PDF）</button></div><p class="note-hint" id="export-progress"></p></div>`,
  );
  $('#export-meta').onclick = () => exportBackup(false);
  $('#export-full').onclick = () => exportBackup(true);
}
async function exportBackup(full) {
  const hint = $('#export-progress');
  if (hint) hint.textContent = '正在准备导出…';
  try {
    const files = {};
    if (full) {
      for (const p of papers.filter((p) => !p.demo)) {
        const file = await dbGet('files', p.id);
        if (!file) throw new Error('缺少 PDF：' + p.title);
        files[p.id] = await blobToBase64(file);
      }
    }
    const backup = {
      format: 'paperloom-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      includesPDF: full,
      papers,
      collections,
      customEdges,
      categories: categoryOverrides,
      files,
    };
    downloadBlob(
      new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
      `Paperloom-${new Date().toISOString().slice(0, 10)}${full ? '-full' : ''}.json`,
    );
    if (hint) hint.textContent = '导出已准备完成，请查看浏览器下载。';
    toast(full ? '完整备份已导出。' : '论文资料与笔记已导出。');
  } catch (e) {
    if (hint) hint.textContent = '导出失败：' + e.message;
  }
}
async function restoreBackup(file) {
  try {
    if (file.size > 300 * 1024 * 1024) throw new Error('备份过大，请使用小于 300 MB 的备份');
    const b = JSON.parse(await file.text());
    if (
      b.format !== 'paperloom-backup' ||
      b.version !== 1 ||
      !Array.isArray(b.papers) ||
      !Array.isArray(b.collections) ||
      !Array.isArray(b.customEdges)
    )
      throw new Error('不是支持的 Paperloom 备份');
    if (b.papers.length > 5000) throw new Error('该备份条目过多');
    const validIds = new Set();
    for (const p of b.papers) {
      if (
        !p ||
        typeof p.id !== 'string' ||
        typeof p.title !== 'string' ||
        !Array.isArray(p.tags) ||
        !Array.isArray(p.authors) ||
        !Array.isArray(p.topics) ||
        !Array.isArray(p.collectionIds)
      )
        throw new Error('备份中的论文格式不正确');
      if (validIds.has(p.id)) throw new Error('备份中有重复论文 ID');
      validIds.add(p.id);
      for (const arr of [p.authors, p.tags, p.topics, p.collectionIds])
        if (arr.some((v) => typeof v !== 'string')) throw new Error('备份字段无效');
      for (const field of [
        'abstract',
        'affiliation',
        'journal',
        'doi',
        'note',
        'filename',
        'metadataSource',
      ])
        if (p[field] != null && typeof p[field] !== 'string') throw new Error('备份文本字段无效');
      p.x = Number.isFinite(p.x) ? Math.max(30, Math.min(930, p.x)) : 400;
      p.y = Number.isFinite(p.y) ? Math.max(150, Math.min(650, p.y)) : 350;
      p.year =
        Number.isInteger(Number(p.year)) && Number(p.year) >= 1600 && Number(p.year) <= 2100
          ? Number(p.year)
          : null;
      p.status = ['unread', 'reading', 'read'].includes(p.status) ? p.status : 'unread';
    }
    for (const c of b.collections) {
      if (
        typeof c?.id !== 'string' ||
        typeof c.name !== 'string' ||
        !/^#[0-9a-f]{6}$/i.test(c.color)
      )
        throw new Error('备份集合格式不正确');
    }
    for (const e of b.customEdges) {
      if (
        typeof e?.id !== 'string' ||
        typeof e.source !== 'string' ||
        typeof e.target !== 'string' ||
        e.type !== 'manual' ||
        typeof e.reason !== 'string'
      )
        throw new Error('备份关联格式不正确');
    }
    const skippedDemo = b.papers.filter((p) => p.demo).length;
    b.papers = b.papers.filter((p) => !p.demo);
    const keptIds = new Set([...papers.map((p) => p.id), ...b.papers.map((p) => p.id)]);
    b.customEdges = b.customEdges.filter(
      (edge) => keptIds.has(edge.source) && keptIds.has(edge.target),
    );
    let added = 0;
    for (const p of b.papers) {
      const encoded = b.files?.[p.id];
      if (encoded) {
        const binary = atob(encoded);
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        if (new TextDecoder().decode(bytes.slice(0, 1024)).indexOf('%PDF-') === -1)
          throw new Error('备份中的 PDF 无效');
        await dbPut('files', new Blob([bytes], { type: 'application/pdf' }), p.id);
      }
      if (!getPaper(p.id)) {
        delete p.cloudVersion;
        delete p.hasFile;
        delete p.syncPending;
        papers.push(p);
        await persistPaper(p);
        added++;
      }
      if (encoded) {
        const file = await dbGet('files', p.id);
        if (file) await cloud.uploadFile(getPaper(p.id), file);
      }
    }
    categoryOverrides = mergeCategories(categoryOverrides, b.categories || []);
    for (const c of b.collections) if (!collections.some((v) => v.id === c.id)) collections.push(c);
    for (const e of b.customEdges) if (!customEdges.some((v) => v.id === e.id)) customEdges.push(e);
    await persistSettings();
    $('#modal').close();
    render();
    toast(
      `备份已合并，新增 ${added} 篇论文。已有条目的笔记保留。${skippedDemo ? '演示条目未迁移。' : ''}`,
    );
  } catch (e) {
    toast('恢复失败：' + e.message);
  } finally {
    $('#restore-input').value = '';
  }
}
const reader = new PdfReader({
  host: $('#pdf-reader'),
  getFile: (id) => cloud.getFile(id),
  onOpened: (p) => recordPaperOpened(p),
  onSave: (p) => persistPaper(p),
  onClose: () => {
    if (location.hash.startsWith('#read='))
      history.replaceState(null, '', location.pathname + location.search);
    render();
  },
});
const paperGraph = new PaperGraph({
  svg: $('#graph'),
  onSelect: (id) => openPDF(getPaper(id)),
  categoryColor: (id) => topics.find((c) => c.id === id)?.color,
  onEdge: showEdge,
  onClear: () => ($('#edge-tooltip').hidden = true),
  topicName,
});
$('#sync-status').onclick = showSync;
$('#migrate-local').onclick = migrateLegacy;
$('#legacy-backup-help').onclick = showHelp;
$('#empty-import').onclick = showImport;
$('#reload-library').onclick = () => location.reload();
$('#search').oninput = (e) => {
  state.query = e.target.value;
  renderSummary();
  renderList();
  renderGraph();
};
$('#year-filter').onchange = (e) => {
  state.year = e.target.value;
  render();
};
$$('[data-nav]').forEach(
  (b) =>
    (b.onclick = () => {
      state.nav = b.dataset.nav;
      state.collection = '';
      if (state.nav === 'trash') {
        state.query = '';
        state.categories.clear();
        state.year = '';
        $('#search').value = '';
        state.selected = trash[0]?.id || '';
      } else if (getPaper(state.selected)?.deletedAt) state.selected = papers[0]?.id || '';
      render();
    }),
);
$('#list-view').onclick = () => {
  state.view = 'list';
  renderSummary();
  renderList();
};
$('#graph-view').onclick = () => {
  state.view = 'graph';
  renderSummary();
  renderGraph();
};
$$('.edge-filters input').forEach(
  (c) =>
    (c.onchange = () => {
      c.checked ? state.edgeTypes.add(c.value) : state.edgeTypes.delete(c.value);
      $('#edge-tooltip').hidden = true;
      renderGraph();
    }),
);
$('#clear-search').onclick = () => {
  state.query = '';
  state.categories.clear();
  state.year = '';
  $('#search').value = '';
  render();
};
$('#manage-categories').onclick = manageCategories;
$('#manage-categories-inline').onclick = manageCategories;
$('#import').onclick = showImport;
$('#file-input').onchange = (e) => importFiles([...e.target.files]);
$('#restore-input').onchange = (e) => {
  if (e.target.files[0]) restoreBackup(e.target.files[0]);
};
$('#export').onclick = showExport;
$('#add-collection').onclick = createCollection;
$('#help').onclick = showHelp;
$('#demo-info').onclick = showHelp;
$('.brand').onclick = (e) => {
  e.preventDefault();
  state.nav = 'all';
  state.collection = '';
  state.query = '';
  state.categories.clear();
  state.year = '';
  $('#search').value = '';
  render();
};
$('#modal').addEventListener('click', (e) => {
  if (e.target === $('#modal')) {
    const r = $('#modal').getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
      $('#modal').close();
  }
});
$('#modal').addEventListener('close', () => {
  if (previewURL) {
    URL.revokeObjectURL(previewURL);
    previewURL = '';
  }
});
document.addEventListener('click', (e) => {
  if (!e.composedPath().includes($('#account-menu'))) $('#account-menu').open = false;
  if (!e.composedPath().includes($('#category-filter-menu')))
    $('#category-filter-menu').open = false;
});
document.addEventListener('focusin', (e) => {
  if (!e.target.closest('#account-menu')) $('#account-menu').open = false;
  if (!e.target.closest('#category-filter-menu')) $('#category-filter-menu').open = false;
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('#category-filter-menu').open) {
    $('#category-filter-menu').open = false;
    $('#category-filter-menu > summary').focus();
  }
  if (e.key === 'Escape' && $('#account-menu').open) {
    $('#account-menu').open = false;
    $('#account-trigger').focus();
  }
  if (reader.isOpen) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    $('#search').focus();
  }
  if (e.key === 'Escape') $('#detail-panel').classList.remove('mobile-open');
});
document.addEventListener('dragover', (e) => {
  if ([...e.dataTransfer.types].includes('Files')) e.preventDefault();
});
document.addEventListener('drop', (e) => {
  if (!e.target.closest('#dropzone') && e.dataTransfer.files.length) {
    e.preventDefault();
    showImport();
    importFiles([...e.dataTransfer.files]);
  }
});
window.addEventListener('popstate', () => {
  const id = location.hash.startsWith('#read=') ? decodeURIComponent(location.hash.slice(6)) : '';
  if (id && getPaper(id)) openPDF(getPaper(id));
  else if (reader.isOpen) reader.close(false).then(() => render());
});
await init();
if (location.hash.startsWith('#read=')) {
  const p = getPaper(decodeURIComponent(location.hash.slice(6)));
  if (p) openPDF(p);
}
