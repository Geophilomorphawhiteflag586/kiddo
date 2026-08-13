/**
 * Проверяет список персон по Wikidata и собирает подтверждённые данные.
 *
 *   node scripts/people-fetch.mjs
 *
 * Что делает по шагам:
 *   1. ищет каждое имя из scripts/people-seed.mjs (поиск идёт по казахской,
 *      русской и английской меткам — часть персон заведена только латиницей);
 *   2. выкачивает найденные сущности пачками по 50;
 *   3. выбирает кандидата: человек (P31=Q5) со связью с Казахстаном;
 *   4. добирает страны рождения и названия профессий отдельными пачками;
 *   5. пишет assets-src/people-verified.json со ссылкой на источник для
 *      каждого поля.
 *
 * Ничего не сочиняет: если человек не нашёлся или связь с Казахстаном не
 * подтвердилась, запись помечается и в базу не идёт. Ответы кешируются в
 * assets-src/people-cache — повторный запуск не ходит в сеть.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSeed } from './people-seed.mjs';

const CACHE = join(process.cwd(), 'assets-src', 'people-cache');
const OUT = join(process.cwd(), 'assets-src', 'people-verified.json');
const API = 'https://www.wikidata.org/w/api.php';
const UA = 'Kiddo/1.0 (educational app for children; contact: nurtilek.galim@gmail.com)';

mkdirSync(CACHE, { recursive: true });

const slug = (text) => text.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase().slice(0, 80);

async function cached(key, load) {
  const file = join(CACHE, `${slug(key)}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  const value = await load();
  writeFileSync(file, JSON.stringify(value));
  // Вежливая пауза: Wikidata просит не молотить её без передышки.
  await new Promise((resolve) => setTimeout(resolve, 120));
  return value;
}

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', origin: '*', ...params })}`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': UA } });
      if (response.ok) return await response.json();
    } catch {
      /* сеть моргнула — пробуем ещё раз */
    }
    await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
  }
  throw new Error(`Wikidata не ответила: ${JSON.stringify(params)}`);
}

const search = (text, language) =>
  cached(`search-${language}-${text}`, async () => {
    const json = await api({
      action: 'wbsearchentities',
      search: text,
      language,
      uselang: language,
      type: 'item',
      limit: '7',
    });
    return (json.search ?? []).map((item) => item.id);
  });

