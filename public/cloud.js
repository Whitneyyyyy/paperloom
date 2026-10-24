import { mergeCategories } from './categories.mjs?v=5.0';
const copy = (v) => structuredClone(v);
const safeMessage = (e) => e?.message || '网络连接不可用';
const put = (db, store, value, key) =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const s = tx.objectStore(store);
    key === undefined ? s.put(value) : s.put(value, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('本机缓存保存失败'));
  });
const read = (db, store, key) =>
  new Promise((resolve, reject) => {
    const r = db.transaction(store).objectStore(store).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
const all = (db, store) =>
  new Promise((resolve, reject) => {
    const r = db.transaction(store).objectStore(store).getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
const remove = (db, store, key) =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
function openCache(name) {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(name, 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('papers', { keyPath: 'id' });
      d.createObjectStore('files');
      d.createObjectStore('settings');
      d.createObjectStore('pending', { keyPath: 'key' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}
async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.error || `请求失败 (${response.status})`, response.status, body);
  }
  return response.json();
}
const jsonPut = (data) => ({
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

function uploadPdf(path, blob, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', path);
    xhr.withCredentials = true;
    xhr.timeout = 180000;
    xhr.setRequestHeader('Content-Type', 'application/pdf');
    xhr.upload.onprogress = (e) =>
      onProgress({
        phase: 'uploading',
        loaded: e.loaded,
        total: e.lengthComputable ? e.total : blob.size,
      });
    xhr.upload.onload = () => onProgress({ phase: 'saving', loaded: blob.size, total: blob.size });
    xhr.onerror = () => reject(new ApiError('网络中断，PDF 已暂存本机，联网后重试', 0, {}));
    xhr.ontimeout = () => reject(new ApiError('上传超时，PDF 已暂存本机，稍后重试', 0, {}));
    xhr.onabort = () => reject(new ApiError('上传已中断', 0, {}));
    xhr.onload = () => {
      let body = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else reject(new ApiError(body.error || 'PDF 上传失败', xhr.status, body));
    };
    onProgress({ phase: 'uploading', loaded: 0, total: blob.size });
    xhr.send(blob);
  });
}

export class CloudLibrary {
  constructor({ onStatus = () => {}, onRefresh = () => {}, onTransfer = () => {} } = {}) {
    this.onStatus = onStatus;
    this.onRefresh = onRefresh;
    this.onTransfer = onTransfer;
    this.db = null;
    this.user = null;
    this.online = false;
    this.queue = new Map();
    this.lastWritten = new Map();
    this.inflight = 0;
    this.settings = { collections: [], customEdges: [], categories: [], version: 0 };
    this.pending = [];
    this.localPreview = ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname);
  }
  async status() {
    if (this.db) this.pending = (await all(this.db, 'pending')).filter((v) => !v.suspended);
    this.onStatus({
      online: this.online,
      inflight: this.inflight,
      pending: this.pending.length,
      conflicts: this.pending.filter((v) => v.conflict).length,
      user: this.user,
      localPreview: this.localPreview,
    });
  }
  async start() {
    let user;
    try {
      ({ user } = await api('/api/session'));
      localStorage.setItem('paperloom-last-user', JSON.stringify(user));
    } catch (error) {
      if (error.status) throw error;
      try {
        user = JSON.parse(localStorage.getItem('paperloom-last-user'));
      } catch {}
      if (!user?.userId) throw error;
    }
    this.user = user;
    this.db = await openCache('paperloom-open-source-v1-' + user.userId);
    let snapshot;
    try {
      snapshot = await this.fetchSnapshot();
      this.online = true;
    } catch (error) {
      const cached = await all(this.db, 'papers');
      const settings = await read(this.db, 'settings', 'workspace');
      if (!cached.length && !settings) throw error;
      snapshot = {
        papers: cached.filter((p) => !p.deletedAt),
        trash: cached.filter((p) => p.deletedAt),
        settings: settings || this.settings,
      };
      this.online = false;
    }
    this.settings = snapshot.settings;
    await this.status();
    window.addEventListener('online', () => this.sync());
    window.addEventListener('focus', () => this.sync());
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.sync();
    });
    this.timer = setInterval(() => {
      if (!document.hidden) this.sync();
    }, 30000);
    return snapshot;
  }
  async fetchSnapshot() {
    const snapshot = await api('/api/library');
    const pending = await all(this.db, 'pending'),
      local = await all(this.db, 'papers');
    const records = new Map(
      [...(snapshot.papers || []), ...(snapshot.trash || [])].map((p) => [p.id, p]),
    );
    for (const previous of local) {
      const remote = records.get(previous.id);
      if (remote && (previous.cloudVersion || 0) > (remote.cloudVersion || 0))
        records.set(previous.id, previous);
    }
    for (const item of pending.filter((v) => v.type === 'paper')) {
      const remote = records.get(item.data.id);
      if (remote?.deletedAt) {
        item.conflict = true;
        item.current = remote;
        await put(this.db, 'pending', item);
      } else records.set(item.data.id, { ...item.data, syncPending: true });
    }
    const waiting = pending.find((v) => v.type === 'settings');
    if (waiting) snapshot.settings = { ...waiting.data, version: snapshot.settings.version };
    const allRecords = [...records.values()];
    snapshot.papers = allRecords.filter((p) => !p.deletedAt);
    snapshot.trash = allRecords.filter((p) => p.deletedAt);
    for (const p of allRecords) await put(this.db, 'papers', p);
    await put(this.db, 'settings', snapshot.settings, 'workspace');
    return snapshot;
  }
  serialize(id, action) {
    const previous = this.queue.get(id) || Promise.resolve();
    const current = previous.catch(() => {}).then(action);
    this.queue.set(id, current);
    current
      .finally(() => {
        if (this.queue.get(id) === current) this.queue.delete(id);
      })
      .catch(() => {});
    return current;
  }
  async savePaper(paper) {
    const snapshot = copy(paper);
    return this.serialize(paper.id, async () => {
      const cached = await read(this.db, 'papers', paper.id);
      const waiting = await read(this.db, 'pending', 'paper:' + paper.id);
      const version =
        waiting?.version ??
        Math.max(snapshot.cloudVersion || 0, this.lastWritten.get(paper.id) || 0);
      const entry = {
        key: 'paper:' + paper.id,
        type: 'paper',
        data: { ...snapshot, cloudVersion: version, syncPending: true },
        version,
        conflict: waiting?.conflict || false,
      };
      await put(this.db, 'pending', entry);
      await put(this.db, 'papers', entry.data);
      paper.syncPending = true;
      this.inflight++;
      await this.status();
      try {
        if (entry.conflict) return { queued: true, conflict: true };
        const result = await api(
          '/api/papers/' + encodeURIComponent(paper.id),
          jsonPut({ paper: snapshot, version }),
        );
        this.lastWritten.set(paper.id, result.version);
        paper.cloudVersion = result.version;
        paper.updatedAt = result.updatedAt;
        paper.syncPending = false;
        await put(this.db, 'papers', {
          ...snapshot,
          ...result.paper,
          cloudVersion: result.version,
          updatedAt: result.updatedAt,
          syncPending: false,
        });
        await remove(this.db, 'pending', entry.key);
        this.online = true;
        return { queued: false };
      } catch (error) {
        if (error.status === 409 || error.status === 410) {
          entry.conflict = true;
          entry.current = error.body.current;
          await put(this.db, 'pending', entry);
          return { queued: true, conflict: true };
        }
        if (error.status && error.status < 500) {
          entry.error = safeMessage(error);
          await put(this.db, 'pending', entry);
          throw error;
        }
        this.online = false;
        return { queued: true };
      } finally {
        this.inflight--;
        await this.status();
      }
    });
  }
  async saveSettings(settings) {
    return this.serialize('settings', async () => {
      const current = await read(this.db, 'settings', 'workspace');
      let version = current?.version || 0;
      let data = {
        categories: mergeCategories(current?.categories || [], settings.categories || []),
        collections: [
          ...new Map(
            [...(current?.collections || []), ...copy(settings.collections)].map((c) => [c.id, c]),
          ).values(),
        ],
        customEdges: [
          ...new Map(
            [...(current?.customEdges || []), ...copy(settings.customEdges)].map((e) => [e.id, e]),
          ).values(),
        ],
      };
      const entry = { key: 'settings', type: 'settings', data, version };
      await put(this.db, 'pending', entry);
      this.inflight++;
      await this.status();
      try {
        let result;
        try {
          result = await api('/api/settings', jsonPut({ settings: data, version }));
        } catch (error) {
          if (error.status !== 409) throw error;
          const remote = error.body.current || {
            collections: [],
            customEdges: [],
            categories: [],
            version: 0,
          };
          data = {
            categories: mergeCategories(data.categories || [], remote.categories || []),
            collections: [
              ...new Map(
                [...data.collections, ...remote.collections].map((c) => [c.id, c]),
              ).values(),
            ],
            customEdges: [
              ...new Map(
                [...data.customEdges, ...remote.customEdges].map((e) => [e.id, e]),
              ).values(),
            ],
          };
          version = remote.version;
          result = await api('/api/settings', jsonPut({ settings: data, version }));
        }
        this.settings = result;
        await put(this.db, 'settings', result, 'workspace');
        await remove(this.db, 'pending', 'settings');
        this.online = true;
        return result;
      } catch (error) {
        await put(this.db, 'settings', { ...data, version }, 'workspace');
        if (error.status && error.status < 500) throw error;
        this.online = false;
        return { ...data, version };
      } finally {
        this.inflight--;
        await this.status();
      }
    });
  }
  async cacheFile(id, blob) {
    await put(this.db, 'files', blob, id);
  }
  async uploadFile(paper, blob) {
    await this.cacheFile(paper.id, blob);
    return this.serialize(paper.id, async () => {
      const key = 'file:' + paper.id;
      await put(this.db, 'pending', { key, type: 'file', id: paper.id });
      this.inflight++;
      await this.status();
      const progress = (event) =>
        this.onTransfer({
          paperId: paper.id,
          name: paper.filename || paper.title,
          size: blob.size,
          ...event,
        });
      try {
        const waiting = await read(this.db, 'pending', 'paper:' + paper.id);
        if (waiting) {
          progress({ phase: 'queued', message: '资料暂存本机，等待同步' });
          return { queued: true };
        }
        const current = await read(this.db, 'papers', paper.id);
        if (current?.deletedAt) throw new ApiError('论文已在回收站', 410, {});
        await uploadPdf('/api/papers/' + encodeURIComponent(paper.id) + '/pdf', blob, progress);
        paper.hasFile = true;
        const cached = await read(this.db, 'papers', paper.id);
        if (cached) await put(this.db, 'papers', { ...cached, hasFile: true });
        await remove(this.db, 'pending', key);
        this.online = true;
        progress({ phase: 'complete', loaded: blob.size, total: blob.size });
        return { queued: false };
      } catch (error) {
        progress({ phase: error.status ? 'failed' : 'queued', message: safeMessage(error) });
        if (error.status && error.status < 500) {
          await put(this.db, 'pending', {
            key,
            type: 'file',
            id: paper.id,
            error: safeMessage(error),
          });
          throw error;
        }
        this.online = false;
        return { queued: true };
      } finally {
        this.inflight--;
        await this.status();
      }
    });
  }
  async changeTrash(paper, restore) {
    const result = await this.serialize(paper.id, async () => {
      if (await read(this.db, 'pending', 'paper:' + paper.id))
        throw new Error('这篇论文的修改尚未同步，请先点击同步状态完成同步。');
      this.inflight++;
      await this.status();
      try {
        const version = Math.max(paper.cloudVersion || 0, this.lastWritten.get(paper.id) || 0);
        const response = await api(
          '/api/papers/' + encodeURIComponent(paper.id) + (restore ? '/restore' : ''),
          { ...jsonPut({ version }), method: restore ? 'POST' : 'DELETE' },
        );
        this.lastWritten.set(paper.id, response.paper.cloudVersion);
        await put(this.db, 'papers', response.paper);
        if (!restore) await remove(this.db, 'pending', 'file:' + paper.id);
        this.online = true;
        return response.paper;
      } catch (error) {
        if (error.status === 409) throw new Error('其他设备更新了这篇论文，请刷新后重试。');
        throw error;
      } finally {
        this.inflight--;
        await this.status();
      }
    });
    if (restore && !result.hasFile) {
      const file = await read(this.db, 'files', paper.id);
      if (file) await this.uploadFile(result, file);
    }
    return result;
  }
  async deletePaper(paper) {
    return this.changeTrash(paper, false);
  }
  async restorePaper(paper) {
    return this.changeTrash(paper, true);
  }
  async getFile(id) {
    const record = await read(this.db, 'papers', id);
    if (record?.deletedAt) throw new Error('这篇论文已在回收站，请先恢复。');
    const local = await read(this.db, 'files', id);
    if (local) return local;
    const response = await fetch('/api/papers/' + encodeURIComponent(id) + '/pdf', {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || '无法读取 PDF');
    }
    const file = await response.blob();
    await this.cacheFile(id, file);
    return file;
  }
  async sync() {
    if (!this.db || this.syncing || this.inflight) return;
    this.syncing = true;
    try {
      const pending = await all(this.db, 'pending');
      for (const item of pending) {
        if (item.error || item.conflict || item.suspended) continue;
        if (item.type === 'paper') await this.savePaper(item.data);
        else if (item.type === 'settings') await this.saveSettings(item.data);
        else if (item.type === 'file') {
          const p = await read(this.db, 'papers', item.id),
            file = await read(this.db, 'files', item.id);
          if (p && file && !p.deletedAt) await this.uploadFile(p, file);
        }
      }
      const snapshot = await this.fetchSnapshot();
      this.online = true;
      this.settings = snapshot.settings;
      this.onRefresh(snapshot);
    } catch (error) {
      this.online = false;
    } finally {
      this.syncing = false;
      await this.status();
    }
  }
  async listPending() {
    return all(this.db, 'pending');
  }
  async resolveConflict(key, useLocal) {
    const item = await read(this.db, 'pending', key);
    if (!item?.conflict) return;
    const latest = await api('/api/library');
    const remote = [...latest.papers, ...(latest.trash || [])].find((p) => p.id === item.data.id);
    if (useLocal && remote?.deletedAt)
      throw new Error('论文已在本机服务回收站，请先保留本机服务状态，再到回收站恢复。');
    if (useLocal) {
      item.version = remote?.cloudVersion || 0;
      item.data.cloudVersion = item.version;
      item.conflict = false;
      item.error = null;
      await put(this.db, 'pending', item);
      await this.savePaper(item.data);
    } else {
      if (remote) await put(this.db, 'papers', remote);
      await remove(this.db, 'pending', key);
    }
    await this.sync();
  }
  async retryFailed() {
    const items = await all(this.db, 'pending');
    for (const item of items) {
      if (item.error) {
        delete item.error;
        await put(this.db, 'pending', item);
      }
    }
    await this.sync();
  }
}

export async function readLegacyLibrary() {
  const databases = (await indexedDB.databases?.().catch(() => [])) || [];
  if (!databases.some((d) => d.name === 'paperloom-v1')) return null;
  const db = await new Promise((resolve, reject) => {
    const r = indexedDB.open('paperloom-v1', 1);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  try {
    const papers = (await all(db, 'papers')).filter((p) => !p.demo);
    if (!papers.length) return null;
    const settings = await read(db, 'settings', 'workspace');
    return {
      papers,
      settings: settings || { collections: [], customEdges: [] },
      getFile: (id) => read(db, 'files', id),
      close: () => db.close(),
    };
  } catch (error) {
    db.close();
    return null;
  }
}
