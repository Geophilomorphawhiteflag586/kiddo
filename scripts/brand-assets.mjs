/**
 * Раскладывает фирменные картинки по местам.
 *
 *   npm run assets:brand
 *
 * Кладите оригиналы (любой размер, png / jpg / webp / svg) в assets-src/brand/
 * с такими именами:
 *
 *   logo.*        — полный логотип со словом «kiddo»
 *   mark.*        — только знак (оранжевая «o»), пойдёт в иконку вкладки
 *   geography.*   ┐
 *   mathematics.* │
 *   english.*     │ значки направлений: по одному на карточку в «Учиться».
 *   chinese.*     │ Имя файла = id модуля из src/modules/registry.ts
 *   anatomy.*     │
 *   chess.*       │
 *   people.*      ┘
 *
 * Скрипт сам уменьшит их до разумного размера, переведёт в webp и положит в
 * public/brand и public/modules. Оригиналы остаются в assets-src (эта папка в
 * .gitignore), в репозиторий уезжают только готовые файлы.
 *
 * SVG копируется как есть — его незачем растрировать.
 */
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const SOURCE = join(process.cwd(), 'assets-src', 'brand');
const BRAND_OUT = join(process.cwd(), 'public', 'brand');
const MODULES_OUT = join(process.cwd(), 'public', 'modules');

/** id модулей — должны совпадать с реестром направлений. */
const MODULE_IDS = [
  'geography',
  'mathematics',
  'english',
  'chinese',
  'anatomy',
  'chess',
  'people',
];

/** Максимальный размер по каждой стороне. Больше на экране всё равно не нужно. */
const LIMITS = {
  logo: { width: 720, height: 240 },
  mark: { width: 256, height: 256 },
  // Картинки направлений горизонтальные и показываются во всю карточку,
  // поэтому предел выше и без квадратной обрезки.
  module: { width: 1200, height: 900 },
};

const SUPPORTED = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']);

mkdirSync(SOURCE, { recursive: true });
mkdirSync(BRAND_OUT, { recursive: true });
mkdirSync(MODULES_OUT, { recursive: true });

const files = readdirSync(SOURCE).filter((name) => SUPPORTED.has(extname(name).toLowerCase()));

if (files.length === 0) {
  // Манифест всё равно перезапишется — с пустыми значениями. Так интерфейс
  // продолжает собираться, просто рисует запасные варианты.
  console.log(`Папка пуста: ${SOURCE}`);
  console.log('\nПоложите туда файлы с такими именами (расширение любое из png/jpg/webp/svg):');
  console.log('  logo.png        — логотип целиком');
  console.log('  mark.png        — знак для иконки вкладки');
  for (const id of MODULE_IDS) console.log(`  ${(id + '.png').padEnd(15)} — значок направления`);
  console.log('\nПотом запустите команду ещё раз.\n');
}

/**
 * Делает фон прозрачным и обрезает пустые поля.
 *
 * Заливка идёт от краёв кадра, поэтому светлая обводка внутри рисунка (белый
 * контур-наклейка у логотипа) остаётся на месте: до неё заливка не доходит,
 * её отделяет тень. Возвращает границы непрозрачной части.
 */
