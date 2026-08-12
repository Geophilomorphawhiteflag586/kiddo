/**
 * Серверный расчёт Skill Score. Считается ТОЛЬКО из сырых счётчиков карточек —
 * клиент не присылает готовых очков. Чистая функция, покрыта тестами.
 */
import { COUNTRIES } from '../data/countries.ts';
import { SKILL_SCORE, type SkillScoreBreakdown } from '../lib/competitive/config.ts';
import type { SyncCard } from '../lib/competitive/types.ts';
import { SKILLS } from '../lib/skills.ts';

const TIER_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c.tier]));
const TIER3_TOTAL = COUNTRIES.filter((c) => c.tier === 3).length;
export const TOTAL_SKILLS = COUNTRIES.length * SKILLS.length;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Уровень и процент навыка по интервалу — та же шкала, что в приложении. */
function levelOf(card: SyncCard): number {
  if (card.repetitions === 0) return 1;
  if (card.interval >= 21) return 5;
  if (card.interval >= 7) return 4;
  if (card.interval >= 1) return 3;
  return 2;
}

function percentOf(card: SyncCard): number {
  const level = levelOf(card);
  if (level === 5) return 100;
  const bands: Record<number, [number, number]> = {
    1: [0, 0],
    2: [0, 1],
    3: [1, 7],
    4: [7, 21],
  };
  const [floor, ceil] = bands[level];
  const within = ceil === floor ? 0 : clamp01((card.interval - floor) / (ceil - floor));
  return Math.round(level * 20 + within * 20);
}

export function computeSkillScore(
  cards: SyncCard[],
  bestAnswerStreak: number,
): SkillScoreBreakdown & { masteredSkills: number; accuracy: number; avgMs: number | null } {
  const cfg = SKILL_SCORE;

  let mastery = 0;
  let correct = 0;
  let wrong = 0;
  let msSum = 0;
  let msCount = 0;
  let mature = 0;
  let mastered = 0;
  const tier3Mastered = new Set<string>();

  for (const card of cards) {
    const tier = TIER_BY_CODE.get(card.code);
    if (!tier) continue; // неизвестная страна — игнорируем, не падаем
    mastery += percentOf(card) * cfg.mastery.perPercent * cfg.mastery.tierMult[tier - 1];
    correct += card.correct;
    wrong += card.wrong;
    if (card.avgMs !== null && card.correct + card.wrong > 0) {
      msSum += card.avgMs * (card.correct + card.wrong);
      msCount += card.correct + card.wrong;
    }
    if (card.interval >= cfg.retention.matureDays) mature += 1;
    if (levelOf(card) >= cfg.difficulty.masteryLevel) {
      mastered += 1;
      if (tier === 3) tier3Mastered.add(card.code);
    }
  }

  const answers = correct + wrong;
  const accuracy = answers === 0 ? 0 : correct / answers;
  const avgMs = msCount === 0 ? null : Math.round(msSum / msCount);

  const accuracyScore =
    cfg.accuracy.max * accuracy * accuracy * clamp01(answers / cfg.accuracy.fullVolume);

  // Скорость взвешена квадратом точности: быстрые неверные ответы не дают
  // преимущества — точность всегда приоритетнее скорости.
  const speedScore =
    avgMs === null
      ? 0
      : cfg.speed.max *
        clamp01((cfg.speed.slowMs - avgMs) / (cfg.speed.slowMs - cfg.speed.fastMs)) *
        clamp01(answers / cfg.speed.fullVolume) *
        accuracy *
        accuracy;

  const retentionScore = cfg.retention.max * (mature / TOTAL_SKILLS);

  const streakScore =
    cfg.streak.max * clamp01(bestAnswerStreak / cfg.streak.target) ** cfg.streak.exponent;

  const difficultyScore =
    TIER3_TOTAL === 0 ? 0 : cfg.difficulty.max * (tier3Mastered.size / TIER3_TOTAL);

  const parts = {
    masteryScore: Math.round(mastery),
    accuracyScore: Math.round(accuracyScore),
    speedScore: Math.round(speedScore),
    retentionScore: Math.round(retentionScore),
    streakScore: Math.round(streakScore),
    difficultyScore: Math.round(difficultyScore),
  };

  return {
    ...parts,
    totalScore:
      parts.masteryScore +
      parts.accuracyScore +
      parts.speedScore +
      parts.retentionScore +
      parts.streakScore +
      parts.difficultyScore,
    masteredSkills: mastered,
    accuracy,
    avgMs,
  };
}

/** Санитизация карточки из недоверенного источника. Возвращает null для мусора. */
export function sanitizeCard(raw: unknown): SyncCard | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const code = typeof r.code === 'string' ? r.code : '';
  const skill = typeof r.skill === 'string' ? r.skill : '';
  if (!TIER_BY_CODE.has(code)) return null;
  if (!(SKILLS as string[]).includes(skill)) return null;
  const num = (v: unknown, max: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : 0;
  return {
    code,
    skill: skill as SyncCard['skill'],
    correct: Math.floor(num(r.correct, 1_000_000)),
    wrong: Math.floor(num(r.wrong, 1_000_000)),
    avgMs: r.avgMs === null || r.avgMs === undefined ? null : Math.round(num(r.avgMs, 120_000)),
    interval: num(r.interval, 10_000),
    repetitions: Math.floor(num(r.repetitions, 100_000)),
  };
}
