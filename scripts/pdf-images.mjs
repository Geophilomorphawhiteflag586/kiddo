/**
 * Достаёт встроенные растровые изображения из страниц PDF в исходном разрешении.
 *
 *   node --max-old-space-size=8192 scripts/pdf-images.mjs <pdf> "233,240-242" [минимальная-сторона]
 *
 * Файлы кладутся в assets-src/figures/p<страница>-<номер>.png. Это сырой
 * материал: отбор, обрезка и переименование под структуры — отдельный шаг.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCanvas, ImageData } from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const [source, pagesArg = '1', minSideArg = '200'] = process.argv.slice(2);
const minSide = Number(minSideArg);
const pages = pagesArg.split(',').flatMap((part) => {
  const [from, to] = part.split('-').map(Number);
  return to ? Array.from({ length: to - from + 1 }, (_, i) => from + i) : [from];
});

const outDir = join(process.cwd(), 'assets-src', 'figures');
mkdirSync(outDir, { recursive: true });

const data = new Uint8Array(readFileSync(source));
const doc = await pdfjs.getDocument({
  data,
  useSystemFonts: true,
  // Без OffscreenCanvas pdf.js отдаёт пиксели массивом, а не ImageBitmap.
  isOffscreenCanvasSupported: false,
}).promise;

/** Разворачивает формат pdf.js в RGBA-массив для canvas. */
function toRgba(image) {
  const { width, height, kind } = image;
  const source = image.data;
  if (kind === 3) return new Uint8ClampedArray(source.buffer, source.byteOffset, width * height * 4);
  const rgba = new Uint8ClampedArray(width * height * 4);
  if (kind === 2) {
    for (let i = 0, j = 0; i < width * height; i += 1, j += 3) {
      rgba[i * 4] = source[j];
      rgba[i * 4 + 1] = source[j + 1];
      rgba[i * 4 + 2] = source[j + 2];
      rgba[i * 4 + 3] = 255;
    }
    return rgba;
  }
  // GRAYSCALE_1BPP: по биту на пиксель, строки выровнены по байту.
  const rowBytes = (width + 7) >> 3;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const bit = (source[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
      const value = bit ? 0 : 255;
      const i = (y * width + x) * 4;
      rgba[i] = value;
      rgba[i + 1] = value;
      rgba[i + 2] = value;
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

let saved = 0;
for (const pageNumber of pages) {
  if (pageNumber < 1 || pageNumber > doc.numPages) continue;
  const page = await doc.getPage(pageNumber);
  const operators = await page.getOperatorList();

  const names = new Set();
  operators.fnArray.forEach((fn, index) => {
    if (fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintJpegXObject) {
      const argument = operators.argsArray[index]?.[0];
      if (typeof argument === 'string') names.add(argument);
    }
  });

  let index = 0;
  for (const name of names) {
    index += 1;
    let image;
    try {
      image = await new Promise((resolve, reject) => {
        try {
          page.objs.get(name, resolve);
        } catch (error) {
          reject(error);
        }
      });
    } catch {
      console.warn(`стр. ${pageNumber}: не удалось прочитать ${name}`);
      continue;
    }
    if (!image?.width || !image.data) continue;
    if (Math.min(image.width, image.height) < minSide) continue;

    const canvas = createCanvas(image.width, image.height);
    const context = canvas.getContext('2d');
    context.putImageData(new ImageData(toRgba(image), image.width, image.height), 0, 0);

    const file = join(outDir, `p${pageNumber}-${index}.png`);
    writeFileSync(file, canvas.toBuffer('image/png'));
    console.log(`${file} — ${image.width}x${image.height}`);
    saved += 1;
  }
  page.cleanup();
}

console.log(`\nСохранено файлов: ${saved}\n${outDir}`);
