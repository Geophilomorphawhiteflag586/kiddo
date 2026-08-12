/**
 * Рендерит страницы PDF в PNG.
 *
 *   node --max-old-space-size=8192 scripts/pdf-page.mjs <pdf> <страницы> [масштаб]
 *
 * Страницы задаются списком через запятую: "1,2,5-7". Результат кладётся в
 * assets-src/pages/<имя-файла>-p<номер>.png.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const [source, pagesArg = '1', scaleArg = '1.5'] = process.argv.slice(2);
if (!source) {
  console.error('Укажите путь к PDF.');
  process.exit(1);
}

const pages = pagesArg.split(',').flatMap((part) => {
  const [from, to] = part.split('-').map(Number);
  if (!to) return [from];
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
});
const scale = Number(scaleArg);

const outDir = join(process.cwd(), 'assets-src', 'pages');
mkdirSync(outDir, { recursive: true });

const data = new Uint8Array(readFileSync(source));
const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
console.log(`Страниц в документе: ${doc.numPages}`);

const stem = basename(source).replace(/\.pdf$/i, '').slice(0, 40);

for (const pageNumber of pages) {
  if (pageNumber < 1 || pageNumber > doc.numPages) {
    console.warn(`Страницы ${pageNumber} нет — пропуск`);
    continue;
  }
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, viewport, canvas }).promise;

  const file = join(outDir, `${stem}-p${pageNumber}.png`);
  writeFileSync(file, canvas.toBuffer('image/png'));
  console.log(`${file} — ${canvas.width}x${canvas.height}`);
  page.cleanup();
}

await doc.destroy();
