/**
 * Собирает итоговую базу модуля «Известные люди» и скачивает изображения.
 *
 *   node scripts/people-build.mjs
 *
 * Вход — результаты проверки (people-verified.json) и изображений
 * (people-images.json). В базу попадают только персоны с подтверждённым
 * изображением: остальные учились бы одним текстом, а модуль про лица.
 *
 * Имя для показа берётся из выверенного списка, а не из Wikidata: там русские
 * метки часто в форме «Чокин, Шафик Чокинович», а ребёнку нужно «Шәпік Шокин».
 * Wikidata остаётся источником проверки — годы, род занятий, описание.
 *
 * Известность (famousLevel) считается по числу языковых разделов Википедии:
 * это измеримый признак, а не наша оценка «кто важнее».
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const ROOT = process.cwd();
const VERIFIED = join(ROOT, 'assets-src', 'people-verified.json');
const IMAGES = join(ROOT, 'assets-src', 'people-images.json');
const CACHE = join(ROOT, 'assets-src', 'people-cache');
const PHOTO_DIR = join(ROOT, 'public', 'people');
const DATA_DIR = join(ROOT, 'src', 'modules', 'people', 'data');
const UA = 'Kiddo/1.0 (educational app for children; contact: nurtilek.galim@gmail.com)';
const MAX_SIDE = 480;

mkdirSync(PHOTO_DIR, { recursive: true });
mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(CACHE, { recursive: true });

const { verified } = JSON.parse(readFileSync(VERIFIED, 'utf8'));
const images = JSON.parse(readFileSync(IMAGES, 'utf8'));
const imageById = new Map(images.map((row) => [row.wikidataId, row]));

/** Латинский идентификатор из имени: он же имя файла и ключ карточки. */
const TRANSLIT = {
  а: 'a', ә: 'a', б: 'b', в: 'v', г: 'g', ғ: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh',
  з: 'z', и: 'i', й: 'i', к: 'k', қ: 'q', л: 'l', м: 'm', н: 'n', ң: 'n', о: 'o',
  ө: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ұ: 'u', ү: 'u', ф: 'f', х: 'h',
  һ: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', і: 'i', ь: '', э: 'e',
  ю: 'yu', я: 'ya',
};

