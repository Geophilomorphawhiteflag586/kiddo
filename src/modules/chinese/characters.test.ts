import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CATEGORY_LABELS } from './config.ts';
import { CHARACTERS, TOTAL_CHARACTERS, getCharacter } from './characters.ts';
import { applyTone, stripTone, toneOf } from './pinyin.ts';
import type { CharCategory } from './types.ts';

const CJK = /^[一-鿿]$/;

test('база достаточного размера', () => {
  assert.ok(TOTAL_CHARACTERS >= 650, `иероглифов всего ${TOTAL_CHARACTERS}`);
});

test('каждый id — ровно один китайский иероглиф', () => {
  const bad = CHARACTERS.filter((c) => !CJK.test(c.character));
  assert.deepEqual(
    bad.map((c) => `${c.character} (${c.pinyin})`),
    [],
    'в базе есть строки, которые не являются иероглифом',
  );
});

test('иероглифы не повторяются', () => {
  const ids = CHARACTERS.map((c) => c.character);
  const duplicates = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  assert.deepEqual(duplicates, [], 'повторяющиеся иероглифы');
});

test('пиньинь корректен, а тон согласован с диакритикой', () => {
  for (const char of CHARACTERS) {
    assert.match(
      char.pinyin,
      /^[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüńňǹ]+$/i,
      `${char.character}: странный пиньинь «${char.pinyin}»`,
    );
    assert.equal(char.tone, toneOf(char.pinyin), `${char.character}: тон не совпал с значком`);
    assert.equal(
      applyTone(stripTone(char.pinyin), char.tone),
      char.pinyin,
      `${char.character}: пиньинь «${char.pinyin}» записан не по правилам постановки тона`,
    );
  }
});

test('у каждого знака есть оба значения и известная категория', () => {
  for (const char of CHARACTERS) {
    assert.ok(char.meaningRu.length > 0, `${char.character}: нет русского значения`);
    assert.ok(char.meaningEn.length > 0, `${char.character}: нет английского значения`);
    assert.ok(
      CATEGORY_LABELS[char.category as CharCategory],
      `${char.character}: неизвестная категория ${char.category}`,
    );
    assert.ok([1, 2, 3].includes(char.difficulty), `${char.character}: странная сложность`);
  }
});

test('частота = порядок изучения, простые знаки идут первыми', () => {
  CHARACTERS.forEach((char, index) => {
    assert.equal(char.frequency, index + 1, `${char.character}: сбит порядок`);
  });
  const firstTwenty = CHARACTERS.slice(0, 20).map((c) => c.character);
  for (const simple of ['一', '二', '三', '人']) {
    assert.ok(firstTwenty.includes(simple), `${simple} должен быть в первой двадцатке`);
  }
});

test('базовые знаки из требований на месте', () => {
  for (const [character, pinyin] of [
    ['你', 'nǐ'],
    ['人', 'rén'],
    ['好', 'hǎo'],
    ['水', 'shuǐ'],
    ['学', 'xué'],
    ['中', 'zhōng'],
    ['大', 'dà'],
    ['日', 'rì'],
    ['口', 'kǒu'],
  ]) {
    const found = getCharacter(character);
    assert.ok(found, `нет иероглифа ${character}`);
    assert.equal(found.pinyin, pinyin, `${character}: неверный пиньинь`);
  }
});

test('в каждой категории хватает знаков на четыре варианта ответа', () => {
  const counts = new Map<string, number>();
  for (const char of CHARACTERS) counts.set(char.category, (counts.get(char.category) ?? 0) + 1);
  for (const [category, count] of counts) {
    assert.ok(count >= 4, `в категории ${category} всего ${count} знаков`);
  }
});
