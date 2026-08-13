/**
 * Нарезает значки направлений из общего листа-референса.
 *
 *   node scripts/module-cards.mjs && npm run assets:brand
 *
 * Лист (assets-src/module-cards.png) — шесть готовых карточек с рисунком слева
 * и текстом справа. Текст приложение рисует само: он должен быть живым —
 * прогресс настоящий, а названия могут меняться. Поэтому берём только левую
 * часть каждой карточки, до начала подписи.
 *
 * Нижний край обрезан выше нарисованной полоски прогресса: настоящую полоску
 * рисует приложение по реальным данным, две подряд смотрелись бы ошибкой.
 *
 * Результат кладётся в assets-src/brand/<id>.png — оттуда его подхватывает
 * общий конвейер фирменных картинок (scripts/brand-assets.mjs).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const SHEET = join(process.cwd(), 'assets-src', 'module-cards.png');
const OUT = join(process.cwd(), 'assets-src', 'brand');

/**
 * id модуля → рамка на листе: [x0, y0, x1, y1] в долях.
 * Правая граница проходит вплотную перед подписью на референсе.
 */
const CARDS = {
  geography: [0.013, 0.068, 0.19, 0.442],
  mathematics: [0.348, 0.068, 0.504, 0.442],
  english: [0.668, 0.068, 0.831, 0.442],
  chinese: [0.013, 0.508, 0.19, 0.868],
  anatomy: [0.348, 0.508, 0.504, 0.868],
  chess: [0.668, 0.508, 0.831, 0.868],
};

if (!existsSync(SHEET)) {
  console.error(`Нет листа: ${SHEET}`);
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const sheet = await loadImage(readFileSync(SHEET));

for (const [id, [x0, y0, x1, y1]] of Object.entries(CARDS)) {
  const sx = Math.round(sheet.width * x0);
  const sy = Math.round(sheet.height * y0);
  const sw = Math.round(sheet.width * (x1 - x0));
  const sh = Math.round(sheet.height * (y1 - y0));

  const canvas = createCanvas(sw, sh);
  canvas.getContext('2d').drawImage(sheet, sx, sy, sw, sh, 0, 0, sw, sh);
  writeFileSync(join(OUT, `${id}.png`), canvas.toBuffer('image/png'));
  console.log(`${id}.png — ${sw}x${sh}`);
}

console.log(`\nГотово. Дальше: npm run assets:brand`);
