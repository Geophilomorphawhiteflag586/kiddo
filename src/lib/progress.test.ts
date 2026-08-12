import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyAnswer,
  cardsOfCountry,
  emptyProfileData,
  topConfusions,
  totalConfusions,
} from './progress.ts';
import type { AnswerOutcome, CountrySkill } from './types.ts';

const NOW = Date.UTC(2026, 0, 15, 12);

function outcome(partial: Partial<AnswerOutcome> = {}): AnswerOutcome {
  return {
    correct: true,
    countryCode: 'KZ',
    skill: 'flagToCountry',
    elapsedMs: 2000,
    ...partial,
  };
}

test('ответ обновляет только карточку своего навыка', () => {
  let data = emptyProfileData();
  data = applyAnswer(data, outcome({ skill: 'flagToCountry' }), NOW).data;
  data = applyAnswer(data, outcome({ skill: 'countryToCapital', correct: false, chosenCode: 'UZ' }), NOW).data;

  const cards = cardsOfCountry(data.cards, 'KZ');
  assert.equal(cards.flagToCountry?.correct, 1);
  assert.equal(cards.flagToCountry?.wrong, 0);
  assert.equal(cards.countryToCapital?.wrong, 1);
  assert.equal(cards.outlineToCountry, undefined, 'нетронутые навыки не появляются');
});

test('путаница хранится в разрезе навыка', () => {
  let data = emptyProfileData();
  data = applyAnswer(data, outcome({ correct: false, chosenCode: 'UZ', skill: 'flagToCountry' }), NOW).data;
  data = applyAnswer(data, outcome({ correct: false, chosenCode: 'UZ', skill: 'flagToCountry' }), NOW).data;
  data = applyAnswer(data, outcome({ correct: false, chosenCode: 'MN', skill: 'outlineToCountry' }), NOW).data;

  const confusions = data.progress.KZ.confusedWith;
  assert.deepEqual(confusions.flagToCountry, { UZ: 2 });
  assert.deepEqual(confusions.outlineToCountry, { MN: 1 });
  assert.equal(confusions.countryToCapital, undefined);

  assert.deepEqual(totalConfusions(data.progress.KZ), { UZ: 2, MN: 1 });

  const top = topConfusions(data.progress);
  assert.equal(top[0].count, 2);
  assert.equal(top[0].skill, 'flagToCountry');
});

test('XP начисляется за верные ответы, быстрый ответ ценнее', () => {
  let data = emptyProfileData();
  const fast = applyAnswer(data, outcome({ elapsedMs: 1000 }), NOW);
  data = fast.data;
  const slow = applyAnswer(data, outcome({ skill: 'countryToFlag', elapsedMs: 6000 }), NOW);
  data = slow.data;
  const wrong = applyAnswer(data, outcome({ skill: 'countryLocation', correct: false }), NOW);

  assert.equal(fast.xpGained, 15);
  assert.equal(slow.xpGained, 10);
  assert.equal(wrong.xpGained, 0);
  assert.equal(wrong.data.xp, 25);
});

test('первый верный ответ открывает достижение «Первые шаги»', () => {
  const result = applyAnswer(emptyProfileData(), outcome(), NOW);
  assert.ok(result.unlocked.some((a) => a.id === 'first-steps'));
  assert.ok(result.data.unlocked.includes('first-steps'));

  // Повторно то же достижение не выдаётся.
  const again = applyAnswer(result.data, outcome({ skill: 'countryToFlag' }), NOW);
  assert.ok(!again.unlocked.some((a) => a.id === 'first-steps'));
});

test('дневная серия растёт при игре в соседние дни и сбрасывается после пропуска', () => {
  const day1 = applyAnswer(emptyProfileData(), outcome(), NOW).data;
  assert.equal(day1.dayStreak, 1);

  const day2 = applyAnswer(day1, outcome({ skill: 'countryToFlag' }), NOW + 24 * 60 * 60 * 1000).data;
  assert.equal(day2.dayStreak, 2);

  const afterGap = applyAnswer(day2, outcome({ skill: 'countryLocation' }), NOW + 5 * 24 * 60 * 60 * 1000).data;
  assert.equal(afterGap.dayStreak, 1);
});

test('данные разных профилей полностью независимы', () => {
  const yan = applyAnswer(emptyProfileData(), outcome({ elapsedMs: 1000 }), NOW).data;
  const anna = applyAnswer(
    emptyProfileData(),
    outcome({ countryCode: 'FR', skill: 'countryToCapital', correct: false, chosenCode: 'DE' }),
    NOW,
  ).data;

  assert.equal(yan.xp, 15);
  assert.equal(anna.xp, 0);
  assert.ok(yan.cards['KZ:flagToCountry']);
  assert.equal(yan.cards['FR:countryToCapital'], undefined);
  assert.ok(anna.cards['FR:countryToCapital']);
  assert.equal(anna.progress.KZ, undefined);
});

test('applyAnswer не мутирует исходные данные', () => {
  const before = emptyProfileData();
  const snapshot = JSON.stringify(before);
  applyAnswer(before, outcome({ correct: false, chosenCode: 'UZ' }), NOW);
  assert.equal(JSON.stringify(before), snapshot);
});

test('ответ с подсказкой не даёт бонуса за скорость', () => {
  const result = applyAnswer(emptyProfileData(), outcome({ elapsedMs: 1000, hintUsed: true }), NOW);
  assert.equal(result.xpGained, 10);
});

const SKILLS_ALL: CountrySkill[] = [
  'flagToCountry',
  'countryToFlag',
  'countryToCapital',
  'capitalToCountry',
  'countryLocation',
  'outlineToCountry',
];

test('состояние профиля переживает JSON-сериализацию (localStorage)', () => {
  let data = emptyProfileData();
  for (const skill of SKILLS_ALL) {
    data = applyAnswer(data, outcome({ skill, correct: skill !== 'outlineToCountry', chosenCode: 'VN' }), NOW).data;
  }
  const restored = JSON.parse(JSON.stringify(data));
  assert.deepEqual(restored, data);
});
