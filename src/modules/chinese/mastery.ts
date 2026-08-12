import {
  LEARNED_LEVEL,
  LEVEL_INTERVALS,
  MASTERY_LEVELS,
  SKILLS,
  UNLOCK_RATIO,
  UNLOCK_TIERS,
} from './config.ts';
import type { CharCard, CharMastery, CharSkill, ChineseProgress } from './types.ts';

export type CharLevel = 0 | 1 | 2 | 3 | 4 | 5;

export const cardKey = (characterId: string, skill: CharSkill) => `${characterId}:${skill}`;

/** Уровень владения одним навыком одного знака — по устойчивости знания. */
export function skillLevel(card: CharCard | undefined): CharLevel {
  if (!card) return 0;
  if (card.repetitions === 0) return 1;
  for (let level = 5; level >= 2; level--) {
    if (card.interval >= LEVEL_INTERVALS[level]) return level as CharLevel;
  }
  return 2;
}

export function skillPercent(card: CharCard | undefined): number {
  const level = skillLevel(card);
  if (level === 0) return 0;
  if (level === 5 || !card) return level * 20;
  const floor = LEVEL_INTERVALS[level];
  const ceil = LEVEL_INTERVALS[level + 1];
  const within =
    ceil === floor ? 0 : Math.max(0, Math.min(1, (card.interval - floor) / (ceil - floor)));
  return Math.round(level * 20 + within * 20);
}

export function cardsOfCharacter(
  progress: ChineseProgress,
  characterId: string,
): Partial<Record<CharSkill, CharCard>> {
  const result: Partial<Record<CharSkill, CharCard>> = {};
  for (const skill of SKILLS) {
    const card = progress.cards[cardKey(characterId, skill)];
    if (card) result[skill] = card;
  }
  return result;
}

/**
 * Освоение знака целиком — среднее по четырём навыкам. Навык, к которому
 * ещё не прикасались, считается нулём: узнавать 你 глазами и не понимать
 * на слух — это не «знать иероглиф».
 */
export function characterPercent(progress: ChineseProgress, characterId: string): number {
  const cards = cardsOfCharacter(progress, characterId);
  const sum = SKILLS.reduce((total, skill) => total + skillPercent(cards[skill]), 0);
  return Math.round(sum / SKILLS.length);
}

export function masteryOf(percent: number): CharMastery {
  const level = Math.min(5, Math.floor(percent / 20)) as CharLevel;
  const meta = MASTERY_LEVELS[level];
  return { percent, level, label: meta.label, color: meta.color };
}

/** Знак выучен, если хотя бы два навыка дошли до уровня «узнаёт». */
export function isLearned(progress: ChineseProgress, characterId: string): boolean {
  const cards = cardsOfCharacter(progress, characterId);
  const confident = SKILLS.filter((skill) => skillLevel(cards[skill]) >= LEARNED_LEVEL);
  return confident.length >= 2;
}

export interface ChineseSummary {
  learned: number;
  seen: number;
  mastery: number;
  bySkill: Record<CharSkill, number>;
  /** Сколько знаков открыто для изучения на данный момент. */
  unlocked: number;
}

/** Сколько иероглифов доступно: следующий набор открывается по мере освоения. */
export function unlockedCount(learned: number, total: number): number {
  for (const tier of UNLOCK_TIERS) {
    const capped = Math.min(tier, total);
    if (learned < capped * UNLOCK_RATIO) return capped;
  }
  return total;
}

export function summarize(
  progress: ChineseProgress,
  allIds: readonly string[],
): ChineseSummary {
  let learned = 0;
  let percentSum = 0;
  const seen = new Set<string>();
  const skillSums = Object.fromEntries(SKILLS.map((s) => [s, 0])) as Record<CharSkill, number>;

  for (const id of allIds) {
    const cards = cardsOfCharacter(progress, id);
    if (Object.keys(cards).length > 0) seen.add(id);
    if (isLearned(progress, id)) learned += 1;
    percentSum += characterPercent(progress, id);
    for (const skill of SKILLS) skillSums[skill] += skillPercent(cards[skill]);
  }

  const total = allIds.length || 1;
  return {
    learned,
    seen: seen.size,
    mastery: Math.round(percentSum / total),
    bySkill: Object.fromEntries(
      SKILLS.map((skill) => [skill, Math.round(skillSums[skill] / total)]),
    ) as Record<CharSkill, number>,
    unlocked: unlockedCount(learned, allIds.length),
  };
}
