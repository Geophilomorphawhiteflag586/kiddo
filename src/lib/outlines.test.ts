import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { WITHOUT_POLYGON } from './countries.ts';
import { COUNTRIES } from '../data/countries.ts';
import { outlinePath, worldPaths, type OutlineFeature } from './outlines.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const geo = JSON.parse(
  readFileSync(resolve(root, 'public/data/countries.geojson'), 'utf8'),
) as { features: OutlineFeature[] };

const byCode = new Map(geo.features.map((f) => [f.properties.code, f]));

function bounds(d: string): { minX: number; maxX: number; minY: number; maxY: number } {
  const coords = [...d.matchAll(/([ML])(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [
    Number(m[2]),
    Number(m[3]),
  ]);
  return {
    minX: Math.min(...coords.map((c) => c[0])),
    maxX: Math.max(...coords.map((c) => c[0])),
    minY: Math.min(...coords.map((c) => c[1])),
    maxY: Math.max(...coords.map((c) => c[1])),
  };
}

test('контур строится для каждой страны из датасета с полигоном', () => {
  const missing: string[] = [];
  for (const country of COUNTRIES) {
    if (WITHOUT_POLYGON.has(country.code)) continue;
    const feature = byCode.get(country.code);
    const path = feature ? outlinePath(feature) : null;
    if (!path || path.d.length === 0) missing.push(country.code);
  }
  assert.deepEqual(missing, []);
});

test('контур вписан в рамку и занимает её почти целиком', () => {
  for (const code of ['IT', 'KZ', 'CL', 'JP', 'ID']) {
    const path = outlinePath(byCode.get(code)!, 100, 6)!;
    const box = bounds(path.d);
    assert.ok(box.minX >= 5.9 && box.maxX <= 94.1, `${code}: выходит за рамку по X`);
    assert.ok(box.minY >= 5.9 && box.maxY <= 94.1, `${code}: выходит за рамку по Y`);
    const spanX = box.maxX - box.minX;
    const spanY = box.maxY - box.minY;
    // Большая сторона растянута на всю рамку: размер страны не подсказывает ответ.
    assert.ok(Math.max(spanX, spanY) > 85, `${code}: контур слишком мелкий (${spanX}×${spanY})`);
  }
});

test('Россия и Фиджи не разорваны антимеридианом', () => {
  // При разрыве долготный размах раздувается до ~360°, масштаб падает,
  // и силуэт вырождается в тонкую полоску: высота фигуры почти нулевая.
  for (const code of ['RU', 'FJ']) {
    const path = outlinePath(byCode.get(code)!)!;
    const box = bounds(path.d);
    assert.ok(box.maxY - box.minY > 30, `${code}: похоже на разрыв по антимеридиану`);
  }
});

test('MultiPolygon (островные государства) даёт несколько подпутей', () => {
  const japan = outlinePath(byCode.get('JP')!)!;
  assert.ok(japan.d.split('M').length - 1 >= 2, 'у Японии минимум два острова');
});

test('мини-карта содержит мир и подсвеченную страну', () => {
  const { world, target } = worldPaths(geo.features, 'BR');
  assert.ok(world.length > 1000);
  assert.ok(target.length > 10);
  assert.ok(!world.includes('NaN') && !target.includes('NaN'));
});

test('фича с пустой геометрией возвращает null, а не падает', () => {
  const empty: OutlineFeature = {
    type: 'Feature',
    properties: { code: 'XX' },
    geometry: { type: 'Polygon', coordinates: [[]] },
  };
  assert.equal(outlinePath(empty), null);
  const weird: OutlineFeature = {
    type: 'Feature',
    properties: { code: 'YY' },
    geometry: { type: 'GeometryCollection', coordinates: [] },
  };
  assert.equal(outlinePath(weird), null);
});
