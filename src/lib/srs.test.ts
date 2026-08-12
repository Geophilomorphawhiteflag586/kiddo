import assert from 'node:assert/strict';
import { test } from 'node:test';
import { errorRate, gradeAnswer, isDue, newCard, review } from './srs.ts';
import type { AnswerOutcome, ReviewCard } from './types.ts';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 0, 1);

function answerOutcome(correct: boolean, elapsedMs = 2000, hintUsed = false): AnswerOutcome {
  return { correct, countryCode: 'KZ', skill: 'flagToCountry', elapsedMs, hintUsed };
}

function repeat(card: ReviewCard, times: number, correct = true): ReviewCard {
  let result = card;
  for (let i = 0; i < times; i++) result = review(result, answerOutcome(correct), NOW);
  return result;
}

test('быстрый верный ответ оценивается выше медленного', () => {
  assert.equal(gradeAnswer(answerOutcome(true, 1000)), 5);
  assert.equal(gradeAnswer(answerOutcome(true, 5000)), 4);
  assert.equal(gradeAnswer(answerOutcome(true, 12000)), 3);
  assert.ok(gradeAnswer(answerOutcome(false)) < 3);
});

test('ответ с подсказкой не получает высшую оценку', () => {
  assert.equal(gradeAnswer(answerOutcome(true, 1000, true)), 3);
});

test('интервал растёт с каждым верным ответом', () => {
  const first = review(newCard('KZ', 'flagToCountry'), answerOutcome(true), NOW);
  const second = review(first, answerOutcome(true), NOW);
  const third = review(second, answerOutcome(true), NOW);
  const fourth = review(third, answerOutcome(true), NOW);

  assert.ok(first.interval < second.interval);
  assert.ok(second.interval < third.interval);
  assert.ok(fourth.interval > third.interval, 'после фазы заучивания интервал умножается');
  assert.equal(fourth.streak, 4);
});

test('ошибка возвращает страну в ближайшие минуты и штрафует лёгкость', () => {
  const learned = repeat(newCard('KZ', 'flagToCountry'), 4);
  const failed = review(learned, answerOutcome(false), NOW);

  assert.equal(failed.streak, 0);
  assert.equal(failed.repetitions, 0);
  assert.equal(failed.lapses, 1);
  assert.ok(failed.ease < learned.ease);
  assert.ok(failed.due - NOW < 30 * 60 * 1000, 'вернётся в течение получаса');
});

test('фактор лёгкости не опускается ниже 1.3', () => {
  const card = repeat(newCard('KZ', 'flagToCountry'), 10, false);
  assert.ok(card.ease >= 1.3);
});

test('карточка становится доступной только после наступления срока', () => {
  const card = repeat(newCard('KZ', 'flagToCountry'), 4);
  assert.equal(isDue(card, NOW), false);
  assert.equal(isDue(card, NOW + 365 * DAY), true);
});

test('карточка накапливает счётчики ответов и среднее время', () => {
  const first = review(newCard('KZ', 'flagToCountry'), answerOutcome(true, 2000), NOW);
  const second = review(first, answerOutcome(false, 4000), NOW);

  assert.equal(second.correct, 1);
  assert.equal(second.wrong, 1);
  assert.equal(second.avgMs, 3000);
  assert.equal(errorRate(second), 0.5);
});
