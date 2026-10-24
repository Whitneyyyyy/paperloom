import { extractPublication } from './publication.mjs?v=7.0';
let library;
export function pageText(items) {
  let text = '',
    previous;
  for (const item of items) {
    if (!item.str?.trim()) {
      if (item.hasEOL) text += '\n';
      continue;
    }
    const y = item.transform?.[5],
      height = item.height || Math.abs(item.transform?.[3] || 0) || 11;
    if (
      previous &&
      Number.isFinite(y) &&
      Math.abs(y - previous.y) > Math.max(height, previous.height) * 1.9
    )
      text += '\n\n';
    text += item.str + (item.hasEOL ? '\n' : ' ');
    previous = { y, height };
  }
  return text;
}
export async function pdfLibrary() {
  if (!library)
    library = import('./vendor/pdf.mjs')
      .then((lib) => {
        lib.GlobalWorkerOptions.workerSrc = new URL(
          './vendor/pdf.worker.mjs',
          import.meta.url,
        ).href;
        return lib;
      })
      .catch((error) => {
        library = null;
        throw error;
      });
  return library;
}
export function extractPublicationYear(raw) {
  const header = String(raw || '')
    .split(/\bReferences\b|参考文献/i)[0]
    .slice(0, 7000);
  const patterns = [
    /(?:published(?:\s+online)?|available\s+online|publication\s+(?:date|year)|发表(?:年份|日期)?|出版(?:年|日期)?)\s*[:：]?[^\n]{0,55}?\b((?:19|20)\d{2})\b/i,
    /\b\d{1,4}\s*\(\s*((?:19|20)\d{2})\s*\)\s*(?:\d|[A-Z]\d)/,
    /(?:©|copyright)\s*(?:\(c\)\s*)?((?:19|20)\d{2})\b/i,
  ];
  for (const pattern of patterns) {
    const match = header.match(pattern),
      year = match ? Number(match[1]) : null;
    if (year >= 1900 && year <= new Date().getUTCFullYear() + 1) return year;
  }
  return null;
}
export function extractFields(raw) {
  const text = String(raw || '')
    .replace(/\bA\s+B\s+S\s+T\s+R\s+A\s+C\s+T\b/gi, 'Abstract')
    .replace(/\bK\s+E\s+Y\s+W\s+O\s+R\s+D\s+S\b/gi, 'Keywords');
  const doi = text.match(/\b10\.\d{4,9}\/[\w.();/:+-]+/i)?.[0]?.replace(/[.,;:)]+$/, '') || '';
  const match =
    text.match(
      /(?:\babstract\b|摘要)\s*[:：]?\s*([\s\S]{30,6000}?)(?=\n\s*(?:keywords?|key words|关键词|(?:1[.\s]+)?introduction|(?:一[、.\s]+)?引言|\d+[.\s]+background)\b|$)/i,
    ) || text.match(/\bAbstract\s*[:：]?\s*([\s\S]{30,4000}?)(?=\b(?:Keywords|Introduction)\b|$)/i);
  const abstract = (match?.[1] || '').replace(/\s+/g, ' ').trim().slice(0, 5000);
  const keywordMatch = text.match(
    /(?:\bkeywords?\b|\bkey words\b|关键词)\s*[:：]?\s*([\s\S]{3,650}?)(?=\n\s*(?:abstract|摘要|(?:1[.\s]+)?introduction|article history|received|accepted|available online|doi:)|\n\s*\n|$)/i,
  );
  let tags = [];
  if (keywordMatch) {
    const block = keywordMatch[1].trim();
    const pieces = block
      .split(/[;,；，\n]/)
      .map((t) => t.replace(/\s+/g, ' ').trim())
      .filter(
        (t) =>
          t.length > 2 && t.length < 85 && !/^(abstract|introduction|received|accepted)\b/i.test(t),
      );
    tags = [...new Set(pieces)].slice(0, 12);
  }
  return { doi, abstract, tags, year: extractPublicationYear(text), ...extractPublication(text) };
}
export function guessTitle(meta, page, filename) {
  const supplied = meta?.info?.Title?.replace(/\s+/g, ' ').trim();
  if (
    supplied &&
    supplied.length > 10 &&
    supplied.length < 600 &&
    !/^(untitled|microsoft|word|latex|document|template|doi:)/i.test(supplied) &&
    !supplied.endsWith('.pdf')
  )
    return supplied;
  const lines = [];
  for (const item of page.items.filter((i) => i.str?.trim())) {
    const y = Math.round(item.transform[5] / 3) * 3;
    const previous = lines.at(-1),
      size = item.height || Math.abs(item.transform[3]);
    if (previous && Math.abs(previous.y - y) < 4) {
      previous.text += ' ' + item.str;
      previous.size = Math.max(previous.size, size);
    } else lines.push({ text: item.str.trim(), y, size });
  }
  const candidates = lines.filter(
    (l) =>
      l.text.length > 12 &&
      l.text.length < 350 &&
      !/^(https?:|www\.|doi[:\s]|abstract\b|keywords\b|arxiv:|received\b|accepted\b|available online\b|contents lists\b|©|copyright|[\d\s.,()-]+$)/i.test(
        l.text,
      ),
  );
  if (candidates.length) {
    const best = [...candidates].sort((a, b) => b.size - a.size)[0],
      index = lines.indexOf(best);
    let title = best.text;
    for (let i = index + 1; i < Math.min(index + 3, lines.length); i++) {
      const next = lines[i],
        prev = lines[i - 1];
      if (
        Math.abs(next.size - best.size) > 1 ||
        Math.abs(next.y - prev.y) > best.size * 2.5 ||
        /^(abstract|keywords)/i.test(next.text)
      )
        break;
      title += ' ' + next.text;
    }
    return title.replace(/\s+/g, ' ').trim();
  }
  return filename.replace(/\.pdf$/i, '').replace(/_/g, ' ');
}
export async function readPaperPdf(bytes, filename, progress = () => {}) {
  const lib = await pdfLibrary();
  let pdf;
  try {
    pdf = await lib.getDocument({
      data: new Uint8Array(bytes.slice(0)),
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;
    const meta = await pdf.getMetadata();
    const front = [];
    let firstContent;
    const pages = [
      ...new Set([
        ...Array.from({ length: Math.min(pdf.numPages, 8) }, (_, i) => i + 1),
        ...Array.from({ length: Math.min(pdf.numPages, 2) }, (_, i) => pdf.numPages - i),
      ]),
    ].sort((a, b) => a - b);
    const last = [];
    for (let i = 0; i < pages.length; i++) {
      const number = pages[i],
        page = await pdf.getPage(number),
        content = await page.getTextContent();
      if (number === 1) firstContent = content;
      const text = pageText(content.items);
      if (number <= 8) front.push(text);
      if (number > pdf.numPages - 3) last.push(text);
      progress({ page: i + 1, total: pages.length });
    }
    const fullText = front.join('\n'),
      title = guessTitle(meta, firstContent, filename),
      fields = extractFields(fullText),
      author = meta?.info?.Author?.trim();
    const authors =
      author &&
      !/^(unknown|user|admin|author|anonymous|microsoft)/i.test(author) &&
      author.length < 500
        ? author
            .split(/[;；，\n]/)
            .map((n) => n.trim())
            .filter(Boolean)
        : [];
    const references = last
      .join('\n')
      .split(/\bReferences\b|\bBibliography\b|参考文献/i)
      .slice(1)
      .join('\n');
    const referenceDois = [
      ...new Set(
        (references.match(/\b10\.\d{4,9}\/[\w.();/:+-]+/gi) || [])
          .map((d) => d.replace(/[.,;:)]+$/, '').toLowerCase())
          .filter((d) => d !== fields.doi.toLowerCase()),
      ),
    ].slice(0, 100);
    return {
      title,
      authors,
      ...fields,
      textExcerpt: fullText.slice(0, 16000),
      referenceDois,
      metadataSource:
        fullText.replace(/\s/g, '').length < 60
          ? 'PDF 文字较少，按标题自动分类'
          : 'PDF 文字解析与自动分类',
      scanned: fullText.replace(/\s/g, '').length < 60,
    };
  } finally {
    if (pdf) await pdf.destroy();
  }
}
