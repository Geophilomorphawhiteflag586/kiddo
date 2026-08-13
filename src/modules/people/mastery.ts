import { LEARNED_LEVEL, LEVEL_INTERVALS, MASTERY_LEVELS, SKILLS } from './config.ts';
import type { PeopleProgress, PeopleSkill, PersonCard } from './types.ts';

export const cardKey = (personId: string, skill: PeopleSkill) => `${personId}:${skill}`;

/** Уровень навыка: от «не знаком» до «освоено», по интервалу повторения. */
export function skillLevel(card: PersonCard | undefined): number {
  if (!card || card.repetitions === 0) return 0;
  let level = 0;
  for (const [index, days] of LEVEL_INTERVALS.entries()) {
    if (card.interval >= days) level = index;
  }
  return Math.min(level, MASTERY_LEVELS.length - 1);
}

export function skillPercent(card: PersonCard | undefined): number {
  return Math.round((skillLevel(card) / (MASTERY_LEVELS.length - 1)) * 100);
}

/** Общее освоение человека — среднее по четырём навыкам. */
export function personPercent(progress: PeopleProgress, personId: string): number {
  const total = SKILLS.reduce(
    (sum, skill) => sum + skillPercent(progress.cards[cardKey(personId, skill)]),
    0,
  );
  return Math.round(total / SKILLS.length);
}

export interface PersonMastery {
  percent: number;
  level: number;
  label: string;
  color: string;
  bySkill: Record<PeopleSkill, number>;
}

export function masteryOf(progress: PeopleProgress, personId: string): PersonMastery {
  const bySkill = Object.fromEntries(
    SKILLS.map((skill) => [skill, skillPercent(progress.cards[cardKey(personId, skill)])]),
  ) as Record<PeopleSkill, number>;
  const percent = personPercent(progress, personId);
  const level = Math.round((percent / 100) * (MASTERY_LEVELS.length - 1));
  return { percent, level, ...MASTERY_LEVELS[level], bySkill };
}

/** Человек считается изученным, когда все навыки дошли до нужного уровня. */
export function isLearned(progress: PeopleProgress, personId: string): boolean {
  return SKILLS.every(
    (skill) => skillLevel(progress.cards[cardKey(personId, skill)]) >= LEARNED_LEVEL,
  );
}

export interface PeopleSummary {
  learned: number;
  mastery: number;
  bySkill: Record<PeopleSkill, number>;
}

export function summarize(progress: PeopleProgress, ids: readonly string[]): PeopleSummary {
  if (ids.length === 0) {
    return {
      learned: 0,
      mastery: 0,
      bySkill: Object.fromEntries(SKILLS.map((s) => [s, 0])) as Record<PeopleSkill, number>,
    };
  }
  const bySkill = Object.fromEntries(
    SKILLS.map((skill) => [
      skill,
      Math.round(
        ids.reduce((sum, id) => sum + skillPercent(progress.cards[cardKey(id, skill)]), 0) /
          ids.length,
      ),
    ]),
  ) as Record<PeopleSkill, number>;

  return {
    learned: ids.filter((id) => isLearned(progress, id)).length,
    mastery: Math.round(
      ids.reduce((sum, id) => sum + personPercent(progress, id), 0) / ids.length,
    ),
    bySkill,
  };
}
