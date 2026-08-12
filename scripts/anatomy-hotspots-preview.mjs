/**
 * Показывает базовую иллюстрацию региона с сеткой и уже расставленными зонами.
 *
 *   node scripts/anatomy-hotspots-preview.mjs skull
 *   HEIGHT=1500 node scripts/anatomy-hotspots-preview.mjs organs_main
 *
 * Координаты зон задаются в процентах от базовой картинки — именно их и
 * показывает сетка, поэтому числа для hotspots.ts читаются прямо с листа.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const region = process.argv[2];
if (!region) {
  console.error('Укажите регион, например: skull');
  process.exit(1);
}

const base = join(process.cwd(), 'public', 'anatomy', 'base', `${region}.webp`);
if (!existsSync(base)) {
  console.error(`Нет базовой картинки ${base}. Сначала: node scripts/anatomy-bases.mjs`);
  process.exit(1);
}

/** Уже описанные зоны — чтобы видеть, что подвинуть. */
let spots = [];
const hotspotsFile = join(process.cwd(), 'src', 'modules', 'anatomy', 'data', 'hotspots.ts');
if (existsSync(hotspotsFile)) {
  const { HOTSPOTS } = await import(`file://${hotspotsFile.replace(/\\/g, '/')}`);
  spots = HOTSPOTS[region] ?? [];
}

const image = await loadImage(readFileSync(base));
const target = Number(process.env.HEIGHT ?? 1400);
const scale = Math.min(target / image.height, 1100 / image.width);
const width = Math.round(image.width * scale);
const height = Math.round(image.height * scale);

// Поля нулевые: координаты на листе должны совпадать с долями картинки.
const MARGIN = 0;
const canvas = createCanvas(width + MARGIN * 2, height + MARGIN * 2);
const context = canvas.getContext('2d');
context.fillStyle = '#ffffff';
context.fillRect(0, 0, canvas.width, canvas.height);
context.drawImage(image, MARGIN, MARGIN, width, height);

for (let percent = 5; percent < 100; percent += 5) {
  const major = percent % 10 === 0;
  context.strokeStyle = major ? 'rgba(0,120,255,0.5)' : 'rgba(0,120,255,0.2)';
  context.lineWidth = major ? 1.3 : 1;
  const gx = MARGIN + (width * percent) / 100;
  const gy = MARGIN + (height * percent) / 100;
  context.beginPath();
  context.moveTo(gx, MARGIN);
  context.lineTo(gx, MARGIN + height);
  context.moveTo(MARGIN, gy);
  context.lineTo(MARGIN + width, gy);
  context.stroke();
  if (major) {
    context.font = 'bold 13px sans-serif';
    context.lineWidth = 3;
    context.strokeStyle = '#ffffff';
    context.strokeText(String(percent), gx + 3, 15);
    context.strokeText(String(percent), 3, gy - 3);
    context.fillStyle = '#0064d2';
    context.fillText(String(percent), gx + 3, 15);
    context.fillText(String(percent), 3, gy - 3);
  }
}

for (const spot of spots) {
  context.strokeStyle = '#e0004d';
  context.fillStyle = 'rgba(224,0,77,0.18)';
  context.lineWidth = 2;
  context.beginPath();
  context.ellipse(
    MARGIN + (width * spot.cx) / 100,
    MARGIN + (height * spot.cy) / 100,
    (width * spot.rx) / 100,
    (height * spot.ry) / 100,
    0,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.stroke();
  context.fillStyle = '#a00038';
  context.font = 'bold 14px sans-serif';
  context.fillText(
    spot.structureId,
    MARGIN + (width * spot.cx) / 100 + 4,
    MARGIN + (height * spot.cy) / 100 - 4,
  );
}

const out = join(process.cwd(), 'assets-src', `hotspots-${region}.png`);
writeFileSync(out, canvas.toBuffer('image/png'));
console.log(`${out} — ${canvas.width}x${canvas.height}; зон: ${spots.length}`);
