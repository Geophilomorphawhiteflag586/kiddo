/**
 * Чистый слой прогресса Anatomy: SRS по паре «структура × навык», матрица
 * путаницы и XP. Без React и zustand.
 */
import { newSrsState, reviewSrs } from '../../lib/srs.ts';
import { ANATOMY_XP, SKILLS } from './config.ts';
import { cardKey } from './mastery.ts';
import type {
  AnatomyAnswerRecord,
  AnatomyProgress,
  AnatomySkill,
  StructureCard,
} from './types.ts';

export function emptyAnatomyProgress(): AnatomyProgress {
  return { cards: {}, seen: [], confusions: {} };
}

const SKILL_SET = new Set<string>(SKILLS);

export function normalizeAnatomyProgress(
  raw: Partial<AnatomyProgress> | undefined,
): AnatomyProgress {
  const base = emptyAnatomyProgress();
  if (!raw) return base;

  for (const [key, card] of Object.entries(raw.cards ?? {})) {
    if (!card || typeof card !== 'object') continue;
    const [structureId, skill] = key.split(':');
    if (!structureId || !SKILL_SET.has(skill)) continue;
    base.cards[key] = {
      ...newSrsState(),
      ...card,
      structureId,
      skill: skill as AnatomySkill,
    };
  }
  base.seen = Array.isArray(raw.seen) ? raw.seen.filter((id) => typeof id === 'string') : [];
  for (const [id, pairs] of Object.entries(raw.confusions ?? {})) {
    if (pairs && typeof pairs === 'object') base.confusions[id] = { ...pairs };
  }
  return base;
}

export function newStructureCard(structureId: string, skill: AnatomySkill): StructureCard {
  return { structureId, skill, ...newSrsState() };
}

/** Отмечает, что структуру показали на экране изучения. */
export function markSeen(progress: AnatomyProgress, structureId: string): AnatomyProgress {
  if (progress.seen.includes(structureId)) return progress;
  return { ...progress, seen: [...progress.seen, structureId] };
}

export function xpForAnswer(responseTimeMs: number): number {
  return ANATOMY_XP.correct + (responseTimeMs <= ANATOMY_XP.fastMs ? ANATOMY_XP.fastBonus : 0);
}

export interface AnatomyAnswerResult {
  progress: AnatomyProgress;
  xpGained: number;
}

/**
 * Применяет ответ. Путаница пишется в обе стороны: если ребёнок принял
 * височную кость за теменную, эта пара будет чаще встречаться в заданиях.
 */
export function applyAnatomyAnswer(
  progress: AnatomyProgress,
  answer: AnatomyAnswerRecord,
  now = Date.now(),
): AnatomyAnswerResult {
  const key = cardKey(answer.structureId, answer.skill);
  const card = progress.cards[key] ?? newStructureCard(answer.structureId, answer.skill);
  const updated: StructureCard = {
    structureId: answer.structureId,
    skill: answer.skill,
    ...reviewSrs(card, { correct: answer.isCorrect, elapsedMs: answer.responseTimeMs }, now),
  };

  const confusions = { ...progress.confusions };
  if (!answer.isCorrect && answer.chosenId && answer.chosenId !== answer.structureId) {
    for (const [from, to] of [
      [answer.structureId, answer.chosenId],
      [answer.chosenId, answer.structureId],
    ]) {
      const pairs = { ...(confusions[from] ?? {}) };
      pairs[to] = (pairs[to] ?? 0) + 1;
      confusions[from] = pairs;
    }
  }

  return {
    progress: {
      cards: { ...progress.cards, [key]: updated },
      seen: progress.seen.includes(answer.structureId)
        ? progress.seen
        : [...progress.seen, answer.structureId],
      confusions,
    },
    xpGained: answer.isCorrect ? xpForAnswer(answer.responseTimeMs) : 0,
  };
}

/** Пары структур, которые ребёнок путает чаще всего. */
export function topConfusions(
  progress: AnatomyProgress,
  limit = 5,
): Array<{ a: string; b: string; count: number }> {
  const seen = new Map<string, { a: string; b: string; count: number }>();
  for (const [item, pairs] of Object.entries(progress.confusions)) {
    for (const [other, count] of Object.entries(pairs)) {
      const [a, b] = [item, other].sort();
      const key = `${a}:${b}`;
      const existing = seen.get(key);
      // Пара записана с обеих сторон — берём максимум, а не сумму.
      if (existing) existing.count = Math.max(existing.count, count);
      else seen.set(key, { a, b, count });
    }
  }
  return [...seen.values()].sort((x, y) => y.count - x.count).slice(0, limit);
}

/** Структуры с наибольшим числом ошибок. */
export function weakStructures(progress: AnatomyProgress, limit = 5): string[] {
  const wrong = new Map<string, number>();
  for (const card of Object.values(progress.cards)) {
    if (card.wrong > 0) {
      wrong.set(card.structureId, (wrong.get(card.structureId) ?? 0) + card.wrong);
    }
  }
  return [...wrong.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}
