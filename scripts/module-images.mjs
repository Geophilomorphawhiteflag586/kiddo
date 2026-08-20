/**
 * Раскладывает присланные картинки направлений под общий конвейер.
 *
 *   node scripts/module-images.mjs && npm run assets:brand
 *
 * Файлы приходят с именами вида «ChatGPT Image …», поэтому соответствие
 * задаётся здесь порядком: менять его руками проще, чем переименовывать семь
 * файлов при каждой присылке.
 *
 * У карточки «Известные люди» название и подпись вшиты в саму картинку —
 * обрезаем до лиц: текст и прогресс приложение рисует само, по живым данным.
 */
import { copyFileSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const SOURCE = join(process.cwd(), 'assets-src');
const OUT = join(SOURCE, 'brand');
mkdirSync(OUT, { recursive: true });

/** Порядок соответствует порядку файлов по имени (то есть по времени). */
const ORDER = ['geography', 'mathematics', 'english', 'chinese', 'anatomy', 'chess', 'people'];

/** Обрезка для картинок, где часть кадра занимает вшитый текст. */
const CROPS = { people: [0.035, 0.1, 0.605, 0.66] };

/**
 * Карточки показывают картинку целиком, поэтому все кадры приводятся к 3:2.
 * Иначе часть изображения обрезается по краям, и это заметно.
 */

const files = readdirSync(SOURCE)
  .filter((name) => name.startsWith('ChatGPT Image 14') && name.endsWith('.png'))
  .sort();

if (files.length !== ORDER.length) {
  console.error(`Файлов ${files.length}, а направлений ${ORDER.length}. Проверьте папку.`);
  process.exit(1);
}

for (const [index, file] of files.entries()) {
  const id = ORDER[index];
  const target = join(OUT, `${id}.png`);
  const crop = CROPS[id];

  if (!crop) {
    copyFileSync(join(SOURCE, file), target);
    console.log(`${id}.png — скопирован целиком`);
    continue;
  }

  const image = await loadImage(readFileSync(join(SOURCE, file)));
  const [x0, y0, x1, y1] = crop;
  const sx = Math.round(image.width * x0);
  const sy = Math.round(image.height * y0);
  const sw = Math.round(image.width * (x1 - x0));
  const sh = Math.round(image.height * (y1 - y0));

  const canvas = createCanvas(sw, sh);
  canvas.getContext('2d').drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
  writeFileSync(target, canvas.toBuffer('image/png'));
  console.log(`${id}.png — обрезан до ${sw}x${sh} (убран вшитый текст)`);
}

console.log('\nДальше: npm run assets:brand');