function idFrom(name) {
  return [...name.toLowerCase()]
    .map((letter) => TRANSLIT[letter] ?? (/[a-z0-9]/.test(letter) ? letter : ' '))
    .join('')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Роль для карточки.
 *
 * Wikidata отдаёт занятия неупорядоченным списком, и «первое попавшееся» даёт
 * чепуху: Абай выходит лингвистом, а Димаш — композитором. Поэтому роли
 * ранжированы: чем меньше число, тем характернее роль для человека.
 * Женские формы подставляются по полу (P21), иначе певица становится певцом.
 */
const ROLE_RANK = [
  ['хан', 1, 'Хан'],
  ['монарх', 2, 'Хан'],
  ['суверен', 3, 'Хан'],
  ['военачальник', 4, 'Полководец'],
  ['батыр', 4, 'Батыр'],
  ['бий', 4, 'Бий'],
  ['акын', 5, 'Акын'],
  ['жырау', 5, 'Жырау'],
  ['певец', 6, 'Певец|Певица'],
  ['оперный певец', 6, 'Оперный певец|Оперная певица'],
  ['космонавт', 6, 'Космонавт'],
  ['боксёр', 6, 'Боксёр'],
  ['борец', 6, 'Борец'],
  ['шахматист', 6, 'Шахматист|Шахматистка'],
  ['шахматистка', 6, 'Шахматистка'],
  ['теннисист', 6, 'Теннисист|Теннисистка'],
  ['теннисистка', 6, 'Теннисистка'],
  ['тяжелоатлет', 6, 'Тяжелоатлет|Тяжелоатлетка'],
  ['легкоатлет', 6, 'Легкоатлет|Легкоатлетка'],
  ['фигурист', 6, 'Фигурист|Фигуристка'],
  ['велогонщик', 6, 'Велогонщик'],
  ['дзюдоист', 6, 'Дзюдоист'],
  ['пловец', 6, 'Пловец'],
  ['баскетболист', 6, 'Баскетболист'],
  ['лыжник', 6, 'Лыжник'],
  ['поэт', 7, 'Поэт|Поэтесса'],
  ['геолог', 7, 'Геолог'],
  ['художник', 7, 'Художник|Художница'],
  ['кинорежиссёр', 7, 'Кинорежиссёр'],
  ['композитор', 8, 'Композитор'],
  ['домбрист', 8, 'Домбрист'],
  ['дирижёр', 8, 'Дирижёр'],
  ['актёр', 8, 'Актёр|Актриса'],
  ['актриса', 8, 'Актриса'],
  ['лётчик', 8, 'Лётчик'],
  ['археолог', 8, 'Археолог'],
  ['этнограф', 8, 'Этнограф'],
  ['путешественник', 8, 'Путешественник'],
  ['математик', 9, 'Математик'],
  ['химик', 9, 'Химик'],
  ['биолог', 9, 'Биолог'],
  ['физик', 9, 'Физик'],
  ['врач', 9, 'Врач'],
  ['историк', 9, 'Историк'],
  ['лингвист', 10, 'Лингвист'],
  ['философ', 10, 'Философ'],
  ['педагог', 10, 'Педагог'],
  ['писатель', 11, 'Писатель|Писательница'],
  ['драматург', 11, 'Драматург'],
  ['переводчик', 12, 'Переводчик'],
  ['журналист', 12, 'Журналист'],
  ['скульптор', 12, 'Скульптор'],
  ['инженер', 12, 'Инженер'],
  ['юрист', 13, 'Юрист'],
  ['экономист', 13, 'Экономист'],
  ['революционер', 14, 'Революционер'],
  ['политик', 15, 'Политик'],
  ['государственный деятель', 16, 'Государственный деятель'],
];

const ROLE_INDEX = new Map(ROLE_RANK.map(([key, rank, label]) => [key, { rank, label }]));

function roleOf(person, female) {
  let best = null;
  for (const occupation of person.occupations ?? []) {
    const entry = ROLE_INDEX.get(occupation.toLowerCase());
    if (entry && (!best || entry.rank < best.rank)) best = entry;
  }
  if (!best) return null;
  const [male, feminine] = best.label.split('|');
  return female && feminine ? feminine : male;
}

/** Пол из кеша сущностей: нужен только чтобы согласовать род роли. */
function isFemale(wikidataId) {
  const file = join(CACHE, `entity-${wikidataId}.json`);
  if (!existsSync(file)) return false;
  const entity = JSON.parse(readFileSync(file, 'utf8'));
  const gender = entity.claims?.P21?.[0]?.mainsnak?.datavalue?.value?.id;
  return gender === 'Q6581072';
}

/** Число языковых разделов Википедии — измеримый признак известности. */
async function sitelinkCounts(ids) {
  const counts = {};
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const key = join(CACHE, `sitelinks-${batch[0]}-${batch.length}.json`);
    let json;
    if (existsSync(key)) {
      json = JSON.parse(readFileSync(key, 'utf8'));
    } else {
      const url = `https://www.wikidata.org/w/api.php?${new URLSearchParams({
        action: 'wbgetentities',
        ids: batch.join('|'),
        props: 'sitelinks',
        format: 'json',
      })}`;
      const response = await fetch(url, { headers: { 'User-Agent': UA } });
      json = await response.json();
      writeFileSync(key, JSON.stringify(json));
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    for (const [id, entity] of Object.entries(json.entities ?? {})) {
      counts[id] = Object.keys(entity.sitelinks ?? {}).length;
    }
  }
  return counts;
}

/** Скачивает изображение и приводит к квадрату с обрезкой по центру верха. */
async function downloadPhoto(url, targetPath) {
  if (existsSync(targetPath)) return true;
  try {
    // Commons ограничивает частоту: без пауз и повторов половина запросов
    // возвращает 429, и база молча недосчитывается людей.
    let response = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      response = await fetch(url, { headers: { 'User-Agent': UA } });
      if (response.ok) break;
      await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
    }
    if (!response?.ok) return false;
    const image = await loadImage(Buffer.from(await response.arrayBuffer()));

    // Портрет обрезается по квадрату: лицо почти всегда в верхней половине.
    const side = Math.min(image.width, image.height);
    const sx = Math.round((image.width - side) / 2);
    const sy = Math.round(Math.min((image.height - side) / 2, image.height * 0.08));

    const canvas = createCanvas(MAX_SIDE, MAX_SIDE);
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, MAX_SIDE, MAX_SIDE);
    context.drawImage(image, sx, sy, side, side, 0, 0, MAX_SIDE, MAX_SIDE);
    writeFileSync(targetPath, canvas.toBuffer('image/webp'));
    return true;
  } catch {
    return false;
  }
}

// ── Сборка ──────────────────────────────────────────────────────────────────
const withImage = verified.filter((person) => imageById.get(person.wikidataId)?.image);
const counts = await sitelinkCounts(withImage.map((person) => person.wikidataId));

const people = [];
const credits = [];
const usedIds = new Set();
/** Один файл — один человек: поиск по Commons иногда отдаёт общую иллюстрацию
 *  сразу нескольким ханам, а двое с одним лицом сломали бы квиз. */
const usedFiles = new Set();
let failed = 0;
let sharedImage = 0;
let noRole = 0;

