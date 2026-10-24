import { readerTools } from './reader-tools.js?v=9.0';
import { pdfLibrary } from './pdf-reader.js?v=9.0';
import { HIGHLIGHT_COLORS, normalizedRect } from './annotations.mjs?v=9.0';
const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const palette = (selected, attr) =>
  Object.entries(HIGHLIGHT_COLORS)
    .map(
      ([id, c]) =>
        `<button type="button" class="highlight-color ${selected === id ? 'active' : ''}" ${attr}="${id}" style="--swatch:${c.value};--fill:${c.fill}" aria-label="${c.name}高亮" aria-pressed="${selected === id}" title="${c.name}半透明高亮"><i></i></button>`,
    )
    .join('');
export class PdfReader {
  constructor({ host, getFile, onSave, onClose, onOpened }) {
    Object.assign(this, { host, getFile, onSave, onClose, onOpened });
    this.isOpen = false;
    this.color = 'yellow';
    this.scale = 1;
    this.generation = 0;
    this.saveChain = Promise.resolve();
    this.loaded = new Map();
    this.areaMode = false;
    this.selection = null;
    this.currentPage = 1;
    document.addEventListener('selectionchange', () => {
      clearTimeout(this.selectionTimer);
      if (this.isOpen && !this.areaMode)
        this.selectionTimer = setTimeout(() => this.captureSelection(), 160);
    });
  }
  async open(paper) {
    if (this.isOpen && this.paper?.id === paper.id) return;
    if (this.isOpen) await this.close(false);
    this.isOpen = true;
    this.paper = paper;
    paper.annotations ??= [];
    this.selectedId = '';
    this.editingNoteId = '';
    this.generalNoteOpen = !!paper.note?.trim();
    this.areaMode = false;
    this.generation++;
    this.host.hidden = false;
    document.body.classList.add('reading-paper');
    this.host.classList.toggle('notes-hidden', innerWidth <= 680);
    this.host.innerHTML = `<header class="reader-header"><button id="reader-back" class="button secondary">← 返回论文库</button><div class="reader-title"><small>论文阅读</small><h1>${esc(paper.title)}</h1></div><span id="reader-save-status" role="status">正在打开 PDF…</span><button id="reader-notes-toggle" class="button secondary" aria-expanded="true">笔记</button><button id="reader-download" class="button secondary">下载 PDF</button></header><div class="reader-toolbar"><div class="reader-pages-control"><button id="reader-prev" aria-label="上一页">‹</button><input id="reader-page-number" type="number" min="1" value="1" aria-label="阅读页码"><span id="reader-pages-total">/ —</span><button id="reader-next" aria-label="下一页">›</button></div><div class="reader-zoom-controls"><button id="reader-minus" aria-label="缩小 PDF">−</button><span id="reader-zoom-label">100%</span><button id="reader-plus" aria-label="放大 PDF">+</button><button id="reader-fit">适合宽度</button></div><button id="reader-find-toggle" class="button secondary" title="查找文字 (Ctrl F)">查找</button><span class="reader-toolbar-divider"></span><div class="reader-palette" aria-label="高亮颜色">${palette(this.color, 'data-reader-color')}</div><button id="reader-area" class="button secondary" aria-pressed="false">框选高亮</button><span class="reader-tip">划选文字后高亮或记笔记</span></div><div id="reader-findbar" class="reader-findbar" hidden><input id="reader-find-input" type="search" placeholder="在论文中查找字词…" aria-label="文内关键词" autocomplete="off"><span id="reader-find-count" role="status"></span><button id="reader-find-prev" aria-label="上一个匹配">↑</button><button id="reader-find-next" aria-label="下一个匹配">↓</button><button id="reader-find-close" aria-label="关闭查找">×</button></div><div class="reader-body"><main id="reader-document" class="reader-document" aria-label="PDF 页面"><div class="reader-loading" role="status">正在读取原始 PDF…</div></main><aside id="reader-sidebar" class="reader-sidebar" aria-label="阅读高亮与笔记"></aside></div><div id="selection-toolbar" class="selection-toolbar" hidden><span>已选内容</span><button id="selection-translate">翻译</button><button id="selection-highlight">高亮</button><button id="selection-note">高亮并写笔记</button><button id="selection-cancel" aria-label="取消选择">×</button></div>`;
    this.host.querySelector('#reader-notes-toggle').setAttribute('aria-expanded', innerWidth > 680);
    this.doc = this.host.querySelector('#reader-document');
    this.sidebar = this.host.querySelector('#reader-sidebar');
    this.host.querySelector('#reader-back').onclick = () => this.close();
    this.host.querySelector('#reader-notes-toggle').onclick = (e) => {
      this.host.classList.toggle('notes-hidden');
      e.currentTarget.setAttribute('aria-expanded', !this.host.classList.contains('notes-hidden'));
      if (this.pdf) this.changeScale(this.fitScale());
    };
    this.host.querySelector('#reader-prev').onclick = () => this.goToPage(this.currentPage - 1);
    this.host.querySelector('#reader-next').onclick = () => this.goToPage(this.currentPage + 1);
    this.host.querySelector('#reader-page-number').onchange = (e) =>
      this.goToPage(Number(e.target.value));
    this.host.querySelector('#reader-minus').onclick = () => this.changeScale(this.scale / 1.15);
    this.host.querySelector('#reader-plus').onclick = () => this.changeScale(this.scale * 1.15);
    this.host.querySelector('#reader-fit').onclick = () => this.changeScale(this.fitScale());
    this.host.querySelector('#reader-area').onclick = (e) => {
      this.areaMode = !this.areaMode;
      e.currentTarget.setAttribute('aria-pressed', this.areaMode);
      this.doc.classList.toggle('area-mode', this.areaMode);
      this.clearSelection();
    };
    for (const button of this.host.querySelectorAll('[data-reader-color]'))
      button.onclick = () => {
        this.color = button.dataset.readerColor;
        for (const b of this.host.querySelectorAll('[data-reader-color]')) {
          b.classList.toggle('active', b === button);
          b.setAttribute('aria-pressed', b === button);
        }
        this.host.querySelector('#selection-highlight').style.background =
          HIGHLIGHT_COLORS[this.color].fill;
      };
    const selectionToolbar = this.host.querySelector('#selection-toolbar');
    selectionToolbar.onpointerdown = (e) => e.preventDefault();
    this.host.querySelector('#selection-highlight').onclick = () => this.addSelection(false);
    this.host.querySelector('#selection-note').onclick = () => this.addSelection(true);
    this.host.querySelector('#selection-cancel').onclick = () => this.clearSelection();
    this.doc.addEventListener('pointerup', (e) => {
      if (!this.areaMode) setTimeout(() => this.captureSelection(e), 0);
    });
    this.doc.addEventListener('pointerdown', (e) => this.areaStart(e));
    this.doc.addEventListener('pointermove', (e) => this.areaMove(e));
    this.doc.addEventListener('pointerup', (e) => this.areaEnd(e));
    this.doc.addEventListener('pointercancel', () => {
      this.areaDraft?.element.remove();
      this.areaDraft = null;
    });
    this.doc.addEventListener('scroll', () => {
      if (this.scrollFrame) return;
      this.scrollFrame = requestAnimationFrame(() => {
        this.scrollFrame = 0;
        const viewport = this.doc.getBoundingClientRect();
        let closest = null,
          largest = 0;
        for (const page of this.doc.querySelectorAll('.pdf-page')) {
          const rect = page.getBoundingClientRect(),
            visible = Math.max(
              0,
              Math.min(rect.bottom, viewport.bottom) - Math.max(rect.top, viewport.top),
            );
          if (visible > largest) {
            largest = visible;
            closest = page;
          }
        }
        if (closest) {
          this.currentPage = Number(closest.dataset.page);
          this.host.querySelector('#reader-page-number').value = this.currentPage;
        }
      });
    });
    this.installTools();
    this.renderSidebar();
    const generation = this.generation;
    try {
      const blob = await this.getFile(paper.id);
      if (generation !== this.generation) return;
      this.blob = blob;
      const lib = await pdfLibrary();
      this.lib = lib;
      this.loadingTask = lib.getDocument({
        data: new Uint8Array(await blob.arrayBuffer()),
        isEvalSupported: false,
        useSystemFonts: true,
      });
      this.pdf = await this.loadingTask.promise;
      if (generation !== this.generation) {
        await this.pdf.destroy();
        return;
      }
      const first = await this.pdf.getPage(1),
        v = first.getViewport({ scale: 1 });
      this.baseWidth = v.width;
      this.baseHeight = v.height;
      this.scale = this.fitScale();
      this.host.querySelector('#reader-pages-total').textContent = '/ ' + this.pdf.numPages;
      this.host.querySelector('#reader-page-number').max = this.pdf.numPages;
      this.host.querySelector('#reader-download').onclick = () => {
        const url = URL.createObjectURL(blob),
          link = document.createElement('a');
        link.href = url;
        link.download = paper.filename || 'paper.pdf';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      };
      this.buildPages();
      this.status(paper.syncPending ? '本机资料 · 等待同步' : '笔记随账号保存');
      this.onOpened?.(paper);
      this.save();
    } catch (error) {
      if (generation !== this.generation) return;
      this.doc.innerHTML = `<div class="reader-loading reader-error"><strong>无法打开 PDF</strong><p>${esc(error.message || '请检查网络与上传状态')}</p><button id="reader-retry" class="button secondary">重试打开</button></div>`;
      this.host.querySelector('#reader-retry').onclick = async () => {
        await this.close(false);
        this.open(paper);
      };
      this.status('PDF 尚未打开');
    }
  }
  status(text) {
    if (this.isOpen) this.host.querySelector('#reader-save-status').textContent = text;
  }
  fitScale() {
    return clamp((this.doc.clientWidth - 48) / (this.baseWidth || 595), 0.35, 1.55);
  }
  changeScale(scale) {
    if (!this.pdf) return;
    this.scale = clamp(scale, 0.35, 2.5);
    this.clearSelection();
    this.buildPages(this.currentPage);
  }
  buildPages(goPage = 1) {
    if (this.findResults?.length) this.findPendingScroll = true;
    this.observer?.disconnect();
    this.generation++;
    const generation = this.generation;
    for (const task of this.loaded.values()) task.renderTask?.cancel();
    this.loaded.clear();
    this.doc.innerHTML = '';
    this.host.querySelector('#reader-zoom-label').textContent = Math.round(this.scale * 100) + '%';
    const fragment = document.createDocumentFragment();
    for (let number = 1; number <= this.pdf.numPages; number++) {
      const page = document.createElement('section');
      page.className = 'pdf-page';
      page.dataset.page = number;
      page.style.width = this.baseWidth * this.scale + 'px';
      page.style.height = this.baseHeight * this.scale + 'px';
      page.setAttribute('aria-label', '第 ' + number + ' 页');
      page.innerHTML = `<span class="page-placeholder">第 ${number} 页</span>`;
      fragment.append(page);
    }
    this.doc.append(fragment);
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) this.renderPage(entry.target, generation);
          else this.releasePage(entry.target);
        }
      },
      { root: this.doc, rootMargin: '700px 0px' },
    );
    for (const page of this.doc.children) this.observer.observe(page);
    this.goToPage(goPage);
  }
  async renderPage(container, generation) {
    const number = Number(container.dataset.page);
    if (this.loaded.has(number) || !this.pdf) return;
    const job = { container };
    this.loaded.set(number, job);
    try {
      const page = await this.pdf.getPage(number);
      if (generation !== this.generation || this.loaded.get(number) !== job) return;
      const viewport = page.getViewport({ scale: this.scale }),
        ratio = Math.min(devicePixelRatio || 1, 2),
        canvas = document.createElement('canvas');
      container.style.width = viewport.width + 'px';
      container.style.height = viewport.height + 'px';
      container.style.setProperty('--total-scale-factor', this.scale);
      container.style.setProperty('--scale-round-x', '1px');
      container.style.setProperty('--scale-round-y', '1px');
      canvas.width = Math.ceil(viewport.width * ratio);
      canvas.height = Math.ceil(viewport.height * ratio);
      canvas.style.width = viewport.width + 'px';
      canvas.style.height = viewport.height + 'px';
      canvas.setAttribute('aria-hidden', 'true');
      container.replaceChildren(canvas);
      job.renderTask = page.render({
        canvasContext: canvas.getContext('2d'),
        viewport,
        transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0],
      });
      await job.renderTask.promise;
      if (generation !== this.generation || this.loaded.get(number) !== job) return;
      const text = await page.getTextContent();
      if (generation !== this.generation || this.loaded.get(number) !== job) return;
      const layer = document.createElement('div');
      layer.className = 'textLayer';
      container.append(layer);
      job.textLayer = new this.lib.TextLayer({
        textContentSource: text,
        container: layer,
        viewport,
      });
      await job.textLayer.render();
      job.textReady = true;
      if (!text.items.some((i) => i.str?.trim())) {
        const hint = document.createElement('span');
        hint.className = 'scanned-page-hint';
        hint.textContent = '此页没有可划选文字，可使用“框选高亮”';
        container.append(hint);
      }
      this.drawMarks(number);
      this.drawSearchMarks(number);
    } catch (error) {
      if (
        error.name === 'RenderingCancelledException' ||
        error.name === 'AbortException' ||
        generation !== this.generation ||
        this.loaded.get(number) !== job
      )
        return;
      container.innerHTML = `<div class="page-placeholder">此页暂时无法渲染。切换缩放后可重试。</div>`;
      this.loaded.delete(number);
    }
  }
  releasePage(container) {
    const number = Number(container.dataset.page),
      job = this.loaded.get(number);
    if (!job) return;
    job.renderTask?.cancel();
    job.textLayer?.cancel();
    this.loaded.delete(number);
    container.innerHTML = `<span class="page-placeholder">第 ${number} 页</span>`;
  }
  goToPage(number) {
    if (!this.pdf) return;
    number = clamp(Math.round(number) || 1, 1, this.pdf.numPages);
    this.currentPage = number;
    this.host.querySelector('#reader-page-number').value = number;
    const page = this.doc.querySelector(`[data-page="${number}"]`);
    page?.scrollIntoView({ block: 'start' });
    if (page) this.renderPage(page, this.generation);
  }
  captureSelection() {
    if (!this.isOpen || this.areaMode) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      this.selection = null;
      this.host.querySelector('#selection-toolbar').hidden = true;
      return;
    }
    const range = selection.getRangeAt(0);
    if (!this.doc.contains(range.commonAncestorContainer)) {
      this.selection = null;
      this.host.querySelector('#selection-toolbar').hidden = true;
      return;
    }
    const quote = selection
      .toString()
      .replace(/([a-z])-\s*\n\s*([a-z])/gi, '$1$2')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000);
    if (!quote) return;
    const rects = [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1),
      groups = [];
    for (const page of this.doc.querySelectorAll('.pdf-page')) {
      const box = page.getBoundingClientRect(),
        found = rects
          .filter(
            (r) =>
              r.bottom > box.top && r.top < box.bottom && r.right > box.left && r.left < box.right,
          )
          .map((r) => normalizedRect(r, box))
          .filter(Boolean);
      const unique = [
        ...new Map(
          found.map((r) => [
            Object.values(r)
              .map((n) => n.toFixed(4))
              .join(','),
            r,
          ]),
        ).values(),
      ];
      if (unique.length)
        groups.push({ page: Number(page.dataset.page), rects: unique.slice(0, 200), quote });
    }
    if (!groups.length) return;
    this.selection = groups;
    this.showSelection(range.getBoundingClientRect());
  }
  showSelection(rect) {
    const toolbar = this.host.querySelector('#selection-toolbar');
    toolbar.hidden = false;
    toolbar.style.left = clamp(rect.left, 12, Math.max(12, innerWidth - 295)) + 'px';
    toolbar.style.top = clamp(rect.bottom + 8, 100, innerHeight - 52) + 'px';
    this.host.querySelector('#selection-highlight').style.background =
      HIGHLIGHT_COLORS[this.color].fill;
    this.host.querySelector('#selection-translate').disabled = !this.selection?.[0]?.quote;
  }
  clearSelection() {
    this.selection = null;
    this.host.querySelector('#selection-toolbar').hidden = true;
    window.getSelection()?.removeAllRanges();
  }
  addSelection(writeNote) {
    if (!this.selection?.length) return;
    const now = new Date().toISOString();
    const added = this.selection.map((group) => ({
      id: 'hl-' + crypto.randomUUID(),
      ...group,
      color: this.color,
      note: '',
      createdAt: now,
      updatedAt: now,
    }));
    if (this.paper.annotations.length + added.length > 1000) {
      this.status('本篇高亮已达到 1000 条');
      return;
    }
    this.paper.annotations.push(...added);
    this.selectedId = writeNote ? added[0].id : '';
    this.editingNoteId = writeNote ? added[0].id : '';
    this.clearSelection();
    this.drawMarks();
    this.renderSidebar();
    this.host.classList.remove('notes-hidden');
    this.host.querySelector('#reader-notes-toggle').setAttribute('aria-expanded', 'true');
    this.save();
    if (writeNote) {
      this.host.querySelector('#annotation-note')?.focus();
    }
  }
  areaStart(e) {
    if (!this.areaMode || e.button !== 0) return;
    const page = e.target.closest('.pdf-page');
    if (!page) return;
    e.preventDefault();
    const box = page.getBoundingClientRect(),
      x = clamp(e.clientX - box.left, 0, box.width),
      y = clamp(e.clientY - box.top, 0, box.height),
      element = document.createElement('div');
    element.className = 'area-draft';
    element.style.background = HIGHLIGHT_COLORS[this.color].fill;
    page.append(element);
    this.areaDraft = { page, box, x, y, element, pointerId: e.pointerId };
    page.setPointerCapture(e.pointerId);
  }
  areaMove(e) {
    const d = this.areaDraft;
    if (!d || d.pointerId !== e.pointerId) return;
    const x = clamp(e.clientX - d.box.left, 0, d.box.width),
      y = clamp(e.clientY - d.box.top, 0, d.box.height);
    Object.assign(d.element.style, {
      left: Math.min(x, d.x) + 'px',
      top: Math.min(y, d.y) + 'px',
      width: Math.abs(x - d.x) + 'px',
      height: Math.abs(y - d.y) + 'px',
    });
    d.endX = x;
    d.endY = y;
  }
  areaEnd(e) {
    const d = this.areaDraft;
    if (!d || d.pointerId !== e.pointerId) return;
    this.areaDraft = null;
    try {
      d.page.releasePointerCapture(e.pointerId);
    } catch {}
    const x = d.endX ?? d.x,
      y = d.endY ?? d.y;
    d.element.remove();
    if (Math.abs(x - d.x) < 5 || Math.abs(y - d.y) < 5) return;
    const rect = {
      left: d.box.left + Math.min(x, d.x),
      right: d.box.left + Math.max(x, d.x),
      top: d.box.top + Math.min(y, d.y),
      bottom: d.box.top + Math.max(y, d.y),
    };
    this.selection = [
      { page: Number(d.page.dataset.page), quote: '', rects: [normalizedRect(rect, d.box)] },
    ];
    this.showSelection(rect);
  }
  drawMarks(onlyPage) {
    for (const page of this.doc.querySelectorAll('.pdf-page')) {
      const number = Number(page.dataset.page);
      if (onlyPage && number !== onlyPage) continue;
      page.querySelector('.reader-marks')?.remove();
      if (!page.querySelector('canvas')) continue;
      const layer = document.createElement('div');
      layer.className = 'reader-marks';
      layer.innerHTML = this.paper.annotations
        .filter((a) => a.page === number)
        .map((a) =>
          a.rects
            .map(
              (r) =>
                `<button type="button" class="reader-mark ${a.id === this.selectedId ? 'selected' : ''}" data-annotation="${esc(a.id)}" style="left:${r.x * 100}%;top:${r.y * 100}%;width:${r.width * 100}%;height:${r.height * 100}%;background:${HIGHLIGHT_COLORS[a.color].fill}" aria-label="查看高亮笔记：${esc(a.quote.slice(0, 80) || '区域高亮')}" title="${esc(a.note || a.quote || '点击添加笔记')}"></button>`,
            )
            .join(''),
        )
        .join('');
      page.append(layer);
      for (const button of layer.querySelectorAll('[data-annotation]'))
        button.onclick = (e) => {
          e.stopPropagation();
          this.selectedId = button.dataset.annotation;
          this.editingNoteId = '';
          this.renderSidebar();
          this.drawMarks();
          this.host.classList.remove('notes-hidden');
          this.host.querySelector('#reader-notes-toggle').setAttribute('aria-expanded', 'true');
        };
    }
  }
  renderSidebar() {
    const list = [...this.paper.annotations].sort(
        (a, b) => a.page - b.page || a.createdAt.localeCompare(b.createdAt),
      ),
      selected = list.find((a) => a.id === this.selectedId);
    this.sidebar.innerHTML = `<div class="reader-sidebar-heading"><strong>高亮与笔记</strong><span>${list.length} 处高亮</span></div>${this.translationHtml()}${this.deletedAnnotation ? '<div class="annotation-undo">已删除高亮 <button id="annotation-undo">撤销</button></div>' : ''}<div class="annotation-list">${list.length ? list.map((a) => `<article class="annotation-card ${a.id === this.selectedId ? 'active' : ''}" data-note-card="${esc(a.id)}" style="--annotation-color:${HIGHLIGHT_COLORS[a.color].value}"><button class="annotation-quote" data-note-id="${esc(a.id)}" aria-expanded="${a.id === this.selectedId}"><small>第 ${a.page} 页 · ${HIGHLIGHT_COLORS[a.color].name}高亮</small><p>${esc(a.quote || '区域高亮')}</p></button>${a.note?.trim() && this.editingNoteId !== a.id ? `<p class="annotation-saved-note">${esc(a.note)}</p>` : ''}${a.id === this.selectedId ? `<div class="annotation-card-tools"><div class="annotation-palette">${palette(a.color, 'data-annotation-color')}</div><button id="annotation-delete" aria-label="删除此处高亮" title="删除高亮">删除</button><button id="annotation-close" aria-label="收起高亮操作">×</button></div>${this.editingNoteId === a.id ? `<div class="annotation-inline-editor"><textarea id="annotation-note" maxlength="12000" placeholder="写下你的笔记…" aria-label="高亮笔记">${esc(a.note)}</textarea><div class="annotation-inline-actions"><small>自动保存</small><button id="annotation-save">收起</button></div></div>` : `<div class="annotation-quick-actions"><button id="annotation-edit-note">${a.note?.trim() ? '编辑笔记' : '添加笔记'}</button>${a.quote ? '<button id="annotation-translate">翻译选段</button>' : ''}</div>`}` : ''}</article>`).join('') : '<p class="reader-empty-notes">选中文字后添加高亮，点击高亮可补充笔记。</p>'}</div><details class="reader-general-note" ${this.generalNoteOpen ? 'open' : ''}><summary>整篇论文笔记</summary><textarea id="reader-paper-note" maxlength="50000" aria-label="整篇论文笔记" placeholder="研究问题、核心结论与阅读启发…">${esc(this.paper.note || '')}</textarea><small>自动保存到本机数据目录。</small></details>`;
    for (const button of this.sidebar.querySelectorAll('[data-note-id]'))
      button.onclick = () => {
        const id = button.dataset.noteId;
        this.selectedId = this.selectedId === id ? '' : id;
        this.editingNoteId = '';
        const a = this.paper.annotations.find((a) => a.id === id);
        this.goToPage(a.page);
        this.renderSidebar();
        this.drawMarks();
      };
    this.sidebar.querySelector('.reader-general-note').ontoggle = (e) => {
      this.generalNoteOpen = e.target.open;
    };
    this.sidebar.querySelector('#reader-paper-note').oninput = (e) => {
      this.paper.note = e.target.value;
      this.scheduleSave();
    };
    if (selected) {
      this.sidebar.querySelector('#annotation-close').onclick = () => {
        this.selectedId = '';
        this.editingNoteId = '';
        this.renderSidebar();
        this.drawMarks();
      };
      const input = this.sidebar.querySelector('#annotation-note');
      if (input) {
        input.oninput = (e) => {
          selected.note = e.target.value;
          selected.updatedAt = new Date().toISOString();
          this.scheduleSave();
        };
        this.sidebar.querySelector('#annotation-save').onclick = async () => {
          await this.save();
          this.editingNoteId = '';
          this.renderSidebar();
        };
      }
      const edit = this.sidebar.querySelector('#annotation-edit-note');
      if (edit)
        edit.onclick = () => {
          this.editingNoteId = selected.id;
          this.renderSidebar();
          this.sidebar.querySelector('#annotation-note').focus();
        };
      const translate = this.sidebar.querySelector('#annotation-translate');
      if (translate) translate.onclick = () => this.translateText(selected.quote);
      this.sidebar.querySelector('#annotation-delete').onclick = () => {
        this.deletedAnnotation = structuredClone(selected);
        this.paper.annotations = this.paper.annotations.filter((a) => a.id !== selected.id);
        this.selectedId = '';
        this.editingNoteId = '';
        this.drawMarks();
        this.renderSidebar();
        this.save();
      };
      for (const button of this.sidebar.querySelectorAll('[data-annotation-color]'))
        button.onclick = () => {
          selected.color = button.dataset.annotationColor;
          selected.updatedAt = new Date().toISOString();
          this.drawMarks();
          this.renderSidebar();
          this.save();
        };
    }
    if (this.deletedAnnotation)
      this.sidebar.querySelector('#annotation-undo').onclick = () => {
        this.paper.annotations.push(this.deletedAnnotation);
        this.selectedId = '';
        this.deletedAnnotation = null;
        this.renderSidebar();
        this.drawMarks();
        this.save();
      };
    this.bindTranslation();
  }
  scheduleSave() {
    clearTimeout(this.saveTimer);
    this.dirty = true;
    this.status('正在保存笔记…');
    this.saveTimer = setTimeout(() => this.save(), 600);
  }
  save() {
    clearTimeout(this.saveTimer);
    this.dirty = false;
    const paper = this.paper;
    this.status('正在保存…');
    this.saveChain = this.saveChain
      .catch(() => {})
      .then(async () => {
        try {
          const result = await this.onSave(paper);
          if (this.paper !== paper) return;
          this.status(
            result?.conflict
              ? '本机已保留 · 请返回处理同步冲突'
              : result?.queued
                ? '本机已保存 · 等待本机服务同步'
                : '已保存到本机',
          );
        } catch (error) {
          if (this.paper === paper) this.status('保存未完成：' + error.message);
        }
      });
    return this.saveChain;
  }
  async close(notify = true) {
    if (!this.isOpen) return;
    this.closeTools();
    if (this.dirty) await this.save();
    await this.saveChain;
    this.isOpen = false;
    this.generation++;
    clearTimeout(this.saveTimer);
    clearTimeout(this.selectionTimer);
    this.observer?.disconnect();
    for (const job of this.loaded.values()) {
      job.renderTask?.cancel();
      job.textLayer?.cancel();
    }
    this.loaded.clear();
    if (this.pdf) await this.pdf.destroy();
    else await this.loadingTask?.destroy().catch(() => {});
    this.pdf = null;
    this.host.hidden = true;
    this.host.innerHTML = '';
    this.deletedAnnotation = null;
    document.body.classList.remove('reading-paper');
    if (notify) this.onClose();
  }
}

Object.assign(PdfReader.prototype, readerTools);
