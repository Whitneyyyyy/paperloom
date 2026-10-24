import {
  CATEGORY_COLORS,
  edgeWeight,
  layoutGraph,
  graphBounds,
  fitCamera,
  zoomCamera,
} from './graph-model.js?v=5.0';
const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
function lines(text, max = 27) {
  const parts = String(text).match(/[\u3400-\u9fff]|[^\s\u3400-\u9fff]+/g) || [];
  const result = [''];
  for (const part of parts) {
    const i = result.length - 1,
      spacer = /[\u3400-\u9fff]/.test(part) || !result[i] ? '' : ' ';
    if ((result[i] + spacer + part).length > max && result[i]) {
      if (result.length === 3) {
        result[i] = result[i].slice(0, max - 1) + '…';
        break;
      }
      result.push(part.length > max ? part.slice(0, max - 1) + '…' : part);
    } else result[i] += spacer + part;
  }
  return result;
}
export class PaperGraph {
  constructor({ svg, onSelect, onEdge, onClear, topicName, categoryColor }) {
    Object.assign(this, { svg, onSelect, onEdge, onClear, topicName, categoryColor });
    this.camera = { scale: 1, x: 0, y: 0 };
    this.pointers = new Map();
    this.positions = new Map();
    this.signature = '';
    this.width = 0;
    this.height = 0;
    this.data = { papers: [], edges: [] };
    this.suppressClick = false;
    this.resize = new ResizeObserver(() => this.measure());
    this.resize.observe(svg);
    svg.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoom(Math.exp(-Math.max(-150, Math.min(150, e.deltaY)) * 0.006), this.point(e));
      },
      { passive: false },
    );
    svg.addEventListener('pointerdown', (e) => this.down(e));
    svg.addEventListener('pointermove', (e) => this.move(e));
    svg.addEventListener('pointerup', (e) => this.up(e));
    svg.addEventListener('pointercancel', (e) => this.cancel(e));
    svg.addEventListener('lostpointercapture', (e) => this.cancel(e));
    svg.addEventListener('click', (e) => {
      if (this.suppressClick) return;
      const edge = e.target.closest('[data-edge]');
      if (edge) this.onEdge(this.data.edges.find((v) => v.id === edge.dataset.edge));
    });
    svg.addEventListener('keydown', (e) => {
      const n = e.target.closest('[data-node]');
      if (n && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        this.onSelect(n.dataset.node);
        return;
      }
      if (
        ['+', '=', '-', '0', 'f', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
      ) {
        e.preventDefault();
        if (['+', '='].includes(e.key)) this.zoom(1.25);
        else if (e.key === '-') this.zoom(0.8);
        else if (e.key === '0' || e.key === 'f') this.fit();
        else {
          this.camera.x += e.key === 'ArrowLeft' ? 40 : e.key === 'ArrowRight' ? -40 : 0;
          this.camera.y += e.key === 'ArrowUp' ? 40 : e.key === 'ArrowDown' ? -40 : 0;
          this.transform();
        }
      }
    });
    document.querySelector('#zoom-in').onclick = () => this.zoom(1.25);
    document.querySelector('#zoom-out').onclick = () => this.zoom(0.8);
    document.querySelector('#fit').onclick = () => this.fit();
    document.querySelector('#graph-zoom').oninput = (e) =>
      this.zoom(Number(e.target.value) / 100 / this.camera.scale);
    document.querySelector('#rearrange').onclick = () => {
      this.signature = '';
      this.render(this.data);
    };
  }
  get isInteracting() {
    return this.pointers.size > 0;
  }
  point(e) {
    const r = this.svg.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  world(point) {
    return {
      x: (point.x - this.camera.x) / this.camera.scale,
      y: (point.y - this.camera.y) / this.camera.scale,
    };
  }
  measure() {
    const r = this.svg.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    const changed = Math.abs(this.width - r.width) > 1 || Math.abs(this.height - r.height) > 1;
    this.width = r.width;
    this.height = r.height;
    this.svg.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
    if (changed) this.fit();
  }
  transform() {
    this.svg
      .querySelector('#graph-transform')
      .setAttribute(
        'transform',
        `translate(${this.camera.x} ${this.camera.y}) scale(${this.camera.scale})`,
      );
    const percent = Math.round(this.camera.scale * 100);
    document.querySelector('#zoom-level').textContent = percent + '%';
    document.querySelector('#graph-zoom').value = percent;
    document.querySelector('#zoom-in').disabled = this.camera.scale >= 3.999;
    document.querySelector('#zoom-out').disabled = this.camera.scale <= 0.151;
  }
  fit() {
    if (!this.width || !this.positions.size) return;
    this.camera = fitCamera(graphBounds([...this.positions.values()]), this.width, this.height);
    this.transform();
  }
  zoom(factor, point = { x: this.width / 2, y: this.height / 2 }) {
    this.camera = zoomCamera(this.camera, factor, point);
    this.transform();
  }
  render(data) {
    this.data = data;
    const { papers, edges, selected } = data;
    const signature = JSON.stringify([
      papers.map((p) => [p.id, p.topics?.[0]]),
      edges.map((e) => [e.id, e.score, e.source, e.target]),
    ]);
    const changed = this.signature !== signature;
    if (changed) {
      const layout = layoutGraph(papers, edges);
      this.positions = layout.positions;
      this.isolates = layout.isolates;
      this.signature = signature;
    }
    const related = new Set(
      edges
        .filter((e) => e.source === selected || e.target === selected)
        .flatMap((e) => [e.source, e.target]),
    );
    this.svg.querySelector('#edges').innerHTML = edges
      .map(
        (e) =>
          `<path class="graph-edge ${related.size ? (e.source === selected || e.target === selected ? 'highlight' : 'muted') : ''}" data-edge="${esc(e.id)}" stroke="${e.type === 'citation' ? '#657781' : '#b1b8bc'}" style="--edge-width:${(1 + edgeWeight(e) * 2).toFixed(2)}" ${e.type === 'citation' ? 'stroke-dasharray="6 4" marker-end="url(#arrow-citation)"' : e.type === 'manual' ? 'stroke-dasharray="3 5"' : e.type === 'author' ? 'stroke-dasharray="2 3"' : ''}><title>${esc(e.reason)}</title></path>`,
      )
      .join('');
    this.svg.querySelector('#nodes').innerHTML = papers
      .map((p) => {
        const n = this.positions.get(p.id),
          color =
            this.categoryColor?.(p.topics?.[0]) ||
            CATEGORY_COLORS[p.topics?.[0]] ||
            CATEGORY_COLORS.other,
          title = lines(p.title),
          active = p.id === selected;
        return `<g class="graph-node ${active ? 'selected' : ''} ${related.size && !related.has(p.id) ? 'dim' : ''}" data-node="${esc(p.id)}" data-degree="${n.degree}" data-strength="${n.strength.toFixed(3)}" data-isolated="${n.degree === 0}" tabindex="0" role="button" aria-label="${esc(p.title)}" style="--node-color:${color}"><rect x="-103" y="${-n.radius - 10}" width="206" height="${n.radius * 2 + 80}" fill="transparent" stroke="none"/><circle class="node-halo" r="${n.radius + 9}"/><circle class="node-dot" r="${n.radius.toFixed(2)}"/>${active ? `<circle class="node-selection" r="${n.radius + 5}"/>` : ''}<text text-anchor="middle" y="${n.radius + 20}">${title.map((t, i) => `<tspan x="0" dy="${i ? 16 : 0}">${esc(t)}</tspan>`).join('')}</text><text class="node-meta" text-anchor="middle" x="0" y="${n.radius + title.length * 16 + 23}">${esc([p.year, this.topicName(p.topics?.[0] || 'other')].filter(Boolean).join(' · '))}</text><title>${esc(p.title)}\n${n.degree ? `${n.degree} 篇关联论文 · 关联强度 ${n.strength.toFixed(2)}` : '暂无关联，独立保留'}${p.year ? '\n' + p.year : ''}</title></g>`;
      })
      .join('');
    const legend = [...new Set(papers.map((p) => p.topics?.[0] || 'other'))];
    document.querySelector('#graph-legend').innerHTML = legend
      .map(
        (id) =>
          `<span><i style="background:${this.categoryColor?.(id) || CATEGORY_COLORS[id] || CATEGORY_COLORS.other}"></i>${esc(this.topicName(id))}</span>`,
      )
      .join('');
    this.svg.querySelector('#isolate-label').innerHTML = this.isolates?.length
      ? `<text x="${Math.min(...this.isolates.map((id) => this.positions.get(id).x)) - 85}" y="${Math.min(...this.isolates.map((id) => this.positions.get(id).y)) - 45}" class="isolate-label">独立论文 · ${this.isolates.length}</text>`
      : '';
    document.querySelector('#graph-empty').hidden = papers.length > 0;
    document.querySelector('#graph-summary').textContent =
      `${papers.length} 篇论文 · ${edges.length} 条关联${this.isolates?.length ? ' · ' + this.isolates.length + ' 篇独立' : ''}`;
    this.drawPositions();
    this.measure();
    if (changed) this.fit();
    else this.transform();
  }
  drawPositions() {
    for (const el of this.svg.querySelectorAll('[data-node]')) {
      const n = this.positions.get(el.dataset.node);
      el.setAttribute('transform', `translate(${n.x} ${n.y})`);
    }
    for (const el of this.svg.querySelectorAll('[data-edge]')) {
      const e = this.data.edges.find((e) => e.id === el.dataset.edge),
        a = this.positions.get(e.source),
        b = this.positions.get(e.target),
        dx = b.x - a.x,
        dy = b.y - a.y,
        d = Math.hypot(dx, dy) || 1;
      const x1 = a.x + (dx / d) * (a.radius + 2),
        y1 = a.y + (dy / d) * (a.radius + 2),
        x2 = b.x - (dx / d) * (b.radius + 5),
        y2 = b.y - (dy / d) * (b.radius + 5),
        bend = e.type === 'author' ? 12 : e.type === 'citation' ? -12 : 0;
      el.setAttribute(
        'd',
        `M ${x1} ${y1} Q ${(x1 + x2) / 2 - (dy / d) * bend} ${(y1 + y2) / 2 + (dx / d) * bend} ${x2} ${y2}`,
      );
    }
  }
  down(e) {
    this.suppressClick = false;
    if (e.button !== 0 && e.pointerType !== 'touch') return;
    if (e.target.closest('[data-edge]') && e.pointerType !== 'touch') return;
    const point = this.point(e);
    this.pointers.set(e.pointerId, point);
    this.svg.setPointerCapture(e.pointerId);
    this.suppressClick = false;
    this.gesture = {
      node: e.target.closest('[data-node]')?.dataset.node,
      start: point,
      last: point,
      moved: false,
    };
    if (this.pointers.size === 2) this.beginPinch();
    this.svg.classList.add('graph-panning');
  }
  beginPinch() {
    const [a, b] = [...this.pointers.values()];
    this.pinch = {
      distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
    if (this.gesture) this.gesture.moved = true;
  }
  move(e) {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.point(e);
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()],
        center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      if (this.pinch) {
        this.camera = zoomCamera(this.camera, distance / this.pinch.distance, this.pinch.center);
        this.camera.x += center.x - this.pinch.center.x;
        this.camera.y += center.y - this.pinch.center.y;
        this.transform();
      }
      this.pinch = { distance, center };
      this.suppressClick = true;
      return;
    }
    const g = this.gesture;
    if (!g) return;
    const dx = p.x - g.last.x,
      dy = p.y - g.last.y;
    if (Math.hypot(p.x - g.start.x, p.y - g.start.y) > 4) g.moved = true;
    g.last = p;
    if (!g.moved) return;
    this.suppressClick = true;
    if (g.node) {
      const n = this.positions.get(g.node);
      n.x += dx / this.camera.scale;
      n.y += dy / this.camera.scale;
      this.drawPositions();
    } else {
      this.camera.x += dx;
      this.camera.y += dy;
      this.transform();
    }
  }
  up(e) {
    if (!this.pointers.has(e.pointerId)) return;
    const g = this.gesture;
    this.pointers.delete(e.pointerId);
    if (!this.pointers.size) {
      this.svg.classList.remove('graph-panning');
      this.gesture = null;
      if (g && !g.moved && !this.suppressClick) {
        if (g.node) this.onSelect(g.node);
        else this.onClear();
      }
    } else {
      const p = [...this.pointers.values()][0];
      this.gesture = { start: p, last: p, moved: true };
    }
    this.pinch = null;
    try {
      this.svg.releasePointerCapture(e.pointerId);
    } catch {}
  }
  cancel(e) {
    this.pointers.delete(e.pointerId);
    if (!this.pointers.size) {
      this.gesture = null;
      this.pinch = null;
      this.svg.classList.remove('graph-panning');
    }
  }
}
