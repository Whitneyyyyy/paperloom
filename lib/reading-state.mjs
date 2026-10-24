export function hasReadingNotes(paper) {
  return !!paper.note?.trim() || !!paper.annotations?.length;
}

export function readingStatus(paper) {
  if (hasReadingNotes(paper)) return 'annotated';
  if (
    paper.readingActivity?.openCount > 0 ||
    ['reading', 'read', 'annotated'].includes(paper.status)
  )
    return 'reading';
  return 'unread';
}

export function recordPaperOpened(paper, now = new Date().toISOString()) {
  const previous = paper.readingActivity || {};
  paper.readingActivity = {
    firstOpenedAt: previous.firstOpenedAt || now,
    lastOpenedAt: now,
    openCount: Math.min(1000000, (previous.openCount || 0) + 1),
  };
  paper.status = readingStatus(paper);
}

export function validateReadingActivity(value) {
  if (value == null) return null;
  if (
    !value ||
    typeof value !== 'object' ||
    !Number.isInteger(value.openCount) ||
    value.openCount < 1 ||
    value.openCount > 1000000
  )
    throw Error('阅读记录格式无效');
  const date = (text) =>
    typeof text === 'string' && text.length <= 40 && Number.isFinite(Date.parse(text));
  if (
    !date(value.firstOpenedAt) ||
    !date(value.lastOpenedAt) ||
    Date.parse(value.firstOpenedAt) > Date.parse(value.lastOpenedAt)
  )
    throw Error('阅读记录日期无效');
  return {
    firstOpenedAt: value.firstOpenedAt,
    lastOpenedAt: value.lastOpenedAt,
    openCount: value.openCount,
  };
}
