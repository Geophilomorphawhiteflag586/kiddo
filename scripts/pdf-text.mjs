/**
 * Печатает текст указанных страниц PDF.
 *
 *   node --max-old-space-size=8192 scripts/pdf-text.mjs <pdf> "1-12"
 */
import { readFileSync } from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const [source, pagesArg = '1'] = process.argv.slice(2);
const pages = pagesArg.split(',').flatMap((part) => {
  const [from, to] = part.split('-').map(Number);
  return to ? Array.from({ length: to - from + 1 }, (_, i) => from + i) : [from];
});

const data = new Uint8Array(readFileSync(source));
const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;

for (const pageNumber of pages) {
  if (pageNumber < 1 || pageNumber > doc.numPages) continue;
  const page = await doc.getPage(pageNumber);
  const content = await page.getTextContent();
  const text = content.items
    .map((item) => ('str' in item ? item.str : ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  console.log(`\n===== стр. ${pageNumber} =====\n${text.slice(0, 2500)}`);
  page.cleanup();
}
