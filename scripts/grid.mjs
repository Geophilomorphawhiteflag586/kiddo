/**
 * Сетка с шагом 5 % поверх любой картинки — чтобы снимать координаты обрезки.
 *
 *   node scripts/grid.mjs assets-src/figures/poster.png [ширина]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const [source, widthArg = '1500'] = process.argv.slice(2);
const image = await loadImage(readFileSync(source));
const scale = Number(widthArg) / image.width;
const width = Math.round(image.width * scale);
const height = Math.round(image.height * scale);

const canvas = createCanvas(width, height);
const context = canvas.getContext('2d');
context.drawImage(image, 0, 0, width, height);

for (let percent = 5; percent < 100; percent += 5) {
  const major = percent % 10 === 0;
  context.strokeStyle = major ? 'rgba(0,90,255,0.75)' : 'rgba(0,90,255,0.3)';
  context.lineWidth = major ? 1.4 : 1;
  const gx = (width * percent) / 100;
  const gy = (height * percent) / 100;
  context.beginPath();
  context.moveTo(gx, 0);
  context.lineTo(gx, height);
  context.moveTo(0, gy);
  context.lineTo(width, gy);
  context.stroke();
  if (major) {
    context.font = 'bold 15px sans-serif';
    context.lineWidth = 3.5;
    context.strokeStyle = '#ffffff';
    context.strokeText(String(percent), gx + 3, 17);
    context.strokeText(String(percent), 3, gy - 3);
    context.fillStyle = '#0032c8';
    context.fillText(String(percent), gx + 3, 17);
    context.fillText(String(percent), 3, gy - 3);
  }
}

const out = join('assets-src', `grid-${basename(source)}`);
writeFileSync(out, canvas.toBuffer('image/png'));
console.log(`${out} — ${width}x${height} (исходник ${image.width}x${image.height})`);
