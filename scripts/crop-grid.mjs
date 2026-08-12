/**
 * Вырезает участок картинки и рисует поверх сетку с шагом 5 %.
 * Координаты сетки — доли ВЫРЕЗАННОГО участка.
 *
 *   node scripts/crop-grid.mjs <файл> <x0> <y0> <x1> <y1> <имя> [ширина]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const [src, x0, y0, x1, y1, name, widthArg = '1400'] = process.argv.slice(2);
const image = await loadImage(readFileSync(src));
const sx = Math.round(image.width * Number(x0));
const sy = Math.round(image.height * Number(y0));
const sw = Math.round(image.width * (Number(x1) - Number(x0)));
const sh = Math.round(image.height * (Number(y1) - Number(y0)));

const scale = Number(widthArg) / sw;
const width = Math.round(sw * scale);
const height = Math.round(sh * scale);
const canvas = createCanvas(width, height);
const context = canvas.getContext('2d');
context.fillStyle = '#ffffff';
context.fillRect(0, 0, width, height);
context.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);

for (let percent = 5; percent < 100; percent += 5) {
  const major = percent % 10 === 0;
  context.strokeStyle = major ? 'rgba(0,90,255,0.7)' : 'rgba(0,90,255,0.28)';
  context.lineWidth = major ? 1.4 : 1;
  const gx = (width * percent) / 100;
  const gy = (height * percent) / 100;
  context.beginPath();
  context.moveTo(gx, 0); context.lineTo(gx, height);
  context.moveTo(0, gy); context.lineTo(width, gy);
  context.stroke();
  if (major) {
    context.font = 'bold 15px sans-serif';
    context.lineWidth = 3.5; context.strokeStyle = '#ffffff';
    context.strokeText(String(percent), gx + 3, 17);
    context.strokeText(String(percent), 3, gy - 3);
    context.fillStyle = '#0032c8';
    context.fillText(String(percent), gx + 3, 17);
    context.fillText(String(percent), 3, gy - 3);
  }
}

writeFileSync(join('assets-src', `zoom-${name}.png`), canvas.toBuffer('image/png'));
console.log(`assets-src/zoom-${name}.png — ${width}x${height}; участок ${sw}x${sh} px`);
