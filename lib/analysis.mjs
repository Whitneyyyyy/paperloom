import { assignBroadCategory } from './categories.mjs';
export const ANALYSIS_VERSION = 5;
const category = (id, name, kind, terms) => ({
  id,
  name,
  kind,
  terms: terms.split('|'),
  color: '#666666',
});
export const CATEGORIES = [
  category(
    'building-defects',
    '建筑与结构检测',
    'domain',
    'facade|façade|facadefixer|building inspection|building defect|bridge inspection|bridge visual inspection|bridge damage|crack|spalling|concrete damage|structural health|pavement distress|外立面|建筑缺陷|建筑检测|桥梁损伤|桥梁检测|裂缝|剥落|筑安智巡|结构健康',
  ),
  category(
    'civil',
    '土木与工程建造',
    'domain',
    'civil engineering|construction management|building information model|construction site|infrastructure maintenance|digital twin|土木工程|工程建造|施工管理|数字孪生|建筑信息模型',
  ),
  category(
    'vision',
    '计算机视觉',
    'method',
    'image segmentation|instance segmentation|semantic segmentation|object detection|image captioning|visual inspection|computer vision|image recognition|segment anything|图像分割|实例分割|语义分割|目标检测|图像描述|视觉检测|计算机视觉',
  ),
  category(
    'agents',
    '大模型与智能体',
    'method',
    'large language model|multimodal large|vision language model|language model|llm|ai agent|ai agents|autonomous agent|agentic|retrieval augmented|prompting|大语言模型|多模态大模型|大模型|智能体|提示词|检索增强',
  ),
  category(
    'learning',
    '机器学习',
    'method',
    'machine learning|deep learning|neural network|neural networks|artificial intelligence|transformer|representation learning|contrastive learning|机器学习|深度学习|神经网络|人工智能|对比学习',
  ),
  category(
    'federated',
    '联邦与隐私学习',
    'method',
    'federated learning|federated optimization|privacy preserving|differential privacy|decentralized learning|联邦学习|差分隐私|隐私保护|去中心化学习',
  ),
  category(
    'nlp',
    '自然语言处理',
    'method',
    'natural language processing|text classification|text mining|question answering|machine translation|text generation|sentiment analysis|自然语言处理|文本分类|文本挖掘|问答|机器翻译',
  ),
  category(
    'science',
    '科研方法与科学计量',
    'domain',
    'scientists|science of science|scientific discovery|scientific impact|research impact|scientific research|scientific literature|research papers|scientometric|bibliometric|meta science|科学计量|科研效率|科学发现|科研工具|学术影响',
  ),
  category(
    'remote',
    '遥感与地理信息',
    'domain',
    'remote sensing|satellite|landsat|sentinel|earth observation|geospatial|geographic information|photogrammetry|遥感|卫星|地理信息|摄影测量',
  ),
  category(
    'heat',
    '城市热环境',
    'domain',
    'urban heat|heat island|urban cooling|thermal comfort|heat exposure|land surface temperature|城市热|热岛|城市降温|热舒适|热暴露|地表温度',
  ),
  category(
    'climate',
    '气候与环境',
    'domain',
    'climate change|climate adaptation|climate extremes|heatwave|heat wave|dust|air pollution|carbon emission|气候变化|气候适应|极端天气|热浪|沙尘|空气污染|碳排放',
  ),
  category(
    'mobility',
    '人类活动与出行',
    'domain',
    'human mobility|population mobility|activity space|travel behavior|daily mobility|dynamic population|人类活动|人口流动|人类移动|出行行为|动态人口',
  ),
  category(
    'urban',
    '城市规划与可持续发展',
    'domain',
    'urban planning|urban development|urban resilience|green infrastructure|sustainable cities|neighborhood|城市规划|城市韧性|绿色基础设施|城市可持续',
  ),
  category(
    'materials',
    '材料与力学',
    'domain',
    'material science|composite material|fracture mechanics|mechanical properties|microstructure|nanomaterial|alloy|材料科学|复合材料|断裂力学|力学性能|微观结构|纳米材料|合金',
  ),
  category(
    'energy',
    '能源与电力',
    'domain',
    'renewable energy|solar energy|photovoltaic|wind power|battery|energy storage|power grid|hydrogen|可再生能源|太阳能|光伏|风能|电池|储能|电网|氢能',
  ),
  category(
    'health',
    '医学与公共健康',
    'domain',
    'public health|clinical|patient|medical imaging|disease|epidemiology|population health|公共健康|公共卫生|临床|患者|医学影像|疾病|流行病',
  ),
  category(
    'biology',
    '生命科学',
    'domain',
    'genome|genomic|protein|cellular|gene expression|microbiome|bioinformatics|基因组|蛋白质|细胞|基因表达|微生物|生物信息',
  ),
  category(
    'ecology',
    '生态与农业',
    'domain',
    'biodiversity|ecosystem|ecological|crop|agriculture|vegetation dynamics|forest|生物多样性|生态系统|生态学|作物|农业|植被动态|森林',
  ),
  category(
    'water',
    '水文与水资源',
    'domain',
    'hydrology|flood|groundwater|watershed|water quality|water resource|水文|洪水|地下水|流域|水质|水资源',
  ),
  category(
    'transport',
    '交通与运输',
    'domain',
    'traffic flow|transportation|road network|traffic prediction|intelligent transport|autonomous driving|交通流|交通运输|道路网络|交通预测|自动驾驶',
  ),
  category(
    'robotics',
    '机器人与控制',
    'domain',
    'robotics|robotic|motion planning|control system|manipulator|机器人|运动规划|控制系统|机械臂',
  ),
  category(
    'economics',
    '经济与金融',
    'domain',
    'econometric|economic growth|financial market|asset pricing|monetary|金融|计量经济|经济增长|资产定价|货币政策',
  ),
  category(
    'education',
    '教育与学习科学',
    'domain',
    'student learning|educational|education|teaching|learning analytics|教育|学生学习|教学|学习分析',
  ),
  category(
    'social',
    '社会与行为科学',
    'domain',
    'sociology|social behavior|psychology|psychological|social inequality|社会学|社会行为|心理学|社会不平等',
  ),
  category(
    'optimization',
    '优化与运筹',
    'method',
    'mathematical optimization|integer programming|combinatorial optimization|operations research|数理优化|整数规划|组合优化|运筹学',
  ),
  category(
    'software',
    '软件与计算系统',
    'domain',
    'software engineering|distributed system|database system|cloud computing|computer network|cybersecurity|软件工程|分布式系统|数据库|云计算|网络安全',
  ),
  category('other', '其他研究', 'other', ''),
];
const concept = (id, label, terms, specificity = 2) => ({
  id,
  label,
  terms: terms.split('|'),
  specificity,
});
export const CONCEPTS = [
  concept('facade', '建筑外立面', 'facade|façade|facadefixer|外立面|筑安智巡', 3),
  concept('cracks', '裂缝检测', 'crack|cracks|裂缝', 3),
  concept('spalling', '剥落检测', 'spalling|剥落', 3),
  concept(
    'bridge',
    '桥梁检测',
    'bridge inspection|bridge visual inspection|bridge damage|桥梁检测|桥梁损伤',
    3,
  ),
  concept(
    'defects',
    '缺陷检测',
    'defect detection|defect assessment|defect segmentation|building defect|damage detection|缺陷检测|缺陷分割|损伤检测',
    3,
  ),
  concept(
    'segmentation',
    '图像分割',
    'image segmentation|instance segmentation|semantic segmentation|crack segmentation|defect segmentation|segmentation mask|图像分割|实例分割|语义分割|裂缝分割',
    3,
  ),
  concept('sam', 'SAM 基础模型', 'segment anything|sepsam|sam model|sam framework|提示分割', 3),
  concept(
    'captioning',
    '图像描述',
    'image captioning|damage description|image text alignment|图像描述|损伤描述|图文对齐',
    3,
  ),
  concept('uav', '无人机观测', 'uav|unmanned aerial|drone|无人机', 3),
  concept('digital-twin', '数字孪生', 'digital twin|数字孪生', 3),
  concept('dataset', '数据集与基准', 'benchmark|dataset|datasets|数据集|基准', 1),
  concept(
    'domain-knowledge',
    '领域知识',
    'domain knowledge|knowledge driven|domain specific knowledge|领域知识|知识驱动',
    3,
  ),
  concept(
    'multimodal',
    '多模态学习',
    'multimodal|multi modal|image text|vision language|多模态|图文',
    2,
  ),
  concept('large-language', '大语言模型', 'large language model|llm|大语言模型|大模型', 2),
  concept('agents', '智能体', 'ai agent|ai agents|autonomous agent|agentic|智能体', 3),
  concept(
    'prompting',
    '提示学习',
    'prompting|prompt learning|prompt engineering|提示学习|提示词|提示工程',
    2,
  ),
  concept('federated', '联邦学习', 'federated learning|联邦学习', 3),
  concept('privacy', '隐私保护', 'privacy preserving|differential privacy|隐私保护|差分隐私', 3),
  concept(
    'transfer',
    '迁移与跨域',
    'transfer learning|cross domain|domain adaptation|zero shot|迁移学习|跨域|域适应|零样本',
    2,
  ),
  concept('deep-learning', '深度学习', 'deep learning|neural network|深度学习|神经网络', 1),
  concept(
    'research-tools',
    '科研工具',
    'research papers|scientific literature|scientists|scientific research|科研工具|科学家|科研效率',
    2,
  ),
  concept(
    'scientific-impact',
    '科研影响与科学计量',
    'scientific impact|research impact|bibliometric|scientometric|science of science|scientists impact|科学计量|科研影响',
    3,
  ),
  concept('satellite', '卫星遥感', 'satellite|remote sensing|landsat|sentinel|卫星|遥感', 2),
  concept(
    'urban-heat',
    '城市热环境',
    'urban heat|heat island|land surface temperature|城市热|热岛|地表温度',
    3,
  ),
  concept('heat-exposure', '热暴露', 'heat exposure|heat stress|热暴露|热应激', 3),
  concept('adaptation', '气候适应', 'climate adaptation|climate resilience|气候适应|气候韧性', 2),
  concept(
    'green',
    '绿色基础设施',
    'green infrastructure|urban vegetation|tree cover|绿色基础设施|城市植被|树冠',
    3,
  ),
  concept(
    'mobility',
    '人类移动',
    'human mobility|population mobility|daily mobility|人类移动|人口流动|出行',
    3,
  ),
  concept(
    'compound',
    '复合极端事件',
    'compound event|compound heat|compound extreme|复合极端|复合事件',
    3,
  ),
  concept('health', '健康风险', 'health risk|public health|population health|健康风险|公共健康', 2),
  concept(
    'carbon',
    '碳与能源',
    'carbon emission|carbon neutrality|renewable energy|碳排放|碳中和|可再生能源',
    3,
  ),
  concept(
    'prediction',
    '预测建模',
    'forecasting|prediction model|time series prediction|预测模型|时间序列预测',
    1,
  ),
  concept(
    'review',
    '综述与知识整合',
    'systematic review|literature review|meta analysis|系统综述|文献综述|元分析',
    2,
  ),
];
const categoryMap = new Map(CATEGORIES.map((c) => [c.id, c]));
const conceptMap = new Map(CONCEPTS.map((c) => [c.id, c]));
export const categoryName = (id) => categoryMap.get(id)?.name || id;
export const normalizeText = (value) =>
  String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, '$1')
    .replace(/[\p{Pd}_/]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const patterns = new Map();
function contains(text, term) {
  const value = normalizeText(term);
  if (!value) return false;
  if (/[\u3400-\u9fff]/.test(value)) return text.includes(value);
  let re = patterns.get(value);
  if (!re) {
    re = new RegExp(
      '(?:^|[^a-z0-9])' + value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:s|es)?(?=$|[^a-z0-9])',
      'i',
    );
    patterns.set(value, re);
  }
  return re.test(text);
}
const STOP = new Set(
  'the a an of and or for to in on with from by as at is are was were be been this that these those it its their our we they using based study studies research paper papers approach method methods model models results proposed propose framework data learning deep analysis effect effects application applications new through into between under towards toward via can may all also than such has have had not more most used use existing different'.split(
    ' ',
  ),
);
export function tokenize(value) {
  const n = normalizeText(value);
  const english = (n.match(/[a-z][a-z0-9]{2,}/g) || [])
    .filter((w) => !STOP.has(w))
    .map((w) => (w.length > 5 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
  const chinese = n.match(/[\u3400-\u9fff]{2,}/g) || [];
  const words = [...english];
  if (chinese.length) {
    const segmenter =
      typeof Intl.Segmenter === 'function'
        ? new Intl.Segmenter('zh', { granularity: 'word' })
        : null;
    for (const s of chinese) {
      if (segmenter)
        for (const part of segmenter.segment(s)) {
          if (part.isWordLike && part.segment.length > 1) words.push(part.segment);
        }
      else for (let i = 0; i < s.length - 1; i++) words.push(s.slice(i, i + 2));
    }
  }
  return words;
}
export function analyzePaper(paper) {
  if (paper.analysisSource === 'manual' && paper.topics?.length)
    return assignBroadCategory({ ...paper, analysisVersion: ANALYSIS_VERSION });
  const title = normalizeText(paper.title),
    abstract = normalizeText(paper.abstract),
    tags = normalizeText((paper.tags || []).join(' ')),
    body = normalizeText(paper.textExcerpt || '').slice(0, 16000);
  const scoreTerms = (terms) =>
    terms.reduce(
      (sum, term) =>
        sum +
        (contains(title, term) ? 7 : 0) +
        (contains(abstract, term) ? 3 : 0) +
        (contains(tags, term) ? 4 : 0) +
        (contains(body, term) ? 1 : 0),
      0,
    );
  const ranked = CATEGORIES.filter((c) => c.kind !== 'other')
    .map((c) => ({ ...c, score: scoreTerms(c.terms) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const domains = ranked.filter((c) => c.kind === 'domain' && c.score >= 6);
  const primary = domains[0] || ranked[0];
  const topicIds = primary
    ? [
        primary.id,
        ...ranked
          .filter((c) => c.id !== primary.id && c.score >= 3)
          .slice(0, 2)
          .map((c) => c.id),
      ]
    : ['other'];
  const matched = CONCEPTS.map((c) => ({ ...c, score: scoreTerms(c.terms) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score * b.specificity - a.score * a.specificity);
  const explicit = (paper.tags || [])
    .map((t) => String(t).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const auto = matched.slice(0, 9).map((c) => c.label);
  if (!auto.length && topicIds[0] !== 'other') auto.push(categoryName(topicIds[0]));
  if (!auto.length) {
    const counts = new Map();
    for (const w of tokenize(paper.title)) counts.set(w, (counts.get(w) || 0) + 1);
    auto.push(
      ...[...counts]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([w]) => w),
    );
  }
  return assignBroadCategory({
    ...paper,
    topics: topicIds,
    tags: [...new Map([...explicit, ...auto].map((t) => [normalizeText(t), t])).values()].slice(
      0,
      24,
    ),
    concepts: matched.slice(0, 18).map((c) => c.id),
    analysisVersion: ANALYSIS_VERSION,
    analysisSource: 'automatic',
  });
}
function countsFor(paper) {
  const counts = new Map();
  const add = (text, weight) => {
    for (const w of tokenize(text)) counts.set(w, (counts.get(w) || 0) + weight);
  };
  add(paper.title, 3);
  add((paper.tags || []).join(' '), 2);
  add((paper.abstract || '').slice(0, 5000), 1);
  return counts;
}
const normalizedAuthor = (name) => normalizeText(name).replace(/[^a-z\u3400-\u9fff]/g, '');
export function buildRelations(input, manual = []) {
  const papers = input.filter((p) => !p.deletedAt),
    ids = new Set(papers.map((p) => p.id));
  const result = manual
    .filter((e) => ids.has(e.source) && ids.has(e.target))
    .map((e) => ({ ...e }));
  const seen = new Set(result.map((e) => [e.source, e.target, e.type].join('|')));
  const add = (e) => {
    const key = [e.source, e.target, e.type].join('|');
    if (!seen.has(key)) {
      seen.add(key);
      result.push(e);
    }
  };
  const vocabulary = new Map(),
    vectors = new Map();
  for (const p of papers) {
    const counts = countsFor(p);
    vectors.set(p.id, counts);
    for (const token of counts.keys()) vocabulary.set(token, (vocabulary.get(token) || 0) + 1);
  }
  const norms = new Map();
  for (const [id, vector] of vectors) {
    let norm = 0;
    for (const [token, count] of vector) {
      const value =
        (1 + Math.log(count)) *
        (1 + Math.log((papers.length + 1) / ((vocabulary.get(token) || 0) + 1)));
      vector.set(token, value);
      norm += value * value;
    }
    norms.set(id, Math.sqrt(norm));
  }
  const candidates = [];
  for (let i = 0; i < papers.length; i++)
    for (let j = i + 1; j < papers.length; j++) {
      const a = papers[i],
        b = papers[j],
        pair = [a.id, b.id].sort();
      const shared = (a.concepts || []).filter((c) => (b.concepts || []).includes(c));
      const specific = shared.filter((c) => (conceptMap.get(c)?.specificity || 0) >= 2);
      const sameDomain =
        a.topics?.[0] === b.topics?.[0] && categoryMap.get(a.topics?.[0])?.kind === 'domain';
      let dot = 0;
      const common = [];
      for (const [token, value] of vectors.get(a.id)) {
        const other = vectors.get(b.id).get(token);
        if (other) {
          dot += value * other;
          common.push({ token, weight: value * other });
        }
      }
      const cosine = dot / ((norms.get(a.id) || 1) * (norms.get(b.id) || 1));
      const categoryLabels = new Set(CATEGORIES.map((c) => normalizeText(c.name)));
      const tags = (a.tags || []).filter(
        (t) =>
          !categoryLabels.has(normalizeText(t)) &&
          normalizeText(t).length > 3 &&
          (b.tags || []).some((v) => normalizeText(v) === normalizeText(t)) &&
          !/^(deep learning|machine learning|深度学习|机器学习|人工智能|data|dataset|model)$/.test(
            normalizeText(t),
          ),
      );
      const score = Math.min(
        1,
        cosine * 0.55 +
          Math.min(
            0.5,
            specific.reduce((s, c) => s + (conceptMap.get(c)?.specificity === 3 ? 0.18 : 0.1), 0),
          ) +
          (sameDomain ? 0.18 : 0) +
          (tags.length ? 0.08 : 0),
      );
      if (
        (specific.some((c) => conceptMap.get(c)?.specificity === 3) && score >= 0.24) ||
        (specific.length >= 2 && score >= 0.28) ||
        (cosine >= 0.25 && common.length >= 4) ||
        (tags.length >= 1 && cosine >= 0.16 && common.length >= 3)
      ) {
        const clues = specific.slice(0, 3).map((c) => conceptMap.get(c).label);
        if (sameDomain) clues.unshift(categoryName(a.topics[0]));
        if (!clues.length) clues.push(...tags.slice(0, 2));
        if (!clues.length)
          clues.push(
            ...common
              .sort((x, y) => y.weight - x.weight)
              .slice(0, 3)
              .map((v) => v.token),
          );
        candidates.push({
          id: 'auto-' + pair.join('-'),
          source: pair[0],
          target: pair[1],
          type: 'topic',
          score,
          reason: '研究内容相关：' + [...new Set(clues)].join('、'),
          automatic: true,
        });
      }
      const authors = (a.authors || []).filter((name) => {
        const normalized = normalizedAuthor(name);
        return (
          normalized.length >= 6 &&
          !/^(testauthor|secondauthor|unknown|etal)$/.test(normalized) &&
          (b.authors || []).some((n) => normalizedAuthor(n) === normalized)
        );
      });
      if (authors.length)
        add({
          id: 'author-' + pair.join('-'),
          source: pair[0],
          target: pair[1],
          type: 'author',
          reason: '作者姓名相同：' + authors.join('、'),
          automatic: true,
        });
      for (const [citing, cited] of [
        [a, b],
        [b, a],
      ])
        if (
          cited.doi &&
          (citing.referenceDois || []).some((d) => normalizeText(d) === normalizeText(cited.doi))
        )
          add({
            id: 'cite-' + citing.id + '-' + cited.id,
            source: citing.id,
            target: cited.id,
            type: 'citation',
            reason: '参考文献中包含 DOI：' + cited.doi,
            automatic: true,
          });
    }
  const degree = new Map();
  for (const edge of candidates.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))) {
    if ((degree.get(edge.source) || 0) >= 5 && (degree.get(edge.target) || 0) >= 5) continue;
    add(edge);
    degree.set(edge.source, (degree.get(edge.source) || 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) || 0) + 1);
  }
  return result;
}
