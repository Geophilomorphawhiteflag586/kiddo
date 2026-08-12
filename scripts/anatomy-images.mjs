/**
 * Готовит иллюстрации для модуля «Анатомия» из учебника OpenStax
 * «Anatomy and Physiology 2e» (CC BY-NC-SA 4.0).
 *
 *   npm run assets:anatomy
 *
 * Шаг 1 (уже выполнен, повторяется при смене источника):
 *   node scripts/pdf-figures.mjs <pdf>   — индекс подписей
 *   node scripts/pdf-images.mjs <pdf> …  — выгрузка страниц в assets-src/figures
 *
 * Здесь из выгруженных страниц вырезаются отдельные структуры. Прямоугольник
 * задан долями от размера исходника: [x0, y0, x1, y1]. Границы подобраны так,
 * чтобы английские подписи учебника остались за кадром — модуль полностью
 * русскоязычный, и подпись на картинке подсказывала бы ответ.
 *
 * Структуры, для которых честной отдельной иллюстрации в учебнике нет
 * (кости черепа по отдельности, печень и соседние с ней органы, надколенник),
 * сюда намеренно не входят: для них остаётся схема SVG с подсветкой.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { CROPS } from './anatomy-crops.mjs';

const FIGURES = join(process.cwd(), 'assets-src', 'figures');
const OUT = join(process.cwd(), 'public', 'anatomy');
const MAX_WIDTH = 900;

if (!existsSync(FIGURES)) {
  console.error(`Нет папки ${FIGURES}. Сначала выгрузите страницы через scripts/pdf-images.mjs.`);
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

// Чистим прошлые результаты: иначе структура, выпавшая из таблицы рамок,
// осталась бы лежать файлом и попала бы в квиз со старой, неверной обрезкой.
// Базовые иллюстрации регионов лежат в подпапке base/ и не затрагиваются.
for (const file of readdirSync(OUT)) {
  if (file.endsWith('.webp')) rmSync(join(OUT, file));
}

const manifest = [];
for (const [id, { source, figure, crop }] of Object.entries(CROPS)) {
  const path = join(FIGURES, source);
  if (!existsSync(path)) {
    console.warn(`${id}: нет исходника ${source} — пропуск`);
    continue;
  }
  const image = await loadImage(readFileSync(path));
  const [x0, y0, x1, y1] = crop;
  const sx = Math.round(image.width * x0);
  const sy = Math.round(image.height * y0);
  const sw = Math.round(image.width * (x1 - x0));
  const sh = Math.round(image.height * (y1 - y0));

  const scale = Math.min(1, MAX_WIDTH / sw);
  const width = Math.round(sw * scale);
  const height = Math.round(sh * scale);

  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);

  const file = join(OUT, `${id}.webp`);
  writeFileSync(file, canvas.toBuffer('image/webp'));
  manifest.push({ id, figure, width, height });
  console.log(`${id}.webp — ${width}x${height} (рис. ${figure})`);
}

const CREDIT = {
  source: 'Anatomy and Physiology 2e',
  publisher: 'OpenStax, Rice University',
  url: 'https://openstax.org/details/books/anatomy-and-physiology-2e',
  license: 'CC BY-NC-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
  note: 'Иллюстрации обрезаны под структуры модуля; исходные подписи удалены.',
};

writeFileSync(
  join(OUT, 'credits.json'),
  JSON.stringify({ ...CREDIT, figures: manifest }, null, 2),
);

