/**
 * Собирает манифест иллюстраций анатомии по готовым файлам.
 *
 *   node scripts/anatomy-manifest.mjs
 *
 * Запускается последним в цепочке `npm run assets:anatomy`. Сканирует
 * public/anatomy, поэтому неважно, каким скриптом сделан файл: из учебника
 * (anatomy-images.mjs) или с плаката (anatomy-poster.mjs). Кто записал файл
 * последним — того версия и попадает в приложение.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { loadImage } from '@napi-rs/canvas';
import { CROPS } from './anatomy-crops.mjs';
import { POSTER_CROPS } from './anatomy-poster-crops.mjs';

const OUT = join(process.cwd(), 'public', 'anatomy');

const files = readdirSync(OUT).filter((name) => name.endsWith('.webp'));

const entries = [];
for (const file of files.sort()) {
  const id = basename(file, '.webp');
  const image = await loadImage(readFileSync(join(OUT, file)));
  // Плакат перезаписывает файл после учебника, поэтому его источник главнее.
  const source = id in POSTER_CROPS ? 'poster' : 'openstax';
  const figure = source === 'openstax' ? (CROPS[id]?.figure ?? '') : '';
  entries.push({ id, width: image.width, height: image.height, source, figure });
}

const lines = entries
  .map(
    (item) =>
      `  ${item.id}: { src: '/anatomy/${item.id}.webp', width: ${item.width}, height: ${item.height}, source: '${item.source}'${item.figure ? `, figure: '${item.figure}'` : ''} },`,
  )
  .join('\n');

writeFileSync(
  join(process.cwd(), 'src', 'modules', 'anatomy', 'data', 'images.ts'),
  `/**
 * Сгенерировано \`npm run assets:anatomy\` — вручную не править.
 *
 * Крупный план структуры для вопросов «Что это?» и «Найди изображение».
 * Два источника: органы нарезаны с анатомического плаката (там они нарисованы
 * изолированно и в цвете), кости — из учебника OpenStax. Структуры, которых
 * здесь нет, показываются базовой иллюстрацией региона с обведённой областью.
 */
export type ImageSource = 'openstax' | 'poster';

export interface StructureImage {
  src: string;
  width: number;
  height: number;
  source: ImageSource;
  /** Номер рисунка в учебнике — только для источника openstax. */
  figure?: string;
}

export const STRUCTURE_IMAGES: Record<string, StructureImage> = {
${lines}
};

/** Иллюстрация структуры, если она есть. */
export function structureImage(id: string): StructureImage | null {
  return STRUCTURE_IMAGES[id] ?? null;
}

/** Все ли структуры набора показываются фотографией: варианты не должны различаться по виду. */
export function allHaveImages(ids: string[]): boolean {
  return ids.length > 0 && ids.every((id) => id in STRUCTURE_IMAGES);
}
`,
);

const byPoster = entries.filter((item) => item.source === 'poster').length;
console.log(`Манифест: ${entries.length} иллюстраций (плакат — ${byPoster}, учебник — ${entries.length - byPoster})`);
