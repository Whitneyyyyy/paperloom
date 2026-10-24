import { validateAnnotations } from './annotations.mjs';
import { readingStatus, validateReadingActivity } from './reading-state.mjs';
import { lookupPublication, normalizeDoi } from './publication.mjs';
import { CATEGORIES, ANALYSIS_VERSION, analyzePaper } from './analysis.mjs';
const MAX_PDF = 30 * 1024 * 1024;
const MAX_JSON = 2 * 1024 * 1024;
const safeId = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const noCache = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
class HttpError extends Error {
  constructor(status, message, code = 'REQUEST_FAILED', extra = {}) {
    super(message);
    Object.assign(this, { status, code, extra });
  }
}
const fail = (status, message, code, extra) => {
  throw new HttpError(status, message, code, extra);
};
const json = (value, status = 200) => Response.json(value, { status, headers: noCache });

async function limitedBody(request, limit) {
  const size = Number(request.headers.get('content-length'));
  if (size > limit) fail(413, '文件或资料超过大小限制', 'TOO_LARGE');
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader(),
    chunks = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > limit) {
        await reader.cancel();
        fail(413, '文件或资料超过大小限制', 'TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
async function readJson(request) {
  const bytes = await limitedBody(request, MAX_JSON);
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    fail(400, '资料格式不是有效 JSON', 'INVALID_JSON');
  }
}
function str(value, max = 2000) {
  if (value == null) return '';
  if (typeof value !== 'string' || value.length > max)
    fail(400, '文本字段过长或格式无效', 'INVALID_DOCUMENT');
  return value;
}
function strings(value, maxItems = 80, maxLength = 200) {
  if (!Array.isArray(value) || value.length > maxItems)
    fail(400, '列表字段格式无效', 'INVALID_DOCUMENT');
  return [...new Set(value.map((v) => str(v, maxLength).trim()).filter(Boolean))];
}
export function validatePaper(value, id) {
  if (!value || typeof value !== 'object' || !safeId(id) || value.id !== id)
    fail(400, '论文标识无效', 'INVALID_DOCUMENT');
  const title = str(value.title, 1500).trim();
  if (!title) fail(400, '请填写论文标题', 'INVALID_DOCUMENT');
  const year = value.year == null || value.year === '' ? null : Number(value.year);
  if (year !== null && (!Number.isInteger(year) || year < 1600 || year > 2100))
    fail(400, '发表年份无效', 'INVALID_DOCUMENT');
  const topics = strings(value.topics || [], 8, 40);
  if (topics.some((t) => !CATEGORIES.some((c) => c.id === t)))
    fail(400, '研究主题无效', 'INVALID_DOCUMENT');
  const collectionIds = strings(value.collectionIds || [], 100, 100);
  if (collectionIds.some((v) => !safeId(v))) fail(400, '集合标识无效', 'INVALID_DOCUMENT');
  const hash = str(value.hash, 64);
  if (hash && !/^[a-f0-9]{64}$/.test(hash)) fail(400, '文件指纹无效', 'INVALID_DOCUMENT');
  let annotations, readingActivity;
  try {
    annotations = validateAnnotations(value.annotations);
  } catch (error) {
    fail(400, error.message, 'INVALID_ANNOTATION');
  }
  try {
    readingActivity = validateReadingActivity(value.readingActivity);
  } catch (error) {
    fail(400, error.message, 'INVALID_READING_ACTIVITY');
  }
  const categoryId = str(value.categoryId, 100);
  if (categoryId && !safeId(categoryId)) fail(400, '类别标识无效', 'INVALID_CATEGORY');
  const record = {
    id,
    title,
    year,
    annotations,
    categoryId,
    categorySource: value.categorySource === 'manual' ? 'manual' : 'automatic',
    authors: strings(value.authors || [], 200, 300),
    affiliation: str(value.affiliation, 5000),
    journal: str(value.journal, 1000),
    doi: str(value.doi, 300),
    abstract: str(value.abstract, 20000),
    tags: strings(value.tags || [], 80, 200),
    topics,
    collectionIds,
    hash,
    filename: str(value.filename, 500),
    note: str(value.note, 50000),
    metadataSource: str(value.metadataSource, 4000),
    demo: value.demo === true,
    reviewed: value.reviewed === true,
    starred: value.starred === true,
    status: ['unread', 'reading', 'read'].includes(value.status) ? value.status : 'unread',
    x: Number.isFinite(value.x) ? Math.max(30, Math.min(930, value.x)) : 450,
    y: Number.isFinite(value.y) ? Math.max(150, Math.min(650, value.y)) : 350,
    importedAt: str(value.importedAt, 100),
    textExcerpt: str(value.textExcerpt, 16000),
    concepts: strings(value.concepts || [], 30, 100),
    referenceDois: strings(value.referenceDois || [], 100, 300),
    analysisVersion: Number.isInteger(value.analysisVersion) ? value.analysisVersion : 0,
    analysisSource: value.analysisSource === 'manual' ? 'manual' : 'automatic',
  };
  record.readingActivity = readingActivity;
  record.publisher = str(value.publisher, 1000);
  record.publicationSource = str(value.publicationSource, 100);
  record.publicationCheckedVersion = Number.isInteger(value.publicationCheckedVersion)
    ? Math.max(0, Math.min(100, value.publicationCheckedVersion))
    : 0;
  record.status = readingStatus({ ...record, status: value.status });
  return record.analysisVersion >= ANALYSIS_VERSION && record.topics.length
    ? record
    : analyzePaper(record);
}
export function validateSettings(value) {
  if (
    !value ||
    !Array.isArray(value.collections) ||
    !Array.isArray(value.customEdges) ||
    value.collections.length > 300 ||
    value.customEdges.length > 3000
  )
    fail(400, '集合或关联资料格式无效', 'INVALID_SETTINGS');
  const collections = value.collections.map((c) => {
    if (!safeId(c.id) || !/^#[0-9a-f]{6}$/i.test(c.color))
      fail(400, '研究集合无效', 'INVALID_SETTINGS');
    return { id: c.id, name: str(c.name, 100), color: c.color };
  });
  const customEdges = value.customEdges.map((e) => {
    if (
      !safeId(e.id) ||
      !safeId(e.source) ||
      !safeId(e.target) ||
      e.source === e.target ||
      e.type !== 'manual'
    )
      fail(400, '论文关联无效', 'INVALID_SETTINGS');
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'manual',
      reason: str(e.reason, 2000),
      demo: false,
    };
  });
  const categories = value.categories || [];
  if (!Array.isArray(categories) || categories.length > 100)
    fail(400, '类别数量或格式无效', 'INVALID_CATEGORY');
  const categoryIds = new Set();
  const cleanCategories = categories.map((c) => {
    if (!c || !safeId(c.id) || categoryIds.has(c.id) || !/^#[0-9a-f]{6}$/i.test(c.color))
      fail(400, '类别格式无效', 'INVALID_CATEGORY');
    categoryIds.add(c.id);
    const name = str(c.name, 60).trim();
    if (!name) fail(400, '类别名称不能为空', 'INVALID_CATEGORY');
    return { id: c.id, name, color: c.color, updatedAt: str(c.updatedAt, 100) };
  });
  return { collections, customEdges, categories: cleanCategories };
}
const versionOf = (v) => {
  if (!Number.isInteger(v) || v < 0) fail(400, '缺少有效的资料版本', 'INVALID_VERSION');
  return v;
};
const paperRow = (row) => ({
  ...JSON.parse(row.document),
  cloudVersion: row.version,
  hasFile: !!row.file_key,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at || null,
});
export function createLibraryHandler(bindings, resolveUser, { publicationFetch = fetch } = {}) {
  return async function handle(request) {
    try {
      const url = new URL(request.url),
        pathname = url.pathname.replace(/\/$/, '');
      const user = await resolveUser(request);
      if (!user?.userId) fail(401, '请先登录以访问本机服务论文库', 'AUTH_REQUIRED');
      const owner = user.userId;
      if (!['GET', 'HEAD'].includes(request.method)) {
        const origin = request.headers.get('origin');
        if (origin && origin !== url.origin) fail(403, '请求来源不匹配', 'INVALID_ORIGIN');
      }
      if (pathname === '/api/session' && request.method === 'GET')
        return json({
          user: {
            userId: owner,
            email: user.email || '',
            displayName: user.displayName || user.email || '我的账号',
          },
        });
      if (!bindings.DB || !bindings.BUCKET)
        fail(503, '本机服务存储尚未就绪，请稍后重试', 'STORAGE_UNAVAILABLE');
      const db = bindings.DB,
        bucket = bindings.BUCKET;
      if (pathname === '/api/translate' && request.method === 'POST') {
        return json(
          { error: '翻译已改为本机运行，请刷新页面使用。', code: 'TRANSLATION_MOVED_TO_DEVICE' },
          410,
        );
      }
      if (pathname === '/api/publication' && request.method === 'POST') {
        const body = await readJson(request),
          doi = normalizeDoi(body.doi);
        if (!doi) fail(400, 'DOI 格式无效', 'INVALID_DOI');
        return json(await lookupPublication(doi, publicationFetch));
      }
      if (pathname === '/api/library' && request.method === 'GET') {
        const [result, settings] = await Promise.all([
          db
            .prepare(
              'SELECT document, version, file_key, updated_at, deleted_at FROM papers WHERE owner_id = ? ORDER BY updated_at DESC, id',
            )
            .bind(owner)
            .all(),
          db
            .prepare(
              'SELECT document, version, updated_at FROM library_settings WHERE owner_id = ?',
            )
            .bind(owner)
            .first(),
        ]);
        const records = result.results.map(paperRow);
        return json({
          papers: records.filter((p) => !p.deletedAt),
          trash: records.filter((p) => p.deletedAt),
          settings: settings
            ? {
                ...JSON.parse(settings.document),
                version: settings.version,
                updatedAt: settings.updated_at,
              }
            : { collections: [], customEdges: [], categories: [], version: 0 },
        });
      }
      if (pathname === '/api/settings' && request.method === 'PUT') {
        const body = await readJson(request),
          version = versionOf(body.version),
          settings = validateSettings(body.settings),
          now = new Date().toISOString();
        const result =
          version === 0
            ? await db
                .prepare(
                  'INSERT INTO library_settings (owner_id, document, version, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT (owner_id) DO NOTHING',
                )
                .bind(owner, JSON.stringify(settings), now)
                .run()
            : await db
                .prepare(
                  'UPDATE library_settings SET document = ?, version = version + 1, updated_at = ? WHERE owner_id = ? AND version = ?',
                )
                .bind(JSON.stringify(settings), now, owner, version)
                .run();
        if (!result.meta?.changes) {
          const current = await db
            .prepare('SELECT document, version FROM library_settings WHERE owner_id = ?')
            .bind(owner)
            .first();
          fail(409, '集合在其他设备上有更新', 'VERSION_CONFLICT', {
            current: current ? { ...JSON.parse(current.document), version: current.version } : null,
          });
        }
        return json({ ...settings, version: version + 1, updatedAt: now });
      }
      const match = pathname.match(/^\/api\/papers\/([a-zA-Z0-9_-]{1,100})(\/(?:pdf|restore))?$/);
      if (!match) fail(404, '未找到该接口', 'NOT_FOUND');
      const id = match[1],
        pdf = match[2] === '/pdf',
        restore = match[2] === '/restore';
      if (
        (!pdf && !restore && request.method === 'DELETE') ||
        (restore && request.method === 'POST')
      ) {
        const body = await readJson(request),
          version = versionOf(body.version);
        const row = await db
          .prepare(
            'SELECT document, version, file_key, updated_at, deleted_at FROM papers WHERE owner_id = ? AND id = ?',
          )
          .bind(owner, id)
          .first();
        if (!row) fail(404, '未找到这篇论文', 'NOT_FOUND');
        if (row.version !== version)
          fail(409, '这篇论文已在其他设备更新，请刷新后重试', 'VERSION_CONFLICT', {
            current: paperRow(row),
          });
        const now = new Date().toISOString(),
          deletedAt = restore ? null : now;
        const update = await db
          .prepare(
            'UPDATE papers SET deleted_at = ?, version = version + 1, updated_at = ? WHERE owner_id = ? AND id = ? AND version = ?',
          )
          .bind(deletedAt, now, owner, id, version)
          .run();
        if (!update.meta?.changes) fail(409, '论文状态已改变，请刷新后重试', 'VERSION_CONFLICT');
        return json({
          paper: { ...paperRow(row), cloudVersion: version + 1, updatedAt: now, deletedAt },
        });
      }
      if (!pdf && !restore && request.method === 'PUT') {
        const body = await readJson(request),
          version = versionOf(body.version),
          paper = validatePaper(body.paper, id),
          now = new Date().toISOString();
        const existing = await db
          .prepare(
            'SELECT document, version, file_key, updated_at, deleted_at FROM papers WHERE owner_id = ? AND id = ?',
          )
          .bind(owner, id)
          .first();
        if (existing?.deleted_at)
          fail(410, '这篇论文已移入回收站，不能用旧修改覆盖', 'PAPER_DELETED', {
            current: paperRow(existing),
          });
        const result =
          version === 0
            ? await db
                .prepare(
                  'INSERT INTO papers (owner_id, id, document, version, updated_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT (owner_id, id) DO NOTHING',
                )
                .bind(owner, id, JSON.stringify(paper), now)
                .run()
            : await db
                .prepare(
                  'UPDATE papers SET document = ?, version = version + 1, updated_at = ? WHERE owner_id = ? AND id = ? AND version = ?',
                )
                .bind(JSON.stringify(paper), now, owner, id, version)
                .run();
        if (!result.meta?.changes) {
          const current = await db
            .prepare(
              'SELECT document, version, file_key, updated_at, deleted_at FROM papers WHERE owner_id = ? AND id = ?',
            )
            .bind(owner, id)
            .first();
          fail(409, '这篇论文已在其他设备上更新，本机修改已保留', 'VERSION_CONFLICT', {
            current: current ? paperRow(current) : null,
          });
        }
        return json({ version: version + 1, updatedAt: now, paper });
      }
      if (pdf) {
        const row = await db
          .prepare(
            'SELECT document, version, file_key, file_size, updated_at, deleted_at FROM papers WHERE owner_id = ? AND id = ?',
          )
          .bind(owner, id)
          .first();
        if (!row || row.deleted_at) fail(404, '未找到这篇论文或已移入回收站', 'NOT_FOUND');
        if (request.method === 'PUT') {
          if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/pdf'))
            fail(415, '请选择 PDF 文件', 'INVALID_PDF');
          const bytes = await limitedBody(request, MAX_PDF);
          if (!new TextDecoder().decode(bytes.subarray(0, 1024)).includes('%PDF-'))
            fail(415, '文件内容不是有效 PDF', 'INVALID_PDF');
          const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
            .map((v) => v.toString(16).padStart(2, '0'))
            .join('');
          const paper = JSON.parse(row.document);
          if (paper.hash && paper.hash !== digest)
            fail(422, 'PDF 与这篇论文的文件指纹不匹配', 'HASH_MISMATCH');
          const ownerKey = [
            ...new Uint8Array(
              await crypto.subtle.digest('SHA-256', new TextEncoder().encode(owner)),
            ),
          ]
            .map((v) => v.toString(16).padStart(2, '0'))
            .join('');
          const key = `papers/${ownerKey}/${id}/${digest}.pdf`;
          await bucket.put(key, bytes, {
            httpMetadata: { contentType: 'application/pdf' },
            customMetadata: { paperId: id },
          });
          const update = await db
            .prepare('UPDATE papers SET file_key = ?, file_size = ? WHERE owner_id = ? AND id = ?')
            .bind(key, bytes.length, owner, id)
            .run();
          if (!update.meta?.changes) fail(409, '论文记录已改变，请重试', 'FILE_UPDATE_FAILED');
          return json({ hasFile: true, size: bytes.length });
        }
        if (request.method === 'GET') {
          if (!row.file_key)
            fail(404, 'PDF 尚未上传完成，请回到原设备重试同步', 'FILE_NOT_UPLOADED');
          const file = await bucket.get(row.file_key);
          if (!file) fail(404, 'PDF 文件不可用，请从备份恢复', 'FILE_MISSING');
          const name = JSON.parse(row.document).filename || 'paper.pdf';
          return new Response(file.body, {
            headers: {
              ...noCache,
              'Content-Type': 'application/pdf',
              'Content-Disposition': `inline; filename="paper.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`,
            },
          });
        }
      }
      fail(405, '不支持此操作', 'METHOD_NOT_ALLOWED');
    } catch (error) {
      if (error instanceof HttpError)
        return json({ error: error.message, code: error.code, ...error.extra }, error.status);
      console.error('Library request failed:', error?.message || 'unknown');
      return json(
        { error: '本机服务保存暂时不可用，本机资料将保留，请重试', code: 'SERVER_ERROR' },
        500,
      );
    }
  };
}
