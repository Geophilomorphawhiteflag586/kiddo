/**
 * Чистый слой прогресса «Известные люди»: SRS по паре «человек × навык»,
 * матрица путаницы и XP. Без React и zustand.
 */
import { newSrsState, reviewSrs } from '../../lib/srs.ts';
import { PEOPLE_XP, SKILLS } from './config.ts';
import { cardKey } from './mastery.ts';
import type { PeopleAnswerRecord, PeopleProgress, PeopleSkill, PersonCard } from './types.ts';

export function emptyPeopleProgress(): PeopleProgress {
  return { cards: {}, seen: [], confusions: {} };
}

const SKILL_SET = new Set<string>(SKILLS);

export function normalizePeopleProgress(
  raw: Partial<PeopleProgress> | undefined,
): PeopleProgress {
  const base = emptyPeopleProgress();
  if (!raw) return base;

  for (const [key, card] of Object.entries(raw.cards ?? {})) {
    if (!card || typeof card !== 'object') continue;
    const [personId, skill] = key.split(':');
    if (!personId || !SKILL_SET.has(skill)) continue;
    base.cards[key] = { ...newSrsState(), ...card, personId, skill: skill as PeopleSkill };
  }
  base.seen = Array.isArray(raw.seen) ? raw.seen.filter((id) => typeof id === 'string') : [];
  for (const [id, pairs] of Object.entries(raw.confusions ?? {})) {
    if (pairs && typeof pairs === 'object') base.confusions[id] = { ...pairs };
  }
  return base;
}

export function newPersonCard(personId: string, skill: PeopleSkill): PersonCard {
  return { personId, skill, ...newSrsState() };
}

/** Отмечает, что человека показали на экране знакомства. */
export function markSeen(progress: PeopleProgress, personId: string): PeopleProgress {
  if (progress.seen.includes(personId)) return progress;
  return { ...progress, seen: [...progress.seen, personId] };
}

export function xpForAnswer(responseTimeMs: number): number {
  return PEOPLE_XP.correct + (responseTimeMs <= PEOPLE_XP.fastMs ? PEOPLE_XP.fastBonus : 0);
}

export interface PeopleAnswerResult {
  progress: PeopleProgress;
  xpGained: number;
}

export function applyPeopleAnswer(
  progress: PeopleProgress,
  answer: PeopleAnswerRecord,
  now = Date.now(),
): PeopleAnswerResult {
  const key = cardKey(answer.personId, answer.skill);
  const card = progress.cards[key] ?? newPersonCard(answer.personId, answer.skill);

  const cards = {
    ...progress.cards,
    [key]: {
      ...card,
      ...reviewSrs(card, { correct: answer.isCorrect, elapsedMs: answer.responseTimeMs }, now),
      personId: answer.personId,
      skill: answer.skill,
    },
  };

  // Путаница пишется в обе стороны: если ребёнок принял Бөкейхана за
  // Байтұрсынұлы, обратная ошибка тоже вероятна.
  const confusions = { ...progress.confusions };
  const wrongPerson = !answer.isCorrect && answer.chosen !== answer.personId;
  const isPersonChoice = answer.mode === 'photo-to-name' || answer.mode === 'name-to-photo';
  if (wrongPerson && isPersonChoice) {
    for (const [from, to] of [
      [answer.personId, answer.chosen],
      [answer.chosen, answer.personId],
    ]) {
      confusions[from] = { ...confusions[from], [to]: (confusions[from]?.[to] ?? 0) + 1 };
    }
  }

  return {
    progress: {
      cards,
      seen: progress.seen.includes(answer.personId)
        ? progress.seen
        : [...progress.seen, answer.personId],
      confusions,
    },
    xpGained: answer.isCorrect ? xpForAnswer(answer.responseTimeMs) : 0,
  };
}

export interface ConfusionPair {
  a: string;
  b: string;
  count: number;
}

/** Самые частые путаницы, каждая пара — один раз. */
export function topConfusions(progress: PeopleProgress, limit = 5): ConfusionPair[] {
  const pairs = new Map<string, ConfusionPair>();
  for (const [a, targets] of Object.entries(progress.confusions)) {
    for (const [b, count] of Object.entries(targets)) {
      const key = [a, b].sort().join('|');
      const existing = pairs.get(key);
      if (!existing || count > existing.count) pairs.set(key, { a, b, count });
    }
  }
  return [...pairs.values()].sort((x, y) => y.count - x.count).slice(0, limit);
}

/** Кого стоит повторить: больше всего ошибок по всем навыкам. */
export function weakPeople(progress: PeopleProgress, limit = 5): string[] {
  const wrong = new Map<string, number>();
  for (const card of Object.values(progress.cards)) {
    if (card.wrong > 0) wrong.set(card.personId, (wrong.get(card.personId) ?? 0) + card.wrong);
  }
  return [...wrong.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}
