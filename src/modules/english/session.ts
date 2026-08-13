/**
 * Адаптивный подбор заданий. Сессия никогда не берёт «просто 10 случайных
 * слов»: сначала ошибки и просроченные повторения, затем персональная путаница,
 * затем новые слова — та же философия, что в модуле флагов.
 */
import { isDue } from '../../lib/srs.ts';
import { newItemQuota } from '../../lib/newItems.ts';
import { MODE_UNLOCK, OPTION_COUNT, SESSION_LENGTH, SESSION_MIX } from './config.ts';
import { wordPercent } from './mastery.ts';
import type { EnglishProgress, EnglishQuestion, EnglishWord, QuizMode } from './types.ts';
import { WORDS, getWord } from './words.ts';

export type Rng = () => number;

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const byCount = (pairs: Record<string, number> | undefined): string[] =>
  Object.entries(pairs ?? {})
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

/**
 * Варианты ответа. Сначала то, что ребёнок уже путал с этим словом, затем
 * слова той же категории, затем того же типа. Тип выдерживается строго:
 * рядом с глаголом стоят глаголы, иначе картинка действия спорит с предметом.
 */
export function buildOptions(
  target: EnglishWord,
  progress: EnglishProgress,
  pool: readonly EnglishWord[] = WORDS,
  count = OPTION_COUNT,
  rng: Rng = Math.random,
): string[] {
  const picked = new Set<string>([target.id]);
  const byId = new Map(pool.map((w) => [w.id, w]));

  const add = (ids: readonly string[]) => {
    for (const id of ids) {
      if (picked.size >= count) return;
      if (picked.has(id) || !byId.has(id)) continue;
      picked.add(id);
    }
  };

  const sameType = pool.filter((w) => w.type === target.type && w.id !== target.id);
  const sameCategory = sameType.filter((w) => w.category === target.category);

  add(byCount(progress.confusions[target.id]));
  add(shuffle(sameCategory, rng).map((w) => w.id));
  add(shuffle(sameType, rng).map((w) => w.id));
  // Крайний случай (крошечный пул) — добираем чем угодно, лишь бы 4 варианта.
  add(shuffle(pool, rng).map((w) => w.id));

  return shuffle([...picked], rng);
}

/** Доступные режимы для слова: чем лучше освоено, тем сложнее задание. */
export function modesFor(percent: number): QuizMode[] {
  let modes = MODE_UNLOCK[0].modes;
  for (const rule of MODE_UNLOCK) if (percent >= rule.minPercent) modes = rule.modes;
  return modes;
}

export function pickMode(percent: number, rng: Rng = Math.random): QuizMode {
  const modes = modesFor(percent);
  return modes[Math.floor(rng() * modes.length)];
}

export interface SessionOptions {
  progress: EnglishProgress;
  length?: number;
  now?: number;
  rng?: Rng;
  /** Только слова, в которых были ошибки. */
  mistakesOnly?: boolean;
  /** Только слова, которые пора повторить. */
  reviewOnly?: boolean;
  pool?: readonly EnglishWord[];
}

/**
 * Собирает сессию: ошибки → просроченные повторения → путаемые пары →
 * новые слова → контрольное повторение выученного.
 */
export function buildSession({
  progress,
  length = SESSION_LENGTH,
  now = Date.now(),
  rng = Math.random,
  mistakesOnly = false,
  reviewOnly = false,
  pool = WORDS,
}: SessionOptions): EnglishQuestion[] {
  const questions: EnglishQuestion[] = [];
  const used = new Set<string>();

  /**
   * Место под новые слова резервируется заранее.
   *
   * Раньше новое стояло последним в очереди и почти никогда не помещалось:
   * ошибки и просроченные повторения съедали сессию целиком, и база
   * открывалась мучительно медленно. Теперь повторения ограничены `cap`, а
   * остаток отдан новым словам.
   */
  const quota = newItemQuota({ length, cards: Object.values(progress.cards), now });
  let cap = Math.max(1, length - quota);

  const push = (wordId: string) => {
    if (questions.length >= cap || used.has(wordId)) return;
    const word = getWord(wordId);
    if (!word) return;
    used.add(wordId);
    questions.push({
      mode: pickMode(wordPercent(progress.cards[wordId]), rng),
      wordId,
      options: buildOptions(word, progress, pool, OPTION_COUNT, rng),
    });
  };

  const cards = Object.values(progress.cards);

  // 1. Слова с недавними ошибками — серия сброшена, ошибки есть.
  const mistakes = cards
    .filter((card) => card.wrong > 0 && card.streak === 0)
    .sort((a, b) => b.wrong - a.wrong);
  for (const card of mistakes.slice(0, mistakesOnly ? length : SESSION_MIX.mistakes)) {
    push(card.wordId);
  }
  if (mistakesOnly) {
    // Добираем любыми словами, где вообще были ошибки.
    for (const card of cards.filter((c) => c.wrong > 0)) push(card.wordId);
    return questions;
  }

  // 2. Просроченные повторения — самые старые первыми.
  const due = cards.filter((card) => isDue(card, now)).sort((a, b) => a.due - b.due);
  for (const card of due.slice(0, reviewOnly ? length : SESSION_MIX.review)) push(card.wordId);
  if (reviewOnly) {
    for (const card of due) push(card.wordId);
    return questions;
  }

  // 3. Путаемые пары: спрашиваем обе стороны, чтобы ребёнок их развёл.
  for (const [wordId, pairs] of Object.entries(progress.confusions)) {
    for (const other of byCount(pairs)) {
      push(wordId);
      push(other);
    }
  }

  // 4. Новые слова — от простых к сложным. Здесь снимаем ограничение:
  // зарезервированные места как раз для них.
  cap = length;
  const fresh = pool
    .filter((word) => !progress.cards[word.id])
    .sort((a, b) => a.difficulty - b.difficulty);
  const newTarget = Math.max(quota, Math.min(SESSION_MIX.newWords, length - questions.length));
  for (const word of fresh.slice(0, newTarget)) push(word.id);

  // 5. Добор: сначала оставшиеся новые, затем повторение уже знакомого.
  for (const word of fresh) push(word.id);
  for (const card of shuffle(cards, rng)) push(card.wordId);

  return questions;
}
