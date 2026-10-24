const cjk = (char) => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(char || '');
export const normalizeSearchQuery = (text) =>
  String(text || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u00ad\u200b]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// Keep PDF.js text-div offsets; search markers never change selectable text.
export function buildPageSearchIndex(items) {
  let text = '',
    previous = null,
    itemNumber = -1;
  const positions = [];
  const strings = items.filter((item) => typeof item.str === 'string');
  const append = (char, position) => {
    if (/\s/.test(char)) {
      if (text.endsWith(' ') || !text) return;
      char = ' ';
    }
    text += char;
    positions.push(position);
  };
  for (const item of strings) {
    itemNumber++;
    if (!item.str) continue;
    if (previous) {
      const next = item.str.trimStart()[0],
        last = text.at(-1);
      if (previous.hasEOL && last === '-' && /[a-z]/i.test(next || '')) {
        text = text.slice(0, -1);
        positions.pop();
      } else if (!(cjk(last) && cjk(next))) append(' ', null);
    }
    let offset = 0;
    for (const original of item.str) {
      const normalized = original
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[\u00ad\u200b]/g, '');
      for (let j = 0; j < normalized.length; j++)
        append(normalized[j], { item: itemNumber, start: offset, end: offset + original.length });
      offset += original.length;
    }
    previous = item;
  }
  while (text.endsWith(' ')) {
    text = text.slice(0, -1);
    positions.pop();
  }
  return { text, positions };
}

export function findPageMatches(index, query, limit = 1000) {
  query = normalizeSearchQuery(query);
  if (!query) return [];
  const matches = [];
  let cursor = 0;
  while (matches.length < limit) {
    const at = index.text.indexOf(query, cursor);
    if (at < 0) break;
    let first = at,
      last = at + query.length - 1;
    while (first <= last && !index.positions[first]) first++;
    while (last >= first && !index.positions[last]) last--;
    if (first <= last) {
      const a = index.positions[first],
        b = index.positions[last];
      matches.push({
        start: { item: a.item, offset: a.start },
        end: { item: b.item, offset: b.end },
      });
    }
    cursor = at + query.length;
  }
  return matches;
}
