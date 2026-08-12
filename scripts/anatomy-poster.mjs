/**
 * Нарезает отдельные структуры из анатомического плаката.
 *
 *   node scripts/anatomy-poster.mjs
 *
 * Плакат (assets-src/figures/poster.png) — россыпь изолированных рисунков без
 * подписей на прозрачном фоне. Этим он и ценен: из учебника такие структуры
 * вырезать не удавалось, там всё подписано и нарисовано вплотную.
 *
 * Координаты — доли от плаката: [x0, y0, x1, y1]. Подогнать рамку:
 * `node scripts/grid.mjs assets-src/figures/poster.png 1600` — сетка с шагом 5 %.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const POSTER = join(process.cwd(), 'assets-src', 'figures', 'poster.png');
const OUT = join(process.cwd(), 'public', 'anatomy');
const MAX_SIDE = 700;

import { POSTER_CROPS } from './anatomy-poster-crops.mjs';

if (!existsSync(POSTER)) {
  console.error(`Нет плаката: ${POSTER}`);
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const poster = await loadImage(readFileSync(POSTER));

/**
 * Убирает полупрозрачную кайму, оставшуюся от вырезания фона, и обрезает
 * пустые поля. Без этого вокруг каждой структуры висит красно-жёлтый ореол.
 */
function cleanEdges(context, width, height) {
  const image = context.getImageData(0, 0, width, height);
  const pixels = image.data;

  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] < 170) pixels[i] = 0;
  }
  context.putImageData(image, 0, 0);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

const manifest = [];
for (const [id, [x0, y0, x1, y1]] of Object.entries(POSTER_CROPS)) {
  const sx = Math.round(poster.width * x0);
  const sy = Math.round(poster.height * y0);
  const sw = Math.round(poster.width * (x1 - x0));
  const sh = Math.round(poster.height * (y1 - y0));

  const cut = createCanvas(sw, sh);
  const cutContext = cut.getContext('2d');
  cutContext.drawImage(poster, sx, sy, sw, sh, 0, 0, sw, sh);
  const box = cleanEdges(cutContext, sw, sh);
  if (!box) {
    console.warn(`${id}: в рамке пусто — проверьте координаты`);
    continue;
  }

  const scale = Math.min(1, MAX_SIDE / box.width, MAX_SIDE / box.height);
  const width = Math.max(1, Math.round(box.width * scale));
  const height = Math.max(1, Math.round(box.height * scale));
  const canvas = createCanvas(width, height);
  canvas.getContext('2d').drawImage(cut, box.x, box.y, box.width, box.height, 0, 0, width, height);

  writeFileSync(join(OUT, `${id}.webp`), canvas.toBuffer('image/webp'));
  manifest.push({ id, width, height });
  console.log(`${id}.webp — ${width}x${height}`);
}

console.log(`\nГотово: ${manifest.length} структур`);
