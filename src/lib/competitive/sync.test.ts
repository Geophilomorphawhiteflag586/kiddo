import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyAnswer, applySession, emptyProfileData } from '../progress.ts';
import { buildSyncPayload } from './sync.ts';

const NOW = Date.UTC(2026, 7, 4, 12);

test('пейлоад собирается из карточек, путаницы и истории', () => {
  let data = emptyProfileData();
  data = applyAnswer(
    data,
    { correct: true, countryCode: 'KZ', skill: 'flagToCountry', elapsedMs: 1500 },
    NOW,
  ).data;
  data = applyAnswer(
    data,
    { correct: false, countryCode: 'RO', skill: 'flagToCountry', chosenCode: 'TD', elapsedMs: 3000 },
    NOW,
  ).data;

  const payload = buildSyncPayload(data);

  assert.equal(payload.cards.length, 2);
  const kz = payload.cards.find((c) => c.code === 'KZ')!;
  assert.equal(kz.correct, 1);
  assert.equal(kz.skill, 'flagToCountry');

  assert.equal(payload.confusions.length, 1);
  assert.deepEqual(
    { a: payload.confusions[0].a, b: payload.confusions[0].b },
    { a: 'RO', b: 'TD' },
  );

  assert.equal(payload.history['2026-08-04'], 2);
  assert.equal(payload.bestAnswerStreak, 1);
});

test('в пейлоаде нет готовых очков — только сырые счётчики', () => {
  const payload = buildSyncPayload(emptyProfileData());
  assert.ok(!('skillScore' in payload));
  assert.ok(!('totalScore' in payload));
});

test('рекорд сессии сохраняется и не ухудшается', () => {
  let data = emptyProfileData();
  data = applySession(data, 'flag', { correct: 7, total: 10, avgMs: 3000 }, NOW);
  data = applySession(data, 'flag', { correct: 6, total: 10, avgMs: 1000 }, NOW);
  assert.equal(data.bestSessions.flag.correct, 7, 'хуже по верным — не рекорд');

  data = applySession(data, 'flag', { correct: 7, total: 10, avgMs: 2000 }, NOW);
  assert.equal(data.bestSessions.flag.avgMs, 2000, 'при равных верных решает скорость');

  data = applySession(data, 'flag', { correct: 2, total: 2, avgMs: 500 }, NOW);
  assert.equal(data.bestSessions.flag.correct, 7, 'слишком короткая сессия не считается');
});
