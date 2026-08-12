import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import type { SyncPayload } from '../lib/competitive/types.ts';
import { createDb } from './db.ts';
import {
  RepoError,
  findByNickname,
  friendAction,
  friendshipStatus,
  friendsOf,
  leaderboard,
  registerUser,
  syncProgress,
  verifyUser,
  worldStats,
} from './repo.ts';

const dir = mkdtempSync(join(tmpdir(), 'mapapp-test-'));
const db = createDb(join(dir, 'test.db'));

after(() => {
  try {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* Windows иногда держит WAL-файлы — не критично для теста */
  }
});

function payload(partial: Partial<SyncPayload> = {}): SyncPayload {
  return {
    cards: [
      { code: 'KZ', skill: 'flagToCountry', correct: 9, wrong: 1, avgMs: 2100, interval: 30, repetitions: 6 },
      { code: 'FR', skill: 'countryToCapital', correct: 5, wrong: 5, avgMs: 4000, interval: 2, repetitions: 2 },
    ],
    confusions: [{ a: 'RO', b: 'TD', skill: 'flagToCountry', count: 3 }],
    history: { '2026-08-04': 20 },
    xp: 500,
    bestAnswerStreak: 12,
    bestDayStreak: 4,
    ...partial,
  };
}

test('регистрация: уникальный никнейм и проверка секрета', () => {
  const yan = registerUser(db, 'Yan', 'KZ');
  assert.ok(verifyUser(db, yan.userId, yan.secret));
  assert.ok(!verifyUser(db, yan.userId, 'не тот секрет'));

  assert.throws(() => registerUser(db, 'Yan', null), RepoError, 'дубликат');
  assert.throws(() => registerUser(db, 'yan', null), RepoError, 'дубликат без учёта регистра');
  assert.throws(() => registerUser(db, 'ян', null) && registerUser(db, 'x', null), RepoError, 'короткий ник');
});

test('sync сохраняет прогресс и возвращает Skill Score с позицией', () => {
  const user = registerUser(db, 'Player1', null);
  const res = syncProgress(db, user.userId, payload());

  assert.ok(res.skillScore.totalScore > 0);
  assert.ok(res.position >= 1);
  assert.equal(res.maxSkillScore, res.skillScore.totalScore);

  // Повторный sync сразу — rate limit.
  assert.throws(() => syncProgress(db, user.userId, payload()), RepoError);
});

test('лидерборд сортирует по Skill Score и находит мою позицию', () => {
  const strong = registerUser(db, 'Strong', null);
  const weak = registerUser(db, 'Weak', null);

  syncProgress(db, strong.userId, payload({
    cards: Array.from({ length: 50 }, (_, i) => ({
      code: ['DE', 'FR', 'IT', 'ES', 'PL'][i % 5],
      skill: (['flagToCountry', 'countryToFlag', 'countryToCapital', 'capitalToCountry', 'countryLocation', 'outlineToCountry'] as const)[i % 6],
      correct: 20, wrong: 1, avgMs: 1800, interval: 40, repetitions: 8,
    })),
    bestAnswerStreak: 300,
  }));
  syncProgress(db, weak.userId, payload({ bestAnswerStreak: 2 }));

  const board = leaderboard(db, 0, 10, weak.userId);
  assert.ok(board.total >= 3);
  assert.equal(board.rows[0].position, 1);
  const strongRow = board.rows.find((r) => r.nickname === 'Strong')!;
  const weakRow = board.rows.find((r) => r.nickname === 'Weak')!;
  assert.ok(strongRow.position < weakRow.position);

  assert.ok(board.me);
  assert.equal(board.me.row.nickname, 'Weak');
  assert.ok(board.me.percentile >= 1 && board.me.percentile <= 100);
});

test('дружба: заявка → принятие, защита от дублей и самого себя', () => {
  const a = registerUser(db, 'FriendA', null);
  const b = registerUser(db, 'FriendB', null);

  assert.throws(() => friendAction(db, a.userId, a.userId, 'request'), RepoError, 'сам себя');

  assert.equal(friendAction(db, a.userId, b.userId, 'request'), 'pending_sent');
  assert.equal(friendshipStatus(db, b.userId, a.userId), 'pending_received');
  assert.throws(() => friendAction(db, a.userId, b.userId, 'request'), RepoError, 'дубль заявки');

  assert.equal(friendAction(db, b.userId, a.userId, 'accept'), 'accepted');
  assert.throws(() => friendAction(db, a.userId, b.userId, 'request'), RepoError, 'уже друзья');

  const list = friendsOf(db, a.userId);
  assert.ok(list.friends.some((f) => f.nickname === 'FriendB'));
  assert.ok(list.friends.some((f) => f.nickname === 'FriendA'), 'сам пользователь в списке для рейтинга');

  assert.equal(friendAction(db, a.userId, b.userId, 'remove'), 'none');
  assert.equal(friendshipStatus(db, a.userId, b.userId), 'none');
});

test('встречная заявка автоматически превращается в дружбу', () => {
  const a = registerUser(db, 'CrossA', null);
  const b = registerUser(db, 'CrossB', null);
  friendAction(db, a.userId, b.userId, 'request');
  assert.equal(friendAction(db, b.userId, a.userId, 'request'), 'accepted');
});

test('блокировка запрещает новые заявки', () => {
  const a = registerUser(db, 'BlockA', null);
  const b = registerUser(db, 'BlockB', null);
  friendAction(db, a.userId, b.userId, 'block');
  assert.equal(friendshipStatus(db, b.userId, a.userId), 'blocked');
  assert.throws(() => friendAction(db, b.userId, a.userId, 'request'), RepoError);
});

test('поиск по никнейму возвращает публичные данные и статус дружбы', () => {
  const me = registerUser(db, 'SearchMe', null);
  registerUser(db, 'Target', 'DE');
  const found = findByNickname(db, 'target', me.userId)!;
  assert.equal(found.nickname, 'Target');
  assert.equal(found.friendship, 'none');
  assert.equal(findByNickname(db, 'НетТакого', me.userId), null);
});

test('мировая статистика агрегирует ответы и путаницу', () => {
  const stats = worldStats(db);
  assert.ok(stats.totalAnswers > 0);
  assert.ok(stats.players > 0);
  assert.ok(stats.avgAccuracy > 0 && stats.avgAccuracy <= 1);
  // Порог в 100 ответов ещё не набран — сложные страны пусты, но не падают.
  assert.equal(stats.hardestCountry, null);
  assert.ok(stats.topConfusion, 'путаница RO/TD из sync попала в мир');
  assert.equal(stats.topConfusion!.a, 'RO');
});
