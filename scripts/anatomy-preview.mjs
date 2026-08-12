/**
 * Показывает рамки обрезки поверх исходных страниц учебника.
 *
 *   node scripts/anatomy-preview.mjs <группа>
 *
 * Группа — organs | bones | muscles. Результат: assets-src/preview-<группа>.png.
 * Нужен, чтобы подгонять числа в CROPS из scripts/anatomy-images.mjs, не
 * перезаписывая каждый раз public/anatomy.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { BASES, CROPS as STRUCTURE_CROPS } from './anatomy-crops.mjs';

/** Предпросмотр работает и для отдельных структур, и для базовых картинок регионов. */
const CROPS = { ...STRUCTURE_CROPS, ...BASES };

const GROUPS = {
  organs: ['brain', 'heart', 'lungs', 'stomach', 'intestines', 'kidneys'],
  bones: [
    'mandible',
    'spine',
    'sternum',
    'ribs',
    'clavicle',
    'scapula',
    'carpals',
    'phalanges_hand',
    'pelvis',
    'femur',
    'tibia',
    'fibula',
    'foot_bones',
  ],
  muscles: ['trapezius', 'deltoid', 'pectoralis', 'biceps', 'rectus_abdominis', 'quadriceps'],
  bases: Object.keys(BASES),
};

const group = process.argv[2] ?? 'organs';
// Можно перечислить структуры через запятую: удобно доводить отдельные рамки.
const ids = GROUPS[group] ?? group.split(',').filter((id) => id in CROPS);
if (ids.length === 0) {
  console.error(`Неизвестная группа: ${group}. Доступны: ${Object.keys(GROUPS).join(', ')}`);
  process.exit(1);
}

const FIGURES = join(process.cwd(), 'assets-src', 'figures');
const CELL = Number(process.env.CELL ?? 620);
const PAD = 30;
const columns = Math.min(Number(process.env.COLUMNS ?? 3), ids.length);
const rows = Math.ceil(ids.length / columns);

const canvas = createCanvas(columns * (CELL + PAD) + PAD, rows * (CELL + PAD * 2) + PAD);
const context = canvas.getContext('2d');
context.fillStyle = '#ffffff';
context.fillRect(0, 0, canvas.width, canvas.height);

for (const [index, id] of ids.entries()) {
  const spec = CROPS[id];
  const image = await loadImage(readFileSync(join(FIGURES, spec.source)));
  const scale = Math.min(CELL / image.width, CELL / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const x = PAD + (index % columns) * (CELL + PAD);
  const y = PAD * 2 + Math.floor(index / columns) * (CELL + PAD * 2);

  context.drawImage(image, x, y, width, height);

  // Сетка с шагом 5 %: по ней читаются доли для CROPS.
  for (let percent = 5; percent < 100; percent += 5) {
    const major = percent % 10 === 0;
    context.strokeStyle = major ? 'rgba(0,120,255,0.55)' : 'rgba(0,120,255,0.22)';
    context.lineWidth = major ? 1.4 : 1;
    const gx = x + (width * percent) / 100;
    const gy = y + (height * percent) / 100;
    context.beginPath();
    context.moveTo(gx, y);
    context.lineTo(gx, y + height);
    context.moveTo(x, gy);
    context.lineTo(x + width, gy);
    context.stroke();
    if (major) {
      context.fillStyle = '#0064d2';
      context.font = 'bold 13px sans-serif';
      context.fillText(String(percent), gx + 2, y - 4);
      context.fillText(String(percent), x - 24, gy + 4);
    }
  }

  const [x0, y0, x1, y1] = spec.crop;
  context.strokeStyle = '#e0004d';
  context.lineWidth = 3;
  context.strokeRect(x + width * x0, y + height * y0, width * (x1 - x0), height * (y1 - y0));

  context.fillStyle = '#000';
  context.font = 'bold 15px sans-serif';
  context.fillText(`${id} · ${spec.source} · [${spec.crop.join(', ')}]`, x, y + height + 20);
}

const out = join(process.cwd(), 'assets-src', `preview-${group}.png`);
writeFileSync(out, canvas.toBuffer('image/png'));
console.log(`${out} — ${canvas.width}x${canvas.height}`);
