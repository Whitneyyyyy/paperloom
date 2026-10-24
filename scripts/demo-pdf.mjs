const escape = (text) => text.replace(/[\\()]/g, '\\$&');
function lines(text, max) {
  const result = [];
  for (const word of text.split(/\s+/)) {
    if (!result.length || result.at(-1).length + word.length + 1 > max) result.push(word);
    else result[result.length - 1] += ' ' + word;
  }
  return result;
}

/** A tiny original PDF generator for synthetic demo material, using standard PDF fonts. */
export function demoPdf(paper) {
  const commands = [];
  const text = (value, x, y, size = 11, font = 'F1') =>
    commands.push(`BT /${font} ${size} Tf ${x} ${y} Td (${escape(value)}) Tj ET`);
  lines(paper.title, 46)
    .slice(0, 2)
    .forEach((line, i) => text(line, 52, 735 - i * 26, 23, 'F2'));
  text('PAPERLOOM DEMO  /  SYNTHETIC DOCUMENT', 52, 662, 9);
  text('Created for interface demonstration. This is not a published research paper.', 52, 645, 9);
  commands.push('0.8 G 52 628 m 560 628 l S 0 G');
  text('Abstract', 52, 600, 14, 'F2');
  lines(paper.abstract, 89)
    .slice(0, 5)
    .forEach((line, i) => text(line, 52, 578 - i * 17));
  text('Methods and observations', 52, 475, 14, 'F2');
  text('Image segmentation links visual evidence with building inspection.', 52, 448, 12);
  text('Additional observations help explain the limits of each method.', 52, 423, 12);
  lines(
    'This sample passage is intentionally simple so that you can try text selection, colored highlights, notes, keyword search and on-device translation without uploading a private manuscript.',
    89,
  ).forEach((line, i) => text(line, 52, 391 - i * 17));
  text('Reading workflow', 52, 285, 14, 'F2');
  text('1. Select a passage and choose a highlight color.', 52, 257);
  text('2. Add an optional note, or translate the selected text locally.', 52, 236);
  text('3. Return to the graph and explore related papers.', 52, 215);
  text('Paperloom contributors / Original synthetic demo content / MIT', 52, 65, 8);
  text('1', 550, 40, 9);
  const stream = commands.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let output = '%PDF-1.4\n',
    offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(output));
    output += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(output);
  output +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((offset) => String(offset).padStart(10, '0') + ' 00000 n \n')
      .join('');
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(output));
}
