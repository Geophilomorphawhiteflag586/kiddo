import { LEARNED_LEVEL, LEVEL_INTERVALS, MASTERY_LEVELS } from './config.ts';
import type { EnglishProgress, WordCard, WordMastery } from './types.ts';

export type WordLevel = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Уровень освоения слова считается по устойчивости знания (интервал повторения),
 * а не по числу правильных ответов: угадать три раза подряд ≠ выучить.
 */
export function wordLevel(card: WordCard | undefined): WordLevel {
  if (!card) return 0;
  if (card.repetitions === 0) return 1;
  for (let level = 5; level >= 2; level--) {
    if (card.interval >= LEVEL_INTERVALS[level]) return level as WordLevel;
  }
  return 2;
}

/** Проценты внутри уровня растут плавно вместе с интервалом. */
export function wordPercent(card: WordCard | undefined): number {
  const level = wordLevel(card);
  if (level === 0) return 0;
  if (level === 5 || !card) return level * 20;
  const floor = LEVEL_INTERVALS[level];
  const ceil = LEVEL_INTERVALS[level + 1];
  const within = ceil === floor ? 0 : Math.max(0, Math.min(1, (card.interval - floor) / (ceil - floor)));
  return Math.round(level * 20 + within * 20);
}

export function masteryOf(card: WordCard | undefined): WordMastery {
  const level = wordLevel(card);
  const meta = MASTERY_LEVELS[level];
  return { percent: wordPercent(card), level, label: meta.label, color: meta.color };
}

export function isLearned(card: WordCard | undefined): boolean {
  return wordLevel(card) >= LEARNED_LEVEL;
}

export interface EnglishSummary {
  learned: number;
  seen: number;
  mastery: number;
  accuracy: number;
}

/** Сводка по всему модулю — то, что видно на карточке English и в прогрессе. */
export function summarize(progress: EnglishProgress, total: number): EnglishSummary {
  const cards = Object.values(progress.cards);
  let learned = 0;
  let percentSum = 0;
  let correct = 0;
  let answers = 0;

  for (const card of cards) {
    if (isLearned(card)) learned += 1;
    percentSum += wordPercent(card);
    correct += card.correct;
    answers += card.correct + card.wrong;
  }

  return {
    learned,
    seen: cards.length,
    // Освоение считается от всей базы, а не от увиденных слов.
    mastery: total === 0 ? 0 : Math.round(percentSum / total),
    accuracy: answers === 0 ? 0 : correct / answers,
  };
}
