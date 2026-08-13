/**
 * Достаёт изображения персон и их лицензии.
 *
 *   node scripts/people-images.mjs
 *
 * Источник первого выбора — поле P18 в Wikidata. Если его нет (так у всех
 * ханов и батыров), ищем по Commons: у исторических фигур там лежат портреты
 * XIX века, памятники и изображения с банкнот — именно то, чем их показывают
 * в книгах.
 *
 * Каждое изображение классифицируется:
 *   photo     — фотография человека (жил в эпоху фотографии);
 *   depiction — портрет, памятник, рисунок: как выглядел на самом деле,
 *               неизвестно. В интерфейсе такие подписываются отдельно, чтобы
 *               ребёнок не запоминал фантазию художника как настоящее лицо.
 *
 * Для каждого файла сохраняются автор, лицензия и ссылка на страницу файла:
 * без этого изображение в production не идёт.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CACHE = join(process.cwd(), 'assets-src', 'people-cache');
const INPUT = join(process.cwd(), 'assets-src', 'people-verified.json');
const OUT = join(process.cwd(), 'assets-src', 'people-images.json');
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const UA = 'Kiddo/1.0 (educational app for children; contact: nurtilek.galim@gmail.com)';

/** Раньше этого года фотографии человека быть не может. */
const PHOTOGRAPHY_FROM = 1840;

mkdirSync(CACHE, { recursive: true });
const slug = (text) => text.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase().slice(0, 90);

async function cached(key, load) {
  const file = join(CACHE, `${slug(key)}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  const value = await load();
  writeFileSync(file, JSON.stringify(value));
  await new Promise((resolve) => setTimeout(resolve, 120));
  return value;
}

async function commons(params) {
  const url = `${COMMONS}?${new URLSearchParams({ format: 'json', origin: '*', ...params })}`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': UA } });
      if (response.ok) return await response.json();
    } catch {
      /* повтор */
    }
    await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
  }
  return null;
}

/** Ищет файл на Commons по имени персоны. */
async function findFile(person) {
  const queries = [person.nameEn, person.nameRu, person.nameKk].filter(Boolean);
  for (const query of queries) {
    const json = await cached(`commons-search-${query}`, () =>
      commons({
        action: 'query',
        list: 'search',
        srsearch: `${query} filetype:bitmap`,
        srnamespace: '6',
        srlimit: '10',
      }),
    );
    const hits = json?.query?.search ?? [];
    // Берём только файлы, в названии которых есть фамилия: поиск Commons
    // охотно возвращает улицы и здания, названные в честь человека.
    const surname = (person.nameEn ?? person.nameRu ?? '').split(/[\s,]+/).filter(Boolean).pop();
    const good = hits.find(
      (hit) =>
        surname &&
        hit.title.toLowerCase().includes(surname.toLowerCase()) &&
        !/street|avenue|mosque|building|map|logo|coat of arms|flag/i.test(hit.title),
    );
    if (good) return good.title.replace(/^File:/, '');
  }
  return null;
}

/** Лицензия и автор файла. */
async function fileMeta(fileName) {
  const json = await cached(`commons-meta-${fileName}`, () =>
    commons({
      action: 'query',
      prop: 'imageinfo',
      iiprop: 'extmetadata|url|size',
      titles: `File:${fileName}`,
    }),
  );
  const page = Object.values(json?.query?.pages ?? {})[0];
  const info = page?.imageinfo?.[0];
  if (!info) return null;
  const meta = info.extmetadata ?? {};
  const strip = (value) => (value ? String(value).replace(/<[^>]*>/g, '').trim() : null);
  return {
    fileName,
    url: info.url,
    width: info.width,
    height: info.height,
    license: strip(meta.LicenseShortName?.value) ?? 'не указана',
    licenseUrl: strip(meta.LicenseUrl?.value),
    author: strip(meta.Artist?.value),
    attribution: strip(meta.Attribution?.value),
    descriptionPage: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName)}`,
  };
}

const { verified } = JSON.parse(readFileSync(INPUT, 'utf8'));
const result = [];
let searched = 0;

for (const [index, person] of verified.entries()) {
  let file = person.imageFile;
  if (!file) {
    file = await findFile(person);
    searched += 1;
  }

  const meta = file ? await fileMeta(file) : null;
  const lastYear = person.deathYear ?? person.birthYear;
  const kind = !meta ? 'none' : lastYear && lastYear < PHOTOGRAPHY_FROM ? 'depiction' : 'photo';

  result.push({
    wikidataId: person.wikidataId,
    seedName: person.seedName,
    imageKind: kind,
    image: meta,
  });

  if ((index + 1) % 25 === 0) process.stdout.write(`\r${index + 1}/${verified.length}`);
}
process.stdout.write(`\r${verified.length}/${verified.length}\n`);

writeFileSync(OUT, JSON.stringify(result, null, 2));

const photos = result.filter((r) => r.imageKind === 'photo').length;
const depictions = result.filter((r) => r.imageKind === 'depiction').length;
const none = result.filter((r) => r.imageKind === 'none').length;
const licenses = {};
for (const r of result) if (r.image) licenses[r.image.license] = (licenses[r.image.license] ?? 0) + 1;

console.log(`\nДоискивали по Commons: ${searched}`);
console.log(`Фотографии:            ${photos}`);
console.log(`Портреты и памятники:  ${depictions}`);
console.log(`Без изображения:       ${none}`);
console.log('\nЛицензии:');
for (const [name, count] of Object.entries(licenses).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(3)}  ${name}`);
}
console.log(`\n${OUT}`);
