const escape = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const labels = {
  reading: '读取 PDF',
  classifying: '自动分类',
  metadata: '保存论文信息',
  uploading: '正在上传 PDF',
  saving: '本机服务保存中',
  complete: '已上传并保存',
  queued: '等待同步',
  failed: '导入失败',
  duplicate: '已跳过重复文件',
  interrupted: '处理已中断',
};
const finished = new Set(['complete', 'duplicate']);
const bytes = (value) =>
  value >= 1024 * 1024
    ? (value / 1024 / 1024).toFixed(1) + ' MB'
    : Math.round((value || 0) / 1024) + ' KB';
export class ImportTasks {
  constructor({ onRetry = () => {} } = {}) {
    this.jobs = [];
    this.key = '';
    this.onRetry = onRetry;
    this.expanded = false;
    this.button = document.querySelector('#transfer-button');
    this.panel = document.querySelector('#transfer-panel');
    this.button.onclick = () => {
      this.expanded = !this.expanded;
      this.render();
    };
    document.querySelector('#transfer-collapse').onclick = () => {
      this.expanded = false;
      this.render();
    };
  }
  bind(user) {
    this.key = 'paperloom-imports:' + user.userId;
    try {
      this.jobs = JSON.parse(localStorage.getItem(this.key) || '[]')
        .slice(-30)
        .map((j) =>
          finished.has(j.phase) || ['queued', 'failed'].includes(j.phase)
            ? j
            : {
                ...j,
                phase: 'interrupted',
                message: '可点击重试；若原文件未保留，请重新选择 PDF。',
              },
        );
    } catch {
      this.jobs = [];
    }
    this.render();
  }
  save() {
    if (this.key)
      try {
        localStorage.setItem(this.key, JSON.stringify(this.jobs.slice(-30)));
      } catch {}
  }
  add(file) {
    const job = {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      phase: 'reading',
      progress: 0,
      message: '准备读取文件',
      createdAt: Date.now(),
    };
    this.jobs.push(job);
    this.expanded = true;
    this.save();
    this.render();
    return job;
  }
  update(job, patch) {
    Object.assign(job, patch);
    if (job.phase === 'complete') job.progress = 100;
    this.save();
    this.render();
  }
  transfer(event) {
    let job = [...this.jobs].reverse().find((j) => j.paperId === event.paperId);
    if (!job) {
      job = this.add({ name: event.name, size: event.size });
      job.paperId = event.paperId;
    }
    const percent = event.total ? Math.round((event.loaded / event.total) * 100) : 0;
    const progress =
      event.phase === 'complete'
        ? 100
        : event.phase === 'saving'
          ? 96
          : event.phase === 'uploading'
            ? 30 + percent * 0.65
            : job.progress;
    this.update(job, {
      phase: event.phase,
      loaded: event.loaded,
      total: event.total,
      progress,
      message: event.message || '',
      uploadPercent: percent,
    });
  }
  reconcile(papers) {
    for (const job of this.jobs) {
      const p = papers.find((p) => p.id === job.paperId);
      if (p?.hasFile && !p.syncPending && !finished.has(job.phase))
        Object.assign(job, { phase: 'complete', progress: 100, message: '已确认本机服务文件存在' });
    }
    this.save();
    this.render();
  }
  render() {
    const active = this.jobs.filter(
      (j) => !finished.has(j.phase) && !['failed', 'interrupted'].includes(j.phase),
    ).length;
    const done = this.jobs.filter((j) => j.phase === 'complete').length;
    this.button.hidden = !this.jobs.length;
    this.button.textContent = active
      ? `导入任务 ${done}/${this.jobs.length}`
      : `导入记录 ${this.jobs.length}`;
    this.panel.hidden = !this.expanded || !this.jobs.length;
    document.querySelector('#transfer-summary').textContent = active
      ? `${active} 项处理中`
      : `${done} 篇已保存`;
    document.querySelector('#transfer-list').innerHTML = [...this.jobs]
      .reverse()
      .map(
        (job) =>
          `<div class="transfer-item ${escape(job.phase)}"><div class="transfer-item-title"><strong title="${escape(job.name)}">${escape(job.name)}</strong><span>${job.phase === 'complete' ? '✓' : job.phase === 'failed' ? '!' : job.phase === 'duplicate' ? '—' : '○'}</span></div><div class="transfer-stage"><span>${escape(labels[job.phase] || job.phase)}</span><span>${job.phase === 'uploading' ? `${job.uploadPercent || 0}%` : job.phase === 'complete' ? '100%' : ''}</span></div><progress max="100" value="${Math.round(job.progress || 0)}" aria-label="${escape(job.name)} 处理进度"></progress><div class="transfer-detail">${escape(job.phase === 'uploading' ? `${bytes(job.loaded)} / ${bytes(job.total || job.size)}` : job.message || bytes(job.size))}${['failed', 'interrupted', 'queued'].includes(job.phase) ? `<button data-retry-transfer="${escape(job.id)}">重试</button>` : ''}</div></div>`,
      )
      .join('');
    for (const b of this.panel.querySelectorAll('[data-retry-transfer]'))
      b.onclick = () => this.onRetry(this.jobs.find((j) => j.id === b.dataset.retryTransfer));
  }
}
