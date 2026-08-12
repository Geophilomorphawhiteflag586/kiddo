/**
 * Чистый слой прогресса English: применение ответа, матрица путаницы, XP.
 * Ничего не знает про React — тестируется в node напрямую.
 */
import { newSrsState, reviewSrs } from '../../lib/srs.ts';
import { ENGLISH_XP } from './config.ts';
import type { EnglishAnswerRecord, EnglishProgress, WordCard } from './types.ts';

export function emptyEnglishProgress(): EnglishProgress {
  return { cards: {}, confusions: {} };
}

/** Дополняет частичные данные (например, из старой версии store). */
export function normalizeEnglishProgress(
  raw: Partial<EnglishProgress> | undefined,
): EnglishProgress {
  const base = emptyEnglishProgress();
  if (!raw) return base;
  if (raw.cards && typeof raw.cards === 'object') {
    for (const [id, card] of Object.entries(raw.cards)) {
      if (card && typeof card === 'object') {
        // wordId берётся из ключа: он надёжнее возможного поля внутри объекта.
        base.cards[id] = { ...newSrsState(), ...card, wordId: id };
      }
    }
  }
  if (raw.confusions && typeof raw.confusions === 'object') {
    for (const [id, pairs] of Object.entries(raw.confusions)) {
      if (pairs && typeof pairs === 'object') base.confusions[id] = { ...pairs };
    }
  }
  return base;
}

export function newWordCard(wordId: string): WordCard {
  return { wordId, ...newSrsState() };
}

export function xpForAnswer(responseTimeMs: number): number {
  return ENGLISH_XP.correct + (responseTimeMs <= ENGLISH_XP.fastMs ? ENGLISH_XP.fastBonus : 0);
}

export interface EnglishAnswerResult {
  progress: EnglishProgress;
  xpGained: number;
}

/**
 * Применяет ответ. Путаница записывается в обе стороны: если ребёнок выбрал
 * orange вместо apple, эта пара будет чаще встречаться в будущих заданиях —
 * та же логика, что и в матрице путаницы флагов.
 */
export function applyEnglishAnswer(
  progress: EnglishProgress,
  answer: EnglishAnswerRecord,
  now = Date.now(),
): EnglishAnswerResult {
  const card = progress.cards[answer.wordId] ?? newWordCard(answer.wordId);
  const updated: WordCard = {
    wordId: answer.wordId,
    ...reviewSrs(card, { correct: answer.isCorrect, elapsedMs: answer.responseTimeMs }, now),
  };

  const confusions = { ...progress.confusions };
  if (!answer.isCorrect && answer.chosenId && answer.chosenId !== answer.wordId) {
    const bump = (from: string, to: string) => {
      const pairs = { ...(confusions[from] ?? {}) };
      pairs[to] = (pairs[to] ?? 0) + 1;
      confusions[from] = pairs;
    };
    bump(answer.wordId, answer.chosenId);
    bump(answer.chosenId, answer.wordId);
  }

  return {
    progress: { cards: { ...progress.cards, [answer.wordId]: updated }, confusions },
    xpGained: answer.isCorrect ? xpForAnswer(answer.responseTimeMs) : 0,
  };
}

/** Пары слов, которые ребёнок путает чаще всего. */
export function topConfusionPairs(
  progress: EnglishProgress,
  limit = 5,
): Array<{ a: string; b: string; count: number }> {
  const seen = new Map<string, { a: string; b: string; count: number }>();
  for (const [word, pairs] of Object.entries(progress.confusions)) {
    for (const [other, count] of Object.entries(pairs)) {
      const [a, b] = [word, other].sort();
      const key = `${a}:${b}`;
      const existing = seen.get(key);
      // Пара записана с обеих сторон — берём максимум, а не сумму.
      if (existing) existing.count = Math.max(existing.count, count);
      else seen.set(key, { a, b, count });
    }
  }
  return [...seen.values()].sort((x, y) => y.count - x.count).slice(0, limit);
}

/** Слова, в которых ребёнок ошибается чаще всего. */
export function weakWords(progress: EnglishProgress, limit = 5): WordCard[] {
  return Object.values(progress.cards)
    .filter((card) => card.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong || a.interval - b.interval)
    .slice(0, limit);
}
