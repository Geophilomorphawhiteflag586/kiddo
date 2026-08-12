/**
 * Готовит контуры стран для глобуса.
 *
 *   node scripts/generate-geojson.mjs <исходный.geojson>
 *
 * Берёт Natural Earth admin-0 (110m), оставляет только страны из нашего
 * датасета, чинит известные дыры в ISO_A2 и выбрасывает все свойства кроме
 * кода — иначе в браузер уезжает пара мегабайт справочных полей.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const input = process.argv[2];
if (!input) {
  console.error('Укажите путь к исходному geojson');
  process.exit(1);
}

const world = JSON.parse(
  readFileSync(resolve(root, 'node_modules/world-countries/countries.json'), 'utf8'),
);
const byA3 = new Map(world.map((c) => [c.cca3, c.cca2]));
const known = new Set(world.filter((c) => c.independent).map((c) => c.cca2));

const src = JSON.parse(readFileSync(resolve(input), 'utf8'));

/** В Natural Earth у части стран ISO_A2 == '-99'. Восстанавливаем по A3. */
function isoOf(props) {
  const direct = props.ISO_A2 ?? props.iso_a2;
  if (direct && direct !== '-99') return direct;
  const a3 = props.ADM0_A3 ?? props.adm0_a3 ?? props.ISO_A3 ?? props.iso_a3;
  return byA3.get(a3) ?? null;
}

const features = [];
const seen = new Set();
for (const f of src.features) {
  const code = isoOf(f.properties);
  if (!code || !known.has(code)) continue;
  seen.add(code);
  features.push({ type: 'Feature', properties: { code }, geometry: f.geometry });
}

mkdirSync(resolve(root, 'public/data'), { recursive: true });
writeFileSync(
  resolve(root, 'public/data/countries.geojson'),
  JSON.stringify({ type: 'FeatureCollection', features }),
  'utf8',
);

const missing = [...known].filter((c) => !seen.has(c)).sort();
console.log(`Полигонов: ${features.length} из ${known.size} стран`);
console.log(`Без контура (${missing.length}):`, missing.join(', '));
