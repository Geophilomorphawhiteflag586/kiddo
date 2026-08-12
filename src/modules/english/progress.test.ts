import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isLearned, masteryOf, summarize, wordLevel, wordPercent } from './mastery.ts';
import {
  applyEnglishAnswer,
  emptyEnglishProgress,
  normalizeEnglishProgress,
  topConfusionPairs,
  weakWords,
} from './progress.ts';
import type { EnglishAnswerRecord, EnglishProgress } from './types.ts';
import { TOTAL_WORDS } from './words.ts';

const NOW = Date.UTC(2026, 7, 11, 9);

function answer(partial: Partial<EnglishAnswerRecord> = {}): EnglishAnswerRecord {
  return {
    wordId: 'apple',
    chosenId: 'apple',
    mode: 'image-to-word',
    isCorrect: true,
    responseTimeMs: 2500,
    ...partial,
  };
}

function repeat(progress: EnglishProgress, times: number, wordId = 'apple'): EnglishProgress {
  let current = progress;
  for (let i = 0; i < times; i++) {
    current = applyEnglishAnswer(current, answer({ wordId, chosenId: wordId }), NOW).progress;
  }
  return current;
}

test('верный ответ создаёт карточку и даёт XP', () => {
  const result = applyEnglishAnswer(emptyEnglishProgress(), answer(), NOW);
  const card = result.progress.cards.apple;

  assert.ok(card);
  assert.equal(card.wordId, 'apple');
  assert.equal(card.correct, 1);
  assert.equal(card.streak, 1);
  assert.ok(result.xpGained > 0);
});

test('быстрый ответ ценнее медленного, за ошибку XP нет', () => {
  const fast = applyEnglishAnswer(emptyEnglishProgress(), answer({ responseTimeMs: 1000 }), NOW);
  const slow = applyEnglishAnswer(emptyEnglishProgress(), answer({ responseTimeMs: 9000 }), NOW);
  const wrong = applyEnglishAnswer(
    emptyEnglishProgress(),
    answer({ isCorrect: false, chosenId: 'car' }),
    NOW,
  );
  assert.ok(fast.xpGained > slow.xpGained);
  assert.equal(wrong.xpGained, 0);
});

test('ошибка пишется в матрицу путаницы в обе стороны', () => {
  const result = applyEnglishAnswer(
    emptyEnglishProgress(),
    answer({ wordId: 'apple', chosenId: 'orange', isCorrect: false }),
    NOW,
  );
  assert.equal(result.progress.confusions.apple.orange, 1);
  assert.equal(result.progress.confusions.orange.apple, 1, 'пара работает в обе стороны');
});

test('повторная путаница накапливается, пара не задваивается в отчёте', () => {
  let progress = emptyEnglishProgress();
  for (let i = 0; i < 3; i++) {
    progress = applyEnglishAnswer(
      progress,
      answer({ wordId: 'apple', chosenId: 'orange', isCorrect: false }),
      NOW,
    ).progress;
  }
  const pairs = topConfusionPairs(progress);
  assert.equal(pairs.length, 1, 'apple↔orange — это одна пара');
  assert.equal(pairs[0].count, 3);
  assert.deepEqual([pairs[0].a, pairs[0].b], ['apple', 'orange']);
});

test('ошибка сбрасывает серию и возвращает слово в ближайшие минуты', () => {
  let progress = repeat(emptyEnglishProgress(), 4);
  const before = progress.cards.apple;
  progress = applyEnglishAnswer(
    progress,
    answer({ isCorrect: false, chosenId: 'orange' }),
    NOW,
  ).progress;
  const after = progress.cards.apple;

  assert.equal(after.streak, 0);
  assert.equal(after.lapses, 1);
  assert.ok(after.interval < before.interval);
  assert.ok(after.due - NOW < 30 * 60 * 1000);
});

test('уровень слова растёт от «новое» до «выучено»', () => {
  assert.equal(wordLevel(undefined), 0);
  assert.equal(wordPercent(undefined), 0);

  let progress = repeat(emptyEnglishProgress(), 1);
  assert.equal(wordLevel(progress.cards.apple), 2);
  assert.ok(!isLearned(progress.cards.apple), 'одного ответа мало');

  progress = repeat(progress, 2);
  assert.ok(isLearned(progress.cards.apple), 'после фазы заучивания слово выучено');

  progress = repeat(progress, 5);
  const mastery = masteryOf(progress.cards.apple);
  assert.equal(mastery.level, 5);
  assert.equal(mastery.percent, 100);
  assert.equal(mastery.label, 'Выучено');
});

test('сводка считает освоение от всей базы, а не от увиденных слов', () => {
  const progress = repeat(emptyEnglishProgress(), 6);
  const summary = summarize(progress, TOTAL_WORDS);
  assert.equal(summary.seen, 1);
  assert.equal(summary.learned, 1);
  assert.ok(summary.mastery < 5, `одно слово из 400 не может дать ${summary.mastery}%`);
  assert.equal(summary.accuracy, 1);
});

test('слабые слова отсортированы по числу ошибок', () => {
  let progress = emptyEnglishProgress();
  for (let i = 0; i < 3; i++) {
    progress = applyEnglishAnswer(
      progress,
      answer({ wordId: 'elephant', chosenId: 'horse', isCorrect: false }),
      NOW,
    ).progress;
  }
  progress = applyEnglishAnswer(
    progress,
    answer({ wordId: 'window', chosenId: 'door', isCorrect: false }),
    NOW,
  ).progress;
  progress = repeat(progress, 3, 'apple');

  const weak = weakWords(progress);
  assert.equal(weak[0].wordId, 'elephant');
  assert.ok(!weak.some((c) => c.wordId === 'apple'), 'слово без ошибок не слабое');
});

test('applyEnglishAnswer не мутирует исходный прогресс', () => {
  const before = emptyEnglishProgress();
  const snapshot = JSON.stringify(before);
  applyEnglishAnswer(before, answer({ isCorrect: false, chosenId: 'car' }), NOW);
  assert.equal(JSON.stringify(before), snapshot);
});

test('нормализация чинит частичные и битые данные', () => {
  assert.deepEqual(normalizeEnglishProgress(undefined), emptyEnglishProgress());

  const fixed = normalizeEnglishProgress({
    cards: { apple: { correct: 2 } },
    confusions: { apple: { orange: 1 } },
  } as never);
  assert.equal(fixed.cards.apple.correct, 2);
  assert.equal(fixed.cards.apple.wrong, 0, 'недостающие поля добиты');
  assert.equal(fixed.cards.apple.wordId, 'apple');
  assert.equal(fixed.confusions.apple.orange, 1);
});

test('состояние переживает JSON-сериализацию (localStorage)', () => {
  const progress = repeat(emptyEnglishProgress(), 3);
  assert.deepEqual(JSON.parse(JSON.stringify(progress)), progress);
});
