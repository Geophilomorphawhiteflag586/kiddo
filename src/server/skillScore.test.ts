import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SyncCard } from '../lib/competitive/types.ts';
import { computeSkillScore, sanitizeCard, TOTAL_SKILLS } from './skillScore.ts';

function card(partial: Partial<SyncCard>): SyncCard {
  return {
    code: 'KZ',
    skill: 'flagToCountry',
    correct: 10,
    wrong: 0,
    avgMs: 2000,
    interval: 30,
    repetitions: 6,
    ...partial,
  };
}

test('пустой прогресс даёт нулевой Skill Score', () => {
  const s = computeSkillScore([], 0);
  assert.equal(s.totalScore, 0);
  assert.equal(s.masteredSkills, 0);
});

test('Skill Score растёт с числом освоенных карточек', () => {
  const one = computeSkillScore([card({})], 10);
  const two = computeSkillScore([card({}), card({ skill: 'countryToCapital' })], 10);
  assert.ok(two.totalScore > one.totalScore);
  assert.ok(two.masteryScore > one.masteryScore);
});

test('точность влияет сильнее скорости: быстрый неточный не выигрывает', () => {
  const accurate = computeSkillScore(
    [card({ correct: 90, wrong: 10, avgMs: 4000 })],
    10,
  );
  const fastButWrong = computeSkillScore(
    [card({ correct: 40, wrong: 60, avgMs: 900 })],
    10,
  );
  assert.ok(
    accurate.accuracyScore + accurate.speedScore >
      fastButWrong.accuracyScore + fastButWrong.speedScore,
  );
});

test('итог равен сумме компонент', () => {
  const s = computeSkillScore([card({}), card({ skill: 'countryLocation', interval: 2 })], 50);
  assert.equal(
    s.totalScore,
    s.masteryScore + s.accuracyScore + s.speedScore + s.retentionScore + s.streakScore + s.difficultyScore,
  );
});

test('редкие страны (tier 3) дают больше очков освоения', () => {
  const common = computeSkillScore([card({ code: 'RU' })], 0); // tier 1
  const rare = computeSkillScore([card({ code: 'TV' })], 0); // Тувалу — tier 3
  assert.ok(rare.masteryScore > common.masteryScore);
});

test('устойчивость считается по зрелым интервалам', () => {
  const fresh = computeSkillScore([card({ interval: 2 })], 0);
  const mature = computeSkillScore([card({ interval: 40 })], 0);
  assert.equal(fresh.retentionScore, 0);
  assert.ok(mature.retentionScore > 0);
});

test('sanitizeCard отбрасывает мусор и обрезает значения', () => {
  assert.equal(sanitizeCard(null), null);
  assert.equal(sanitizeCard({ code: 'XX', skill: 'flagToCountry' }), null);
  assert.equal(sanitizeCard({ code: 'KZ', skill: 'hack' }), null);

  const cleaned = sanitizeCard({
    code: 'KZ',
    skill: 'flagToCountry',
    correct: 1e12,
    wrong: -5,
    avgMs: 999999999,
    interval: Infinity,
    repetitions: 3.7,
  })!;
  assert.equal(cleaned.correct, 1_000_000);
  assert.equal(cleaned.wrong, 0);
  assert.equal(cleaned.avgMs, 120_000);
  assert.equal(cleaned.interval, 0, 'Infinity не проходит');
  assert.equal(cleaned.repetitions, 3);
});

test('всего микронавыков — 194 × 6', () => {
  assert.equal(TOTAL_SKILLS, 1164);
});
