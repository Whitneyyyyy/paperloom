export const PUBLICATION_VERSION = 1;
const clean = (value) =>
  String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1000);

export function extractPublication(raw) {
  const front = String(raw || '')
    .split(/\bReferences\b|\bBibliography\b|参考文献/i)[0]
    .slice(0, 6000);
  const lines = front.split(/\n/).map(clean).filter(Boolean);
  let journal = '';
  for (const line of lines.slice(0, 45)) {
    const label = line.match(/^(?:journal(?:\s+name)?|期刊(?:名称)?|刊名)\s*[:：]\s*(.{3,180})/i);
    const citation = line.match(
      /^([A-Za-z][A-Za-z\s&,:–—-]{3,160}?)\s+\d{1,5}(?:\s*\([^)]{1,25}\))?\s*\((?:19|20)\d{2}\)/,
    );
    if (label || citation) {
      journal = clean((label || citation)[1]);
      break;
    }
  }
  if (!journal) {
    const index = lines.findIndex((line) => /contents lists available at/i.test(line));
    const candidate = lines[index + 1];
    if (
      index >= 0 &&
      candidate &&
      /^[A-Za-z][A-Za-z\s&,:–—-]{3,160}$/.test(candidate) &&
      !/^(abstract|keywords|article|research|review|available)\b/i.test(candidate)
    )
      journal = candidate;
  }
  let publisher = '';
  const explicit =
    front.match(/(?:publisher|出版社|出版机构)\s*[:：]\s*([^\n]{2,150})/i) ||
    front.match(/published by\s+([^\n]{2,150})/i);
  if (explicit) publisher = clean(explicit[1].split(/[.;](?:\s|$)/)[0]);
  if (!publisher) {
    const copyright = front.match(/(?:©|copyright)[^\n]{0,180}/gi) || [];
    for (const line of copyright) {
      const known = line.match(
        /\b(Elsevier(?:\s+(?:B\.V\.|Ltd\.?|Inc\.?))?|Springer(?:\s+Nature)?|Wiley|Taylor\s*&\s*Francis|IEEE|ACM|MDPI|SAGE|Oxford University Press|Cambridge University Press)(?=\s|$|[.,])/i,
      );
      if (known) {
        publisher = clean(known[1]);
        break;
      }
    }
  }
  return { journal, publisher, publicationSource: journal || publisher ? 'PDF 出版信息' : '' };
}

export function normalizeDoi(value) {
  const doi = String(value || '')
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '');
  return /^10\.\d{4,9}\/[^\s<>]{1,270}$/i.test(doi) ? doi : '';
}

export async function lookupPublication(value, fetcher = fetch) {
  const doi = normalizeDoi(value);
  if (!doi) return { status: 'missing', journal: '', publisher: '' };
  try {
    const response = await fetcher('https://api.crossref.org/works/' + encodeURIComponent(doi), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Paperloom/0.7 (personal paper library)',
      },
      signal: AbortSignal.timeout(6500),
      redirect: 'manual',
    });
    if (response.status === 404) return { status: 'missing', journal: '', publisher: '' };
    if (!response.ok) return { status: 'unavailable', journal: '', publisher: '' };
    const reader = response.body.getReader();
    let size = 0;
    const chunks = [];
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 512 * 1024) {
          await reader.cancel();
          return { status: 'unavailable', journal: '', publisher: '' };
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const message = JSON.parse(new TextDecoder().decode(bytes)).message;
    if (!message || normalizeDoi(message.DOI).toLowerCase() !== doi.toLowerCase())
      return { status: 'missing', journal: '', publisher: '' };
    const journal = clean(
        Array.isArray(message['container-title']) ? message['container-title'][0] : '',
      ),
      publisher = clean(message.publisher);
    return {
      status: journal || publisher ? 'found' : 'missing',
      journal,
      publisher,
      publicationSource: 'Crossref DOI 出版记录',
    };
  } catch {
    return { status: 'unavailable', journal: '', publisher: '' };
  }
}
