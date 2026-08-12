import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CATEGORY_LABELS } from './config.ts';
import type { WordCategory } from './types.ts';
import { NOUNS, TOTAL_NOUNS, TOTAL_VERBS, TOTAL_WORDS, VERBS, WORDS, getWord } from './words.ts';

test('в базе 300 существительных и 100 глаголов', () => {
  assert.equal(TOTAL_NOUNS, 300);
  assert.equal(TOTAL_VERBS, 100);
  assert.equal(TOTAL_WORDS, 400);
});

test('идентификаторы уникальны', () => {
  const ids = WORDS.map((w) => w.id);
  const seen = new Set(ids);
  if (seen.size !== ids.length) {
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    assert.fail(`дубликаты id: ${[...new Set(dupes)].join(', ')}`);
  }
});

test('эмодзи уникальны — иначе картинка не отличит два слова', () => {
  const emojis = WORDS.map((w) => w.emoji);
  const duplicates = emojis.filter((e, i) => emojis.indexOf(e) !== i);
  if (duplicates.length > 0) {
    const words = [...new Set(duplicates)].map(
      (emoji) => `${emoji} → ${WORDS.filter((w) => w.emoji === emoji).map((w) => w.id).join('/')}`,
    );
    assert.fail(`повторяющиеся эмодзи: ${words.join('; ')}`);
  }
});

test('каждое слово заполнено и слово латиницей', () => {
  for (const word of WORDS) {
    assert.match(word.word, /^[a-z]+$/, `${word.id}: слово должно быть латиницей в нижнем регистре`);
    assert.ok(word.translationRu.length > 1, `${word.id}: нет перевода`);
    assert.ok(word.emoji.length > 0, `${word.id}: нет картинки`);
    assert.equal(word.pronunciation, word.word);
    assert.ok([1, 2, 3].includes(word.difficulty), `${word.id}: странная сложность`);
    assert.equal(word.image, null, `${word.id}: внешних картинок быть не должно`);
  }
});

test('все категории известны интерфейсу', () => {
  for (const word of WORDS) {
    assert.ok(
      CATEGORY_LABELS[word.category as WordCategory],
      `нет подписи для категории ${word.category}`,
    );
  }
});

test('глаголы лежат в actions, существительные — нет', () => {
  for (const verb of VERBS) assert.equal(verb.category, 'actions', `${verb.id}`);
  for (const noun of NOUNS) assert.notEqual(noun.category, 'actions', `${noun.id}`);
});

test('в базе есть базовая лексика из требований', () => {
  for (const id of ['apple', 'car', 'ball', 'house', 'dog', 'elephant', 'orange']) {
    assert.ok(getWord(id), `нет слова ${id}`);
  }
  for (const id of ['go', 'come', 'eat', 'drink', 'see', 'take', 'give', 'play', 'run', 'read']) {
    const verb = getWord(id);
    assert.ok(verb, `нет глагола ${id}`);
    assert.equal(verb.type, 'verb');
  }
});

test('в каждой категории достаточно слов для четырёх вариантов', () => {
  const counts = new Map<string, number>();
  for (const word of WORDS) counts.set(word.category, (counts.get(word.category) ?? 0) + 1);
  for (const [category, count] of counts) {
    assert.ok(count >= 4, `в категории ${category} всего ${count} слов`);
  }
});
