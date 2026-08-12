/**
 * Генератор статического датасета стран.
 *
 *   node scripts/generate-countries.mjs
 *
 * Источник: пакет `world-countries` (devDependency) + ручной словарь столиц
 * на русском (src/data/capitals.ru.json). Результат — src/data/countries.ts,
 * который коммитится в репозиторий: в рантайме никаких сетевых запросов
 * к справочникам не делается.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const world = JSON.parse(
  readFileSync(resolve(root, 'node_modules/world-countries/countries.json'), 'utf8'),
);
const capitalsRu = JSON.parse(readFileSync(resolve(root, 'src/data/capitals.ru.json'), 'utf8'));

/** Страны, чьё русское название в источнике неудачное или непривычное. */
const NAME_OVERRIDES = {
  CD: 'ДР Конго',
  CG: 'Республика Конго',
  KP: 'Северная Корея',
  KR: 'Южная Корея',
  GB: 'Великобритания',
  US: 'США',
  AE: 'ОАЭ',
  CZ: 'Чехия',
  VA: 'Ватикан',
  TL: 'Восточный Тимор',
  SZ: 'Эсватини',
  MM: 'Мьянма',
  CI: "Кот-д'Ивуар",
  MK: 'Северная Македония',
  CF: 'ЦАР',
  ST: 'Сан-Томе и Принсипи',
  VC: 'Сент-Винсент и Гренадины',
  KN: 'Сент-Китс и Невис',
  BA: 'Босния и Герцеговина',
  TT: 'Тринидад и Тобаго',
  AG: 'Антигуа и Барбуда',
  PG: 'Папуа — Новая Гвинея',
  GQ: 'Экваториальная Гвинея',
  DO: 'Доминиканская Республика',
  NL: 'Нидерланды',
  SS: 'Южный Судан',
  ZA: 'ЮАР',
};

/** Небольшие, но общеизвестные страны — поднимаем в первый эшелон обучения. */
const WELL_KNOWN = new Set([
  'NL', 'CH', 'BE', 'AT', 'PT', 'GR', 'IL', 'SG', 'KR', 'KP', 'CU', 'JM', 'IS',
  'IE', 'DK', 'AE', 'QA', 'CZ', 'HU', 'RS', 'HR', 'GE', 'AM', 'AZ', 'NP', 'LK',
  'BD', 'PA', 'CR', 'UY', 'JO', 'LB', 'KW', 'TN', 'MC', 'VA', 'LU',
]);

const CONTINENTS = {
  Europe: 'europe',
  Asia: 'asia',
  Africa: 'africa',
  Oceania: 'oceania',
};

/** `Americas` из источника разводим на две части — как ждёт продукт. */
function continentOf(country) {
  if (country.region === 'Americas') {
    return country.subregion === 'South America' ? 'south-america' : 'north-america';
  }
  return CONTINENTS[country.region] ?? 'asia';
}

/** ISO-код → эмодзи-флаг через regional indicator symbols. */
function flagEmoji(cca2) {
  return String.fromCodePoint(...[...cca2].map((ch) => 0x1f1a5 + ch.charCodeAt(0)));
}

const source = world.filter((c) => c.independent);

// Порядок изучения: крупные и общеизвестные страны идут раньше.
const byArea = [...source].sort((a, b) => (b.area ?? 0) - (a.area ?? 0));
const areaRank = new Map(byArea.map((c, i) => [c.cca2, i]));

function tierOf(country) {
  if (WELL_KNOWN.has(country.cca2)) return 1;
  const rank = areaRank.get(country.cca2) ?? source.length;
  if (rank < 55) return 1;
  if (rank < 120) return 2;
  return 3;
}

const countries = source
  .map((c) => ({
    code: c.cca2,
    code3: c.cca3,
    name: NAME_OVERRIDES[c.cca2] ?? c.translations.rus?.common ?? c.name.common,
    nameEn: c.name.common,
    capital: capitalsRu[c.cca2] ?? c.capital?.[0] ?? '—',
    capitalEn: c.capital?.[0] ?? '—',
    continent: continentOf(c),
    subregion: c.subregion || '',
    lat: c.latlng[0],
    lng: c.latlng[1],
    area: c.area ?? 0,
    landlocked: Boolean(c.landlocked),
    neighbours: c.borders ?? [],
    languages: Object.values(c.languages ?? {}),
    currency: Object.values(c.currencies ?? {})[0]?.name ?? '',
    emoji: flagEmoji(c.cca2),
    tier: tierOf(c),
  }))
  .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

const missingCapital = countries.filter((c) => !capitalsRu[c.code]);
if (missingCapital.length) {
  console.warn('Нет русской столицы для:', missingCapital.map((c) => c.code).join(', '));
}

const header = `// СГЕНЕРИРОВАННЫЙ ФАЙЛ — не редактировать вручную.
// Источник: scripts/generate-countries.mjs (npm run data:countries)

import type { Country } from '@/lib/types';

export const COUNTRIES: Country[] = `;

writeFileSync(
  resolve(root, 'src/data/countries.ts'),
  `${header}${JSON.stringify(countries, null, 2)};\n`,
  'utf8',
);

const perContinent = countries.reduce((acc, c) => {
  acc[c.continent] = (acc[c.continent] ?? 0) + 1;
  return acc;
}, {});
console.log(`Записано ${countries.length} стран в src/data/countries.ts`);
console.log(perContinent);
