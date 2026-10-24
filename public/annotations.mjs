export const HIGHLIGHT_COLORS = {
  yellow: { name: '黄色', value: '#efd45b', fill: 'rgba(239,212,91,.32)' },
  green: { name: '绿色', value: '#79bc8a', fill: 'rgba(121,188,138,.29)' },
  blue: { name: '蓝色', value: '#7eafe1', fill: 'rgba(126,175,225,.30)' },
  pink: { name: '粉色', value: '#df94b4', fill: 'rgba(223,148,180,.29)' },
  purple: { name: '紫色', value: '#b49cd8', fill: 'rgba(180,156,216,.29)' },
};
export function normalizedRect(rect, page) {
  const x = Math.max(0, Math.min(1, (rect.left - page.left) / page.width)),
    y = Math.max(0, Math.min(1, (rect.top - page.top) / page.height)),
    right = Math.min(1, (rect.right - page.left) / page.width),
    bottom = Math.min(1, (rect.bottom - page.top) / page.height);
  if (right <= x || bottom <= y) return null;
  return { x, y, width: right - x, height: bottom - y };
}
export function validateAnnotations(value) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 1000) throw Error('高亮笔记数量或格式无效');
  const ids = new Set();
  return value.map((a) => {
    if (
      !a ||
      typeof a.id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(a.id) ||
      ids.has(a.id) ||
      !Number.isInteger(a.page) ||
      a.page < 1 ||
      a.page > 20000 ||
      !HIGHLIGHT_COLORS[a.color] ||
      !Array.isArray(a.rects) ||
      !a.rects.length ||
      a.rects.length > 200
    )
      throw Error('高亮笔记格式无效');
    ids.add(a.id);
    const rects = a.rects.map((r) => {
      if (
        !r ||
        !['x', 'y', 'width', 'height'].every((k) => Number.isFinite(r[k])) ||
        r.x < 0 ||
        r.y < 0 ||
        r.width <= 0 ||
        r.height <= 0 ||
        r.x + r.width > 1.001 ||
        r.y + r.height > 1.001
      )
        throw Error('高亮位置无效');
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    const text = (v, max) => {
      if (v == null) return '';
      if (typeof v !== 'string' || v.length > max) throw Error('高亮笔记文本过长或格式无效');
      return v;
    };
    return {
      id: a.id,
      page: a.page,
      color: a.color,
      rects,
      quote: text(a.quote, 8000),
      note: text(a.note, 12000),
      createdAt: text(a.createdAt, 100),
      updatedAt: text(a.updatedAt, 100),
    };
  });
}
