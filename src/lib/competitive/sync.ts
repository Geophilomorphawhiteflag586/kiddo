/** Сборка sync-пейлоада из данных профиля. Чистая функция — тестируется в node. */
import { type ProfileData, topConfusions } from '../progress.ts';
import type { SyncPayload } from './types.ts';

export function buildSyncPayload(data: ProfileData): SyncPayload {
  const cards = Object.values(data.cards).map((card) => ({
    code: card.countryCode,
    skill: card.skill,
    correct: card.correct,
    wrong: card.wrong,
    avgMs: card.avgMs,
    interval: card.interval,
    repetitions: card.repetitions,
  }));

  const confusions = topConfusions(data.progress, 200).map((c) => ({
    a: c.a,
    b: c.b,
    skill: c.skill,
    count: c.count,
  }));

  // История обрезается до 60 последних дней — серверу больше не нужно.
  const days = Object.entries(data.history ?? {})
    .sort((x, y) => y[0].localeCompare(x[0]))
    .slice(0, 60);

  return {
    cards,
    confusions,
    history: Object.fromEntries(days),
    xp: data.xp,
    bestAnswerStreak: data.bestHotStreak,
    bestDayStreak: data.bestDayStreak ?? 0,
  };
}
