/**
 * Собирает несколько изображений в один лист с процентной сеткой.
 *
 *   node scripts/contact-sheet.mjs <выходной.png> <файл1> <файл2> ...
 *
 * Сетка размечена в процентах от размеров каждой картинки — по ней удобно
 * записывать прямоугольники обрезки, не открывая редактор.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const [output, ...sources] = process.argv.slice(2);
const CELL = 560;
const PAD = 34;
const columns = Math.min(3, sources.length);
const rows = Math.ceil(sources.length / columns);

const canvas = createCanvas(columns * (CELL + PAD) + PAD, rows * (CELL + PAD * 2) + PAD);
const context = canvas.getContext('2d');
context.fillStyle = '#ffffff';
context.fillRect(0, 0, canvas.width, canvas.height);

for (const [index, source] of sources.entries()) {
  const image = await loadImage(readFileSync(source));
  const scale = Math.min(CELL / image.width, CELL / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const x = PAD + (index % columns) * (CELL + PAD);
  const y = PAD * 2 + Math.floor(index / columns) * (CELL + PAD * 2);

  context.drawImage(image, x, y, width, height);

  context.strokeStyle = 'rgba(220,0,140,0.45)';
  context.fillStyle = '#c1008c';
  context.font = '13px sans-serif';
  context.lineWidth = 1;
  for (let percent = 10; percent < 100; percent += 10) {
    const gx = x + (width * percent) / 100;
    const gy = y + (height * percent) / 100;
    context.beginPath();
    context.moveTo(gx, y);
    context.lineTo(gx, y + height);
    context.moveTo(x, gy);
    context.lineTo(x + width, gy);
    context.stroke();
    if (percent % 20 === 0) {
      context.fillText(String(percent), gx + 2, y - 3);
      context.fillText(String(percent), x - 24, gy + 4);
    }
  }
  context.strokeStyle = '#333';
  context.strokeRect(x, y, width, height);

  context.fillStyle = '#000';
  context.font = 'bold 16px sans-serif';
  context.fillText(`${basename(source)} (${image.width}x${image.height})`, x, y + height + 20);
}

writeFileSync(output, canvas.toBuffer('image/png'));
console.log(`${output} — ${canvas.width}x${canvas.height}`);
