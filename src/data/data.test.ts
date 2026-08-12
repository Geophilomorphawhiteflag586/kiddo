import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { COUNTRIES } from './countries.ts';
import { CONFUSABLE_GROUPS, CONFUSABLE_MAP } from './confusables.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const codes = new Set(COUNTRIES.map((c) => c.code));

test('в датасете 194 независимых государства с уникальными кодами', () => {
  assert.equal(COUNTRIES.length, 194);
  assert.equal(codes.size, COUNTRIES.length);
});

test('у каждой страны заполнены название, столица и координаты', () => {
  for (const country of COUNTRIES) {
    assert.match(country.code, /^[A-Z]{2}$/, `код ${country.code}`);
    assert.ok(country.name.length > 1, `имя ${country.code}`);
    assert.ok(country.capital.length > 1, `столица ${country.code}`);
    assert.ok(Number.isFinite(country.lat) && Math.abs(country.lat) <= 90, `широта ${country.code}`);
    assert.ok(Number.isFinite(country.lng) && Math.abs(country.lng) <= 180, `долгота ${country.code}`);
  }
});

test('названия и столицы переведены на русский', () => {
  const cyrillic = /[А-Яа-яЁё]/;
  const untranslated = COUNTRIES.filter(
    (c) => !cyrillic.test(c.name) || !cyrillic.test(c.capital),
  );
  assert.deepEqual(untranslated.map((c) => c.code), []);
});

test('страны разложены по шести континентам', () => {
  const expected = ['africa', 'asia', 'europe', 'north-america', 'oceania', 'south-america'];
  const actual = [...new Set(COUNTRIES.map((c) => c.continent))].sort();
  assert.deepEqual(actual, expected);
});

test('группы похожих флагов ссылаются на существующие страны', () => {
  for (const group of CONFUSABLE_GROUPS) {
    assert.ok(group.length >= 2, `группа ${group.join(',')} слишком мала`);
    for (const code of group) {
      assert.ok(codes.has(code), `неизвестный код ${code} в группе ${group.join(',')}`);
    }
  }
  // Связь обязана быть симметричной, иначе подсказки будут однобокими.
  for (const [code, others] of CONFUSABLE_MAP) {
    for (const other of others) {
      assert.ok(CONFUSABLE_MAP.get(other)?.includes(code), `${code} → ${other} не взаимно`);
    }
  }
});

test('для каждой страны есть локальный файл флага', () => {
  const missing = COUNTRIES.filter(
    (c) => !existsSync(resolve(root, 'public/flags', `${c.code}.png`)),
  );
  assert.deepEqual(missing.map((c) => c.code), []);
});