/** Сущности выкачиваются пачками: 250 персон в одиночных запросах — это часы. */
async function entities(ids) {
  const result = {};
  const missing = [];
  for (const id of ids) {
    const file = join(CACHE, `entity-${id}.json`);
    if (existsSync(file)) result[id] = JSON.parse(readFileSync(file, 'utf8'));
    else missing.push(id);
  }
  for (let i = 0; i < missing.length; i += 50) {
    const batch = missing.slice(i, i + 50);
    const json = await api({
      action: 'wbgetentities',
      ids: batch.join('|'),
      props: 'labels|descriptions|claims',
      languages: 'ru|kk|en',
    });
    for (const [id, entity] of Object.entries(json.entities ?? {})) {
      const trimmed = {
        labels: entity.labels ?? {},
        descriptions: entity.descriptions ?? {},
        claims: entity.claims ?? {},
      };
      writeFileSync(join(CACHE, `entity-${id}.json`), JSON.stringify(trimmed));
      result[id] = trimmed;
    }
    process.stdout.write(`\rсущностей загружено: ${Math.min(i + 50, missing.length)}/${missing.length}`);
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  if (missing.length > 0) process.stdout.write('\n');
  return result;
}

const claim = (entity, property) => entity?.claims?.[property] ?? [];
const claimIds = (entity, property) =>
  claim(entity, property)
    .map((statement) => statement.mainsnak?.datavalue?.value?.id)
    .filter(Boolean);
const claimValue = (entity, property) =>
  claim(entity, property)[0]?.mainsnak?.datavalue?.value ?? null;

/** Год из даты Wikidata: там встречается и «+1845-00-00T00:00:00Z». */
function yearOf(entity, property) {
  const time = claim(entity, property)[0]?.mainsnak?.datavalue?.value?.time;
  if (!time) return null;
  const match = /^([+-])(\d{4})/.exec(time);
  if (!match) return null;
  const year = Number(match[2]);
  return match[1] === '-' ? -year : year;
}

const HUMAN = 'Q5';
const KAZAKHSTAN = 'Q232';
/** Государства, гражданство которых само по себе не доказывает связь с КЗ. */
const WEAK_STATES = new Set(['Q15180', 'Q34266', 'Q159', 'Q2184']);
const KZ_WORDS = /казах|қазақ|kazakh|kazakstan|казахстан/i;

/** Чем именно подтверждается связь с Казахстаном. */
function kazakhEvidence(entity, birthCountry) {
  if (claimIds(entity, 'P27').includes(KAZAKHSTAN)) return 'гражданство Казахстана';
  if (birthCountry === KAZAKHSTAN) return 'место рождения в Казахстане';
  const text = ['ru', 'en', 'kk']
    .map((language) => entity.descriptions?.[language]?.value ?? '')
    .join(' ');
  if (KZ_WORDS.test(text)) return `описание Wikidata: «${text.trim().slice(0, 60)}»`;
  if (claimIds(entity, 'P27').some((id) => WEAK_STATES.has(id)) && entity.labels?.kk) {
    return 'казахская метка при советском/имперском гражданстве';
  }
  return null;
}

// ── 1. Поиск кандидатов ─────────────────────────────────────────────────────
const seed = parseSeed();
console.log(`Персон в списке: ${seed.length}\n`);

const candidates = new Map();
for (const [index, row] of seed.entries()) {
  const ids = new Set();
  for (const [text, language] of [
    [row.hint, 'en'],
    [row.name, 'ru'],
    [row.name, 'kk'],
  ]) {
    for (const id of await search(text, language)) ids.add(id);
  }
  candidates.set(row.name, [...ids]);
  if ((index + 1) % 25 === 0) process.stdout.write(`\rпоиск: ${index + 1}/${seed.length}`);
}
process.stdout.write(`\rпоиск: ${seed.length}/${seed.length}\n`);

// ── 2. Загрузка сущностей ───────────────────────────────────────────────────
const allIds = [...new Set([...candidates.values()].flat())];
console.log(`Кандидатов всего: ${allIds.length}`);
const store = await entities(allIds);

// ── 3. Страны мест рождения ─────────────────────────────────────────────────
const places = new Set();
for (const entity of Object.values(store)) for (const id of claimIds(entity, 'P19')) places.add(id);
const placeStore = await entities([...places]);
const countryOfPlace = (placeId) => claimIds(placeStore[placeId], 'P17')[0] ?? null;

// ── 4. Выбор кандидата ──────────────────────────────────────────────────────
const verified = [];
const rejected = [];

for (const row of seed) {
  let best = null;
  for (const id of candidates.get(row.name) ?? []) {
    const entity = store[id];
    if (!entity || !claimIds(entity, 'P31').includes(HUMAN)) continue;
    const birthCountry = countryOfPlace(claimIds(entity, 'P19')[0]);
    const evidence = kazakhEvidence(entity, birthCountry);
    if (!evidence) continue;
    const score =
      (claimIds(entity, 'P27').includes(KAZAKHSTAN) ? 4 : 0) +
      (birthCountry === KAZAKHSTAN ? 3 : 0) +
      (claimValue(entity, 'P18') ? 2 : 0) +
      (entity.labels?.kk ? 1 : 0) +
      (yearOf(entity, 'P569') ? 1 : 0);
    if (!best || score > best.score) best = { id, entity, evidence, score, birthCountry };
  }

  if (!best) {
    rejected.push({ name: row.name, reason: 'не найден человек со связью с Казахстаном' });
    continue;
  }

  const image = claimValue(best.entity, 'P18');
  verified.push({
    seedName: row.name,
    category: row.category,
    wikidataId: best.id,
    nameRu: best.entity.labels?.ru?.value ?? row.name,
    nameKk: best.entity.labels?.kk?.value ?? null,
    nameEn: best.entity.labels?.en?.value ?? null,
    descriptionRu: best.entity.descriptions?.ru?.value ?? null,
    descriptionEn: best.entity.descriptions?.en?.value ?? null,
    birthYear: yearOf(best.entity, 'P569'),
    deathYear: yearOf(best.entity, 'P570'),
    occupationIds: claimIds(best.entity, 'P106'),
    imageFile: typeof image === 'string' ? image : null,
    kazakhEvidence: best.evidence,
    source: `https://www.wikidata.org/wiki/${best.id}`,
  });
}

// ── 5. Названия профессий ───────────────────────────────────────────────────
const occupations = new Set(verified.flatMap((person) => person.occupationIds));
const occupationStore = await entities([...occupations]);
const occupationName = (id) =>
  occupationStore[id]?.labels?.ru?.value ?? occupationStore[id]?.labels?.en?.value ?? null;

for (const person of verified) {
  person.occupations = person.occupationIds.map(occupationName).filter(Boolean);
  delete person.occupationIds;
}

// ── 6. Отчёт ────────────────────────────────────────────────────────────────
const ids = verified.map((person) => person.wikidataId);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);

writeFileSync(OUT, JSON.stringify({ verified, rejected, duplicates }, null, 2));

console.log(`\nПодтверждено:      ${verified.length}`);
console.log(`Не найдено:        ${rejected.length}`);
console.log(`Дубликаты по QID:  ${duplicates.length}`);
console.log(`С фотографией:     ${verified.filter((p) => p.imageFile).length}`);
console.log(`С годом рождения:  ${verified.filter((p) => p.birthYear).length}`);
console.log(`\n${OUT}`);