function cutBackground(context, width, height) {
  const image = context.getImageData(0, 0, width, height);
  const pixels = image.data;
  const seen = new Uint8Array(width * height);
  const stack = [];

  const isBackground = (index) => {
    const offset = index * 4;
    return pixels[offset] > 244 && pixels[offset + 1] > 244 && pixels[offset + 2] > 244;
  };

  for (let x = 0; x < width; x += 1) {
    stack.push(x, (height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    stack.push(y * width, y * width + width - 1);
  }

  while (stack.length > 0) {
    const index = stack.pop();
    if (seen[index] || !isBackground(index)) continue;
    seen[index] = 1;
    pixels[index * 4 + 3] = 0;

    const x = index % width;
    const y = (index - x) / width;
    if (x > 0) stack.push(index - 1);
    if (x < width - 1) stack.push(index + 1);
    if (y > 0) stack.push(index - width);
    if (y < height - 1) stack.push(index + width);
  }

  context.putImageData(image, 0, 0);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? { x: 0, y: 0, width, height } : {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/** Уменьшает картинку под ограничение и сохраняет в webp. */
async function convert(sourcePath, targetPath, limit, { transparent = false } = {}) {
  const image = await loadImage(readFileSync(sourcePath));

  if (transparent) {
    const full = createCanvas(image.width, image.height);
    const fullContext = full.getContext('2d');
    fullContext.drawImage(image, 0, 0);
    const box = cutBackground(fullContext, image.width, image.height);

    const scale = Math.min(1, limit.width / box.width, limit.height / box.height);
    const width = Math.max(1, Math.round(box.width * scale));
    const height = Math.max(1, Math.round(box.height * scale));
    const canvas = createCanvas(width, height);
    canvas
      .getContext('2d')
      .drawImage(full, box.x, box.y, box.width, box.height, 0, 0, width, height);
    writeFileSync(targetPath, canvas.toBuffer('image/webp'));
    return `${width}x${height} (обрезано с ${image.width}x${image.height})`;
  }

  const scale = Math.min(1, limit.width / image.width, limit.height / image.height);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = createCanvas(width, height);
  canvas.getContext('2d').drawImage(image, 0, 0, width, height);
  writeFileSync(targetPath, canvas.toBuffer('image/webp'));
  return `${width}x${height}`;
}

async function place(stem, limit, outDir, options) {
  const match = files.find((name) => basename(name, extname(name)).toLowerCase() === stem);
  if (!match) return null;

  const sourcePath = join(SOURCE, match);
  // Вектор не трогаем: он и так масштабируется без потерь.
  if (extname(match).toLowerCase() === '.svg') {
    const target = join(outDir, `${stem}.svg`);
    copyFileSync(sourcePath, target);
    console.log(`${stem}.svg — скопирован как есть`);
    return { file: `${stem}.svg`, width: 0, height: 0 };
  }

  const target = join(outDir, `${stem}.webp`);
  const size = await convert(sourcePath, target, limit, options);
  console.log(`${stem}.webp — ${size} (из ${match})`);
  const [width, height] = size.split(' ')[0].split('x').map(Number);
  return { file: `${stem}.webp`, width, height };
}

const placed = { logo: null, mark: null, modules: {} };

placed.logo = await place('logo', LIMITS.logo, BRAND_OUT, { transparent: true });
placed.mark = await place('mark', LIMITS.mark, BRAND_OUT, { transparent: true });
for (const id of MODULE_IDS) {
  const result = await place(id, LIMITS.module, MODULES_OUT);
  if (result) {
    placed.modules[id] = {
      src: `/modules/${result.file}`,
      width: result.width,
      height: result.height,
    };
  }
}

// Манифест читают компоненты: чего нет — рисуется как раньше.
writeFileSync(
  join(process.cwd(), 'src', 'lib', 'brandAssets.ts'),
  `/**
 * Сгенерировано \`npm run assets:brand\` — вручную не править.
 *
 * Пути к фирменным картинкам. Пустое значение означает «файла нет»: в этом
 * случае интерфейс рисует запасной вариант — логотип вёрсткой, значок
 * направления символом. Положите файл в assets-src/brand и перезапустите
 * команду, чтобы подставился ваш.
 */
export const BRAND_LOGO: string | null = ${placed.logo ? `'/brand/${placed.logo.file}'` : 'null'};
export const BRAND_MARK: string | null = ${placed.mark ? `'/brand/${placed.mark.file}'` : 'null'};

/** Размеры нужны карточке: она берёт пропорцию своей картинки, чтобы
 *  показать её целиком, без обрезки и без пустых полей. */
export interface ModuleIcon {
  src: string;
  width: number;
  height: number;
}

export const MODULE_ICONS: Record<string, ModuleIcon> = ${JSON.stringify(placed.modules, null, 2)};
`,
);

const missing = MODULE_IDS.filter((id) => !placed.modules[id]);
console.log(`\nЗначков направлений: ${Object.keys(placed.modules).length} из ${MODULE_IDS.length}`);
if (missing.length > 0) console.log(`Нет файлов для: ${missing.join(', ')}`);
if (!placed.logo) console.log('Логотипа нет — рисуется вёрсткой.');
console.log('Манифест: src/lib/brandAssets.ts');
