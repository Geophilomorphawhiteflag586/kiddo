import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONFIDENT_ABOVE, STRUGGLING_BELOW, newItemQuota, recentAccuracy } from './newItems.ts';

const NOW = Date.UTC(2026, 7, 14, 12);
const card = (correct: number, wrong: number, daysAgo = 0) => ({
  correct,
  wrong,
  lastReviewed: NOW - daysAgo * 24 * 60 * 60 * 1000,
});

test('новичку без истории дают обычную норму', () => {
  assert.equal(newItemQuota({ length: 10, cards: [], now: NOW }), 2);
});

test('при частых ошибках новое не добавляется', () => {
  const cards = [card(4, 12), card(3, 10)];
  assert.ok(recentAccuracy(cards, NOW)! < STRUGGLING_BELOW);
  assert.equal(newItemQuota({ length: 10, cards, now: NOW }), 0);
});

test('при уверенных ответах норма выше обычной', () => {
  const cards = [card(30, 1), card(25, 2)];
  assert.ok(recentAccuracy(cards, NOW)! >= CONFIDENT_ABOVE);
  assert.ok(newItemQuota({ length: 10, cards, now: NOW }) > 2);
});

test('давние карточки не влияют на решение про сегодня', () => {
  // Месяц назад ребёнок ошибался, а на этой неделе отвечает верно —
  // тормозить его из-за старого провала неправильно.
  const cards = [card(1, 40, 40), card(20, 1, 1)];
  assert.ok(recentAccuracy(cards, NOW)! >= CONFIDENT_ABOVE);
});

test('по паре ответов точность не считается', () => {
  assert.equal(recentAccuracy([card(1, 1)], NOW), null);
});

test('норма растёт вместе с длиной сессии', () => {
  const long = newItemQuota({ length: 20, cards: [], now: NOW });
  assert.ok(long > newItemQuota({ length: 10, cards: [], now: NOW }));
});