for (const [index, person] of withImage.entries()) {
  const record = imageById.get(person.wikidataId);
  const role = roleOf(person, isFemale(person.wikidataId));
  if (!role) {
    noRole += 1;
    continue;
  }
  if (usedFiles.has(record.image.fileName)) {
    sharedImage += 1;
    continue;
  }
  usedFiles.add(record.image.fileName);

  let id = idFrom(person.seedName);
  while (usedIds.has(id)) id = `${id}-2`;
  usedIds.add(id);

  const ok = await downloadPhoto(record.image.url, join(PHOTO_DIR, `${id}.webp`));
  if (!ok) {
    failed += 1;
    usedFiles.delete(record.image.fileName);
    continue;
  }
  await new Promise((resolve) => setTimeout(resolve, 120));

  const links = counts[person.wikidataId] ?? 0;
  people.push({
    id,
    nameRu: person.seedName,
    nameKk: person.nameKk,
    role,
    shortDescription: person.descriptionRu ?? person.descriptionEn ?? null,
    category: person.category,
    birthYear: person.birthYear,
    deathYear: person.deathYear,
    imageKind: record.imageKind,
    famousLevel: links >= 25 ? 3 : links >= 10 ? 2 : 1,
    wikidataId: person.wikidataId,
  });

  credits.push({
    id,
    file: record.image.fileName,
    license: record.image.license,
    licenseUrl: record.image.licenseUrl,
    author: record.image.author,
    attribution: record.image.attribution,
    sourceUrl: record.image.descriptionPage,
    dataSource: person.source,
    kazakhEvidence: person.kazakhEvidence,
  });

  if ((index + 1) % 20 === 0) process.stdout.write(`\r${index + 1}/${withImage.length}`);
}
process.stdout.write(`\r${withImage.length}/${withImage.length}\n`);

// ── Запись ──────────────────────────────────────────────────────────────────
const line = (person) =>
  `  {\n` +
  `    id: '${person.id}',\n` +
  `    nameRu: ${JSON.stringify(person.nameRu)},\n` +
  `    nameKk: ${JSON.stringify(person.nameKk)},\n` +
  `    role: ${JSON.stringify(person.role)},\n` +
  `    shortDescription: ${JSON.stringify(person.shortDescription)},\n` +
  `    category: '${person.category}',\n` +
  `    birthYear: ${person.birthYear},\n` +
  `    deathYear: ${person.deathYear},\n` +
  `    imageKind: '${person.imageKind}',\n` +
  `    famousLevel: ${person.famousLevel},\n` +
  `    wikidataId: '${person.wikidataId}',\n` +
  `  },`;

writeFileSync(
  join(DATA_DIR, 'people.ts'),
  `import type { Person } from '../types.ts';

/**
 * Сгенерировано \`npm run data:people\` — вручную не править.
 *
 * Каждая запись проверена по Wikidata: годы жизни, род занятий и описание
 * взяты оттуда, а не написаны по памяти. Имя для показа — из выверенного
 * списка (scripts/people-seed.mjs): в Wikidata русские метки часто идут в
 * форме «Фамилия, Имя Отчество».
 *
 * В базу попадают только персоны с подтверждённым изображением и понятной
 * ролью. Лицензии и авторы — в credits.ts.
 */
export const PEOPLE: Person[] = [
${people.map(line).join('\n')}
];
`,
);

writeFileSync(
  join(DATA_DIR, 'credits.ts'),
  `/**
 * Сгенерировано \`npm run data:people\` — вручную не править.
 *
 * Происхождение каждого изображения: файл на Wikimedia Commons, лицензия,
 * автор и ссылка на страницу файла. Без этих данных изображение не
 * показывается: подставлять картинку неизвестного происхождения нельзя.
 */
export interface PersonCredit {
  id: string;
  file: string;
  license: string;
  licenseUrl: string | null;
  author: string | null;
  attribution: string | null;
  sourceUrl: string;
  dataSource: string;
  kazakhEvidence: string;
}

export const PERSON_CREDITS: PersonCredit[] = ${JSON.stringify(credits, null, 2)};

export const CREDIT_BY_ID: ReadonlyMap<string, PersonCredit> = new Map(
  PERSON_CREDITS.map((credit) => [credit.id, credit]),
);
`,
);

const byCategory = {};
for (const person of people) byCategory[person.category] = (byCategory[person.category] ?? 0) + 1;
const byKind = {};
for (const person of people) byKind[person.imageKind] = (byKind[person.imageKind] ?? 0) + 1;

console.log(`\nВ базе персон:        ${people.length}`);
console.log(`Не скачалось фото:    ${failed}`);
console.log(`Общее фото на двоих:  ${sharedImage}`);
console.log(`Без понятной роли:    ${noRole}`);
console.log(`По категориям:        ${JSON.stringify(byCategory)}`);
console.log(`Тип изображения:      ${JSON.stringify(byKind)}`);
console.log(`\nsrc/modules/people/data/people.ts`);
console.log(`src/modules/people/data/credits.ts`);
console.log(`public/people/*.webp`);
