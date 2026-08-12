/**
 * Распаковывает картинки из презентаций SMART (Servier Medical Art).
 *
 *   npm run assets:extract
 *
 * Файл .pptx — это обычный zip: изображения лежат в ppt/media. Скрипт
 * раскрывает каждую презентацию во временную папку и складывает медиа в
 * assets-src/extracted/<название-презентации>/, после чего печатает сводку
 * по типам файлов — по ней видно, растровые там иллюстрации или векторные.
 *
 * Ничего не перезаписывает в public/: отбор и переименование под конкретные
 * анатомические структуры — отдельный, ручной шаг.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

const root = process.cwd();
const SOURCE = join(root, 'assets-src', 'smart');
const OUT = join(root, 'assets-src', 'extracted');
const TEMP = join(root, 'assets-src', '.tmp');

if (!existsSync(SOURCE)) {
  console.error(`Нет папки ${SOURCE}. Скопируйте туда файлы .pptx и запустите снова.`);
  process.exit(1);
}

const decks = readdirSync(SOURCE).filter((name) => name.toLowerCase().endsWith('.pptx'));
if (decks.length === 0) {
  console.error(`В ${SOURCE} нет файлов .pptx.`);
  process.exit(1);
}

/** Windows умеет распаковывать zip штатно — сторонние зависимости не нужны. */
function unzip(archive, target) {
  execFileSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `Expand-Archive -LiteralPath '${archive}' -DestinationPath '${target}' -Force`,
    ],
    { stdio: 'pipe' },
  );
}

rmSync(TEMP, { recursive: true, force: true });
mkdirSync(TEMP, { recursive: true });
mkdirSync(OUT, { recursive: true });

const byExtension = new Map();
let totalFiles = 0;

for (const deck of decks) {
  const name = basename(deck, '.pptx');
  const zipPath = join(TEMP, `${name}.zip`);
  const unpacked = join(TEMP, name);

  cpSync(join(SOURCE, deck), zipPath);
  try {
    unzip(zipPath, unpacked);
  } catch {
    console.warn(`Не удалось распаковать ${deck}`);
    continue;
  }

  const media = join(unpacked, 'ppt', 'media');
  if (!existsSync(media)) {
    console.log(`${name}: медиафайлов нет (иллюстрации нарисованы фигурами PowerPoint)`);
    continue;
  }

  const target = join(OUT, name);
  mkdirSync(target, { recursive: true });
  const files = readdirSync(media);
  for (const file of files) {
    cpSync(join(media, file), join(target, file));
    const ext = extname(file).toLowerCase() || '(без расширения)';
    byExtension.set(ext, (byExtension.get(ext) ?? 0) + 1);
    totalFiles += 1;
  }

  const biggest = files
    .map((file) => ({ file, size: statSync(join(media, file)).size }))
    .sort((a, b) => b.size - a.size)[0];
  console.log(
    `${name}: ${files.length} файлов` +
      (biggest ? ` · крупнейший ${biggest.file} (${Math.round(biggest.size / 1024)} КБ)` : ''),
  );
}

rmSync(TEMP, { recursive: true, force: true });

console.log(`\nВсего извлечено файлов: ${totalFiles}`);
console.log('По типам:', Object.fromEntries([...byExtension].sort((a, b) => b[1] - a[1])));
console.log(`\nРезультат: ${OUT}`);
