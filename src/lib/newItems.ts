/**
 * Сколько нового давать за сессию.
 *
 * Раньше новые слова, флаги и иероглифы стояли последними в очереди: сначала
 * ошибки, потом просроченные повторения, а новое — если останется место. Место
 * не оставалось почти никогда, и база открывалась мучительно медленно.
 *
 * Теперь под новое место резервируется заранее. Но не вслепую: если ребёнок
 * сейчас часто ошибается, добавлять незнакомое вредно — сначала нужно
 * закрепить то, что уже начато. Поэтому норма зависит от свежей точности.
 */

/** Минимум того, что нужно карточке, чтобы посчитать точность. */
export interface AccuracyCard {
  correct: number;
  wrong: number;
  lastReviewed: number;
}

/** Окно, за которое смотрим точность: то, чем ребёнок занимался на днях. */
const RECENT_MS = 7 * 24 * 60 * 60 * 1000;

/** Меньше этого числа ответов — судить о точности рано. */
const MIN_ANSWERS = 12;

/** Ниже этой точности новое не добавляем: сначала закрепить начатое. */
export const STRUGGLING_BELOW = 0.7;

/** Выше этой точности можно ускоряться. */
export const CONFIDENT_ABOVE = 0.9;

/**
 * Точность за последние дни: доля верных ответов по карточкам, которые
 * недавно повторялись. Давние карточки не учитываются — они говорят о
 * прошлом, а решение принимается про сегодня.
 */
export function recentAccuracy(cards: readonly AccuracyCard[], now = Date.now()): number | null {
  let correct = 0;
  let wrong = 0;
  for (const card of cards) {
    if (card.lastReviewed <= 0 || now - card.lastReviewed > RECENT_MS) continue;
    correct += card.correct;
    wrong += card.wrong;
  }
  const total = correct + wrong;
  return total >= MIN_ANSWERS ? correct / total : null;
}

export interface QuotaOptions {
  /** Сколько вопросов в сессии. */
  length: number;
  /** Карточки модуля — по ним считается свежая точность. */
  cards: readonly AccuracyCard[];
  /** Сколько новых на сессию при обычном темпе. */
  base?: number;
  now?: number;
}

/**
 * Сколько новых элементов включить в сессию.
 *
 * Новичку без истории — обычная норма: ему нужно с чего-то начинать.
 * Ошибается часто — ноль: пусть сначала выправится.
 * Отвечает уверенно — норма с прибавкой, чтобы не топтаться на месте.
 */
export function newItemQuota({ length, cards, base = 2, now = Date.now() }: QuotaOptions): number {
  const accuracy = recentAccuracy(cards, now);
  const scaled = Math.max(1, Math.round((base * length) / 10));

  if (accuracy === null) return scaled;
  if (accuracy < STRUGGLING_BELOW) return 0;
  if (accuracy >= CONFIDENT_ABOVE) return scaled + 1;
  return scaled;
}
