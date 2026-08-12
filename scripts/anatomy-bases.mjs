/**
 * Готовит базовые иллюстрации регионов для модуля «Анатомия».
 *
 *   npm run assets:anatomy
 *
 * Регион — это то, что ребёнок видит на экране целиком: череп, рука, скелет,
 * тело с органами. На базовую картинку накладываются зоны клика (hotspots.ts),
 * поэтому здесь важно, чтобы кадр был стабильным: сдвинешь рамку — поедут все
 * зоны. Числа лежат в anatomy-crops.mjs (BASES), подгонка — через
 * `CELL=1300 COLUMNS=2 node scripts/anatomy-preview.mjs skull,muscles`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { BASES } from './anatomy-crops.mjs';

const FIGURES = join(process.cwd(), 'assets-src', 'figures');
const OUT = join(process.cwd(), 'public', 'anatomy', 'base');
const MAX_WIDTH = 1000;
const MAX_HEIGHT = 2200;

mkdirSync(OUT, { recursive: true });

export async function buildBases() {
  const manifest = [];

  for (const [id, spec] of Object.entries(BASES)) {
    const path = join(FIGURES, spec.source);
    if (!existsSync(path)) {
      console.warn(`${id}: нет исходника ${spec.source} — пропуск`);
      continue;
    }
    const image = await loadImage(readFileSync(path));

    // Маски закрашиваются до обрезки — их координаты заданы от целой страницы.
    const source = createCanvas(image.width, image.height);
    const sourceContext = source.getContext('2d');
    sourceContext.drawImage(image, 0, 0);
    sourceContext.fillStyle = '#ffffff';
    for (const [mx0, my0, mx1, my1] of spec.mask ?? []) {
      sourceContext.fillRect(
        Math.round(image.width * mx0),
        Math.round(image.height * my0),
        Math.round(image.width * (mx1 - mx0)),
        Math.round(image.height * (my1 - my0)),
      );
    }

    const [x0, y0, x1, y1] = spec.crop;
    const sx = Math.round(image.width * x0);
    const sy = Math.round(image.height * y0);
    const sw = Math.round(image.width * (x1 - x0));
    const sh = Math.round(image.height * (y1 - y0));

    const scale = Math.min(1, MAX_WIDTH / sw, MAX_HEIGHT / sh);
    const width = Math.round(sw * scale);
    const height = Math.round(sh * scale);

    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(source, sx, sy, sw, sh, 0, 0, width, height);

    writeFileSync(join(OUT, `${id}.webp`), canvas.toBuffer('image/webp'));
    manifest.push({ id, figure: spec.figure, titleRu: spec.titleRu, width, height });
    console.log(`base/${id}.webp — ${width}x${height} (рис. ${spec.figure})`);
  }

  const entries = manifest
    .map(
      (item) =>
        `  {\n    id: '${item.id}',\n    titleRu: '${item.titleRu}',\n    src: '/anatomy/base/${item.id}.webp',\n    width: ${item.width},\n    height: ${item.height},\n    figure: '${item.figure}',\n  },`,
    )
    .join('\n');

  writeFileSync(
    join(process.cwd(), 'src', 'modules', 'anatomy', 'data', 'bases.ts'),
    `import type { RegionId } from '../types.ts';

/**
 * Сгенерировано \`npm run assets:anatomy\` — вручную не править.
 *
 * Базовая иллюстрация региона: настоящий рисунок из учебника OpenStax, на
 * который накладываются зоны из hotspots.ts. Размеры нужны, чтобы держать
 * пропорции без скачка вёрстки при загрузке.
 */
export interface RegionBase {
  id: RegionId;
  titleRu: string;
  src: string;
  width: number;
  height: number;
  /** Номер рисунка в учебнике — для указания источника. */
  figure: string;
}

export const REGION_BASES: RegionBase[] = [
${entries}
];

export const BASE_BY_REGION: ReadonlyMap<RegionId, RegionBase> = new Map(
  REGION_BASES.map((base) => [base.id, base]),
);
`,
  );
  console.log('Манифест: src/modules/anatomy/data/bases.ts');

  return manifest;
}

if (process.argv[1]?.endsWith('anatomy-bases.mjs')) await buildBases();
