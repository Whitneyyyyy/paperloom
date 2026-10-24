import {
  buildPageSearchIndex,
  findPageMatches,
  normalizeSearchQuery,
} from './pdf-search.mjs?v=9.0';
import { normalizedRect } from './annotations.mjs?v=9.0';
import { LocalTranslator } from './translation.mjs?v=9.0';
const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

export const readerTools = {
  installTools() {
    this.findRequest = (this.findRequest || 0) + 1;
    this.findResults = [];
    this.findIndex = -1;
    this.findCache = new Map();
    this.findCacheSize = 0;
    this.findPendingScroll = false;
    this.translation = null;
    this.translationCache ??= new Map();
    const input = this.host.querySelector('#reader-find-input');
    this.host.querySelector('#reader-find-toggle').onclick = () => this.openFind();
    this.host.querySelector('#reader-find-close').onclick = () => this.closeFind();
    this.host.querySelector('#reader-find-prev').onclick = () =>
      this.navigateFind(this.findIndex - 1);
    this.host.querySelector('#reader-find-next').onclick = () =>
      this.navigateFind(this.findIndex + 1);
    input.oninput = () => {
      clearTimeout(this.findTimer);
      this.findRequest++;
      this.findResults = [];
      this.findIndex = -1;
      this.drawSearchMarks();
      this.findStatus('');
      this.findTimer = setTimeout(() => this.searchDocument(input.value), 220);
    };
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(this.findTimer);
        if (this.findResults.length) this.navigateFind(this.findIndex + (e.shiftKey ? -1 : 1));
        else this.searchDocument(input.value);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this.closeFind();
      }
    };
    if (!this.toolsKeyHandler) {
      this.toolsKeyHandler = (e) => {
        if (!this.isOpen) return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
          e.preventDefault();
          this.openFind();
        }
      };
      document.addEventListener('keydown', this.toolsKeyHandler);
    }
    this.host.querySelector('#selection-translate').onclick = () =>
      this.translateText(this.selection?.[0]?.quote || '');
  },
  closeTools() {
    clearTimeout(this.findTimer);
    this.findRequest++;
    this.translationRequest = (this.translationRequest || 0) + 1;
    this.translationController?.abort();
    this.localTranslator?.close();
    this.findCache?.clear();
  },
  openFind() {
    if (innerWidth <= 680) {
      this.host.classList.add('notes-hidden');
      this.host.querySelector('#reader-notes-toggle').setAttribute('aria-expanded', 'false');
    }
    const bar = this.host.querySelector('#reader-findbar');
    bar.hidden = false;
    const input = this.host.querySelector('#reader-find-input');
    input.focus();
    input.select();
  },
  closeFind() {
    this.host.querySelector('#reader-findbar').hidden = true;
    this.findRequest++;
    clearTimeout(this.findTimer);
    this.findResults = [];
    this.findIndex = -1;
    this.drawSearchMarks();
    this.host.querySelector('#reader-find-toggle').focus();
  },
  findStatus(text) {
    this.host.querySelector('#reader-find-count').textContent = text;
  },
  async searchDocument(value) {
    const query = normalizeSearchQuery(value),
      request = ++this.findRequest,
      pdf = this.pdf;
    this.findResults = [];
    this.findIndex = -1;
    this.findPendingScroll = false;
    this.drawSearchMarks();
    if (!query) {
      this.findStatus('');
      return;
    }
    if (!pdf) {
      this.findStatus('请先打开 PDF');
      return;
    }
    this.findStatus('正在查找…');
    let searchable = false,
      capped = false;
    try {
      for (let number = 1; number <= pdf.numPages; number++) {
        if (!this.isOpen || request !== this.findRequest) return;
        let index = this.findCache.get(number);
        if (!index) {
          const page = await pdf.getPage(number),
            content = await page.getTextContent();
          if (!this.isOpen || request !== this.findRequest) return;
          index = buildPageSearchIndex(content.items);
          this.findCache.set(number, index);
          this.findCacheSize += index.text.length;
          while (this.findCacheSize > 220000 && this.findCache.size > 1) {
            const first = this.findCache.keys().next().value;
            this.findCacheSize -= this.findCache.get(first).text.length;
            this.findCache.delete(first);
          }
        }
        searchable ||= !!index.text;
        const matches = findPageMatches(index, query, 1000 - this.findResults.length);
        this.findResults.push(...matches.map((match) => ({ ...match, page: number })));
        this.findStatus(`正在查找 ${number}/${pdf.numPages} 页…`);
        if (this.findResults.length >= 1000) {
          capped = true;
          break;
        }
      }
      if (request !== this.findRequest || !this.isOpen) return;
      this.findCapped = capped;
      if (this.findResults.length) this.navigateFind(0);
      else this.findStatus(searchable ? '没有匹配结果' : '此 PDF 没有可搜索的文字');
    } catch {
      if (request === this.findRequest && this.isOpen) this.findStatus('查找未完成，请重试');
    }
  },
  navigateFind(index) {
    if (!this.findResults.length) return;
    this.findIndex = (index + this.findResults.length) % this.findResults.length;
    const match = this.findResults[this.findIndex];
    this.findPendingScroll = true;
    this.findStatus(
      `${this.findIndex + 1}/${this.findResults.length}${this.findCapped ? '+' : ''} · 第 ${match.page} 页`,
    );
    this.goToPage(match.page);
    this.drawSearchMarks();
  },
  drawSearchMarks(onlyPage) {
    if (!this.doc) return;
    for (const page of this.doc.querySelectorAll('.pdf-page')) {
      const number = Number(page.dataset.page);
      if (onlyPage && number !== onlyPage) continue;
      page.querySelector('.reader-search-marks')?.remove();
      const job = this.loaded.get(number),
        divs = job?.textReady ? job.textLayer.textDivs : null;
      if (!divs || !this.findResults?.length) continue;
      const layer = document.createElement('div');
      layer.className = 'reader-search-marks';
      const box = page.getBoundingClientRect();
      for (let i = 0; i < this.findResults.length; i++) {
        const match = this.findResults[i];
        if (match.page !== number) continue;
        const start = divs[match.start.item]?.firstChild,
          end = divs[match.end.item]?.firstChild;
        if (start?.nodeType !== 3 || end?.nodeType !== 3) continue;
        const range = document.createRange();
        try {
          range.setStart(start, Math.min(match.start.offset, start.length));
          range.setEnd(end, Math.min(match.end.offset, end.length));
        } catch {
          continue;
        }
        for (const rect of range.getClientRects()) {
          if (rect.width < 1 || rect.height < 1) continue;
          const r = normalizedRect(rect, box);
          if (!r) continue;
          const mark = document.createElement('span');
          mark.className = 'reader-search-hit' + (i === this.findIndex ? ' active' : '');
          mark.dataset.findIndex = i;
          Object.assign(mark.style, {
            left: r.x * 100 + '%',
            top: r.y * 100 + '%',
            width: r.width * 100 + '%',
            height: r.height * 100 + '%',
          });
          layer.append(mark);
        }
      }
      page.append(layer);
      if (this.findPendingScroll) {
        const active = layer.querySelector('.active');
        if (active) {
          this.findPendingScroll = false;
          active.scrollIntoView({ block: 'center', inline: 'nearest' });
        }
      }
    }
  },
  translationHtml() {
    const t = this.translation;
    if (!t) return '';
    const progress =
      t.loading && Number.isFinite(t.progress)
        ? `<progress class="translation-progress" aria-label="翻译模型下载进度" max="1" value="${t.progress}"></progress><small class="translation-progress-label">${Math.round(t.progress * 100)}%</small>`
        : '';
    return `<section class="reader-translation" aria-label="选段翻译"><div class="translation-heading"><strong>选段翻译</strong><select id="reader-translation-target" aria-label="翻译目标语言"><option value="zh-CN" ${t.target === 'zh-CN' ? 'selected' : ''}>中文</option><option value="en" ${t.target === 'en' ? 'selected' : ''}>English</option></select><button id="translation-close" aria-label="关闭翻译">×</button></div><details class="translation-source"><summary>原文</summary><p>${esc(t.quote)}</p></details><div class="translation-result ${t.error ? 'translation-error' : ''}" role="status">${esc(t.loading ? t.message || '正在本机翻译…' : t.error || t.text)}</div>${progress}<div class="translation-footer"><small>本机翻译 · 选段不上传</small>${t.text ? '<button id="translation-copy">复制译文</button>' : t.error ? '<button id="translation-retry">重试</button>' : ''}</div></section>`;
  },
  refreshTranslation() {
    const current = this.sidebar.querySelector('.reader-translation');
    if (!this.translation) {
      current?.remove();
      return;
    }
    if (current) current.outerHTML = this.translationHtml();
    else
      this.sidebar
        .querySelector('.reader-sidebar-heading')
        .insertAdjacentHTML('afterend', this.translationHtml());
    this.bindTranslation();
  },
  bindTranslation() {
    const t = this.translation;
    if (!t) return;
    this.host.querySelector('#translation-close').onclick = () => {
      this.translationController?.abort();
      this.translationRequest++;
      this.translation = null;
      this.refreshTranslation();
    };
    this.host.querySelector('#reader-translation-target').onchange = (e) =>
      this.translateText(t.quote, e.target.value);
    const retry = this.host.querySelector('#translation-retry');
    if (retry) retry.onclick = () => this.translateText(t.quote, t.target);
    const copy = this.host.querySelector('#translation-copy');
    if (copy)
      copy.onclick = async () => {
        try {
          await navigator.clipboard.writeText(t.text);
          copy.textContent = '已复制';
        } catch {
          copy.textContent = '请选择译文复制';
        }
      };
  },
  async translateText(value, target) {
    const quote = String(value || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!quote) return;
    target ??= (quote.match(/\p{Script=Han}/gu) || []).length > quote.length * 0.2 ? 'en' : 'zh-CN';
    this.translationController?.abort();
    this.translationController = new AbortController();
    const request = (this.translationRequest = (this.translationRequest || 0) + 1);
    this.translation = { quote, target, loading: true };
    this.clearSelection();
    this.host.classList.remove('notes-hidden');
    this.host.querySelector('#reader-notes-toggle').setAttribute('aria-expanded', 'true');
    this.refreshTranslation();
    this.sidebar.scrollTop = 0;
    try {
      if (quote.length > 3000) throw Error('选段较长，请每次选择 3000 个字符以内');
      const key = target + '\0' + quote;
      let result = this.translationCache.get(key);
      if (!result) {
        this.localTranslator ??= new LocalTranslator();
        result = await this.localTranslator.translate(quote, target, {
          signal: this.translationController.signal,
          onProgress: (status) => {
            if (!this.isOpen || request !== this.translationRequest) return;
            Object.assign(this.translation, {
              message: status.message,
              progress: status.stage === 'download' ? status.progress : null,
            });
            this.refreshTranslation();
          },
        });
        this.translationCache.set(key, result);
        if (this.translationCache.size > 50)
          this.translationCache.delete(this.translationCache.keys().next().value);
      }
      if (!this.isOpen || request !== this.translationRequest) return;
      this.translation = { quote, target, text: result.text };
    } catch (error) {
      if (!this.isOpen || request !== this.translationRequest || error.name === 'AbortError')
        return;
      this.translation = { quote, target, error: error.message || '本机翻译未完成，请重试' };
    }
    if (this.isOpen && request === this.translationRequest) this.refreshTranslation();
  },
};
