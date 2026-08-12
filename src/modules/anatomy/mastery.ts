import {
  LEARNED_LEVEL,
  LEVEL_INTERVALS,
  MASTERY_LEVELS,
  SKELETON_UNLOCK_RATIO,
  SKILLS,
  SYSTEMS,
  UNLOCK_RATIO,
} from './config.ts';
import { structuresOfRegion, structuresOfSystem } from './structures.ts';
import type {
  AnatomyProgress,
  AnatomySkill,
  AnatomySystem,
  RegionId,
  StructureCard,
  StructureMastery,
} from './types.ts';

export const cardKey = (structureId: string, skill: AnatomySkill) => `${structureId}:${skill}`;

export function skillLevel(card: StructureCard | undefined): 0 | 1 | 2 | 3 | 4 | 5 {
  if (!card) return 0;
  if (card.repetitions === 0) return 1;
  for (let level = 5; level >= 2; level--) {
    if (card.interval >= LEVEL_INTERVALS[level]) return level as 2 | 3 | 4 | 5;
  }
  return 2;
}

export function skillPercent(card: StructureCard | undefined): number {
  const level = skillLevel(card);
  if (level === 0) return 0;
  if (level === 5 || !card) return level * 20;
  const floor = LEVEL_INTERVALS[level];
  const ceil = LEVEL_INTERVALS[level + 1];
  const within =
    ceil === floor ? 0 : Math.max(0, Math.min(1, (card.interval - floor) / (ceil - floor)));
  return Math.round(level * 20 + within * 20);
}

export function cardsOf(
  progress: AnatomyProgress,
  structureId: string,
): Partial<Record<AnatomySkill, StructureCard>> {
  const result: Partial<Record<AnatomySkill, StructureCard>> = {};
  for (const skill of SKILLS) {
    const card = progress.cards[cardKey(structureId, skill)];
    if (card) result[skill] = card;
  }
  return result;
}

/**
 * Освоение структуры — среднее по трём навыкам. Знать название и уметь
 * показать место — разные умения, поэтому нетронутый навык считается нулём.
 */
export function structurePercent(progress: AnatomyProgress, structureId: string): number {
  const cards = cardsOf(progress, structureId);
  const sum = SKILLS.reduce((total, skill) => total + skillPercent(cards[skill]), 0);
  return Math.round(sum / SKILLS.length);
}

export function masteryOf(progress: AnatomyProgress, structureId: string): StructureMastery {
  const cards = cardsOf(progress, structureId);
  const percent = structurePercent(progress, structureId);
  const level = Math.min(5, Math.floor(percent / 20)) as 0 | 1 | 2 | 3 | 4 | 5;
  const meta = MASTERY_LEVELS[level];
  return {
    percent,
    level,
    label: meta.label,
    color: meta.color,
    bySkill: Object.fromEntries(
      SKILLS.map((skill) => [skill, skillPercent(cards[skill])]),
    ) as Record<AnatomySkill, number>,
  };
}

/** Структура изучена, если хотя бы два навыка дошли до уровня «узнаёт». */
export function isLearned(progress: AnatomyProgress, structureId: string): boolean {
  const cards = cardsOf(progress, structureId);
  return SKILLS.filter((skill) => skillLevel(cards[skill]) >= LEARNED_LEVEL).length >= 2;
}

export function learnedInSystem(progress: AnatomyProgress, system: AnatomySystem): number {
  return structuresOfSystem(system).filter((s) => isLearned(progress, s.id)).length;
}

export function learnedInRegion(progress: AnatomyProgress, region: RegionId): number {
  return structuresOfRegion(region).filter((s) => isLearned(progress, s.id)).length;
}

/**
 * Открыта ли система. Путь линейный: следующая появляется, когда предыдущая
 * освоена достаточно — иначе ребёнок хватается за всё сразу.
 */
export function isSystemUnlocked(progress: AnatomyProgress, system: AnatomySystem): boolean {
  const meta = SYSTEMS.find((s) => s.id === system);
  if (!meta?.unlockAfter) return true;
  const previous = structuresOfSystem(meta.unlockAfter);
  if (previous.length === 0) return true;
  return learnedInSystem(progress, meta.unlockAfter) / previous.length >= UNLOCK_RATIO;
}

/** Полный скелет — итоговая проверка, а не первый экран. */
export function isSkeletonUnlocked(progress: AnatomyProgress): boolean {
  const bones = structuresOfSystem('bones');
  if (bones.length === 0) return false;
  return learnedInSystem(progress, 'bones') / bones.length >= SKELETON_UNLOCK_RATIO;
}

export interface AnatomySummary {
  learned: number;
  seen: number;
  mastery: number;
  bySkill: Record<AnatomySkill, number>;
}

export function summarize(progress: AnatomyProgress, ids: readonly string[]): AnatomySummary {
  let learned = 0;
  let percentSum = 0;
  const skillSums = Object.fromEntries(SKILLS.map((s) => [s, 0])) as Record<AnatomySkill, number>;

  for (const id of ids) {
    if (isLearned(progress, id)) learned += 1;
    percentSum += structurePercent(progress, id);
    const cards = cardsOf(progress, id);
    for (const skill of SKILLS) skillSums[skill] += skillPercent(cards[skill]);
  }

  const total = ids.length || 1;
  return {
    learned,
    seen: progress.seen.length,
    mastery: Math.round(percentSum / total),
    bySkill: Object.fromEntries(
      SKILLS.map((skill) => [skill, Math.round(skillSums[skill] / total)]),
    ) as Record<AnatomySkill, number>,
  };
}
