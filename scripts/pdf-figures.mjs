/**
 * Строит индекс иллюстраций учебника: номер страницы PDF → подписи «FIGURE N.N».
 *
 *   node --max-old-space-size=8192 scripts/pdf-figures.mjs <pdf>
 *
 * Результат — assets-src/figures-index.json, по которому дальше отбираются
 * нужные рисунки для модуля «Анатомия».
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const [source] = process.argv.slice(2);
const data = new Uint8Array(readFileSync(source));
const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;

const figures = [];
for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
  const page = await doc.getPage(pageNumber);
  const content = await page.getTextContent();
  const text = content.items
    .map((item) => ('str' in item ? item.str : ''))
    .join(' ')
    .replace(/\s+/g, ' ');

  for (const match of text.matchAll(/FIGURE\s+(\d+\.\d+)\s+(.{0,220})/g)) {
    figures.push({ page: pageNumber, figure: match[1], caption: match[2].trim() });
  }
  page.cleanup();

  if (pageNumber % 100 === 0) console.log(`…${pageNumber}/${doc.numPages}`);
}

mkdirSync(join(process.cwd(), 'assets-src'), { recursive: true });
const out = join(process.cwd(), 'assets-src', 'figures-index.json');
writeFileSync(out, JSON.stringify(figures, null, 2));
console.log(`Найдено подписей: ${figures.length}\n${out}`);
