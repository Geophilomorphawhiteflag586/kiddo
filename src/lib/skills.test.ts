import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SKILLS, SKILL_META, countryLevel, countryMastery, skillLevel, skillPercent } from './skills.ts';
import { newCard, review } from './srs.ts';
import type { AnswerOutcome, CountrySkill, ReviewCard } from './types.ts';

const NOW = Date.UTC(2026, 0, 1);

function trained(skill: CountrySkill, times: number): ReviewCard {
  const outcome: AnswerOutcome = { correct: true, countryCode: 'KZ', skill, elapsedMs: 2000 };
  let card = newCard('KZ', skill);
  for (let i = 0; i < times; i++) card = review(card, outcome, NOW);
  return card;
}

test('веса навыков в сумме дают единицу', () => {
  const total = SKILLS.reduce((sum, skill) => sum + SKILL_META[skill].weight, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
});

test('уровень навыка растёт с интервалом: 0 → 5', () => {
  assert.equal(skillLevel(undefined), 0);
  assert.equal(skillLevel(newCard('KZ', 'flagToCountry')), 1);
  assert.equal(skillLevel(trained('flagToCountry', 1)), 2);
  assert.equal(skillLevel(trained('flagToCountry', 3)), 3);
  assert.equal(skillLevel(trained('flagToCountry', 5)), 4);
  assert.equal(skillLevel(trained('flagToCountry', 8)), 5);
});

test('проценты навыка монотонны и ограничены 0–100', () => {
  let prev = -1;
  for (const times of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    const percent =
      times === 0 ? skillPercent(undefined) : skillPercent(trained('flagToCountry', times));
    assert.ok(percent >= prev, `процент упал на шаге ${times}`);
    assert.ok(percent >= 0 && percent <= 100);
    prev = percent;
  }
});

test('общее освоение — взвешенная сумма навыков, а не среднее', () => {
  const onlyFlag = { flagToCountry: trained('flagToCountry', 8) };
  const mastery = countryMastery(onlyFlag);
  // Флаг весит 20%: полностью выученный флаг — это ~20% страны.
  assert.ok(mastery >= 18 && mastery <= 22, `получили ${mastery}`);
});

test('для страны без контура вес контура перераспределяется', () => {
  const cards = {
    flagToCountry: trained('flagToCountry', 8),
    countryToFlag: trained('countryToFlag', 8),
    countryToCapital: trained('countryToCapital', 8),
    capitalToCountry: trained('capitalToCountry', 8),
    countryLocation: trained('countryLocation', 8),
  };
  assert.ok(countryMastery(cards, true) < 100, 'с контуром — не 100%');
  assert.equal(countryMastery(cards, false), 100, 'без контура 100% достижимы');
});

test('уровень страны требует минимум двух навыков для «освоено»', () => {
  const single = { flagToCountry: trained('flagToCountry', 10) };
  assert.ok(countryLevel(single) < 5);
  assert.equal(countryLevel({}), 0);
});
