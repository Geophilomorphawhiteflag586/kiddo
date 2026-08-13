/**
 * Адаптивный подбор заданий Chinese.
 *
 * Две особенности против English:
 *  - у каждого знака четыре независимых навыка, поэтому карточка сессии —
 *    это пара «иероглиф × навык»;
 *  - неправильные варианты пиньиня строятся из тоновых двойников (nǐ/nì/ní/nī),
 *    потому что в мандарине тон — это и есть основная трудность.
 */
import { isDue } from '../../lib/srs.ts';
import { newItemQuota } from '../../lib/newItems.ts';
import { CHARACTERS, canSpeakPinyin, getCharacter } from './characters.ts';
import {
  MODE_SKILL,
  MODE_UNLOCK,
  OPTION_COUNT,
  SESSION_LENGTH,
  SESSION_MIX,
  SKILLS,
} from './config.ts';
import { cardKey, characterPercent, isLearned, skillPercent, unlockedCount } from './mastery.ts';
import { soundsSimilar, toneVariants } from './pinyin.ts';
import type {
  ChineseCharacter,
  ChineseProgress,
  ChineseQuestion,
  ChineseQuizMode,
} from './types.ts';

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

/** Собирает набор уникальных вариантов, добавляя кандидатов по приоритету. */
function collect(correct: string, sources: Array<readonly string[]>, count: number): string[] {
  const picked = new Set<string>([correct]);
  for (const source of sources) {
    for (const value of source) {
      if (picked.size >= count) break;
      if (value && !picked.has(value)) picked.add(value);
    }
  }
  return [...picked];
}

/** Варианты-иероглифы: сначала личная путаница, затем соседи по категории. */
function characterOptions(
  target: ChineseCharacter,
  pool: readonly ChineseCharacter[],
  progress: ChineseProgress,
  rng: Rng,
): string[] {
  const sameCategory = pool.filter(
    (c) => c.category === target.category && c.id !== target.id,
  );
  return shuffle(
    collect(
      target.id,
      [
        byCount(progress.charConfusions[target.id]).filter((id) => pool.some((c) => c.id === id)),
        shuffle(sameCategory, rng).map((c) => c.id),
        shuffle(pool, rng).map((c) => c.id),
      ],
      OPTION_COUNT,
    ),
    rng,
  );
}

/**
 * Варианты-пиньинь: тоновые двойники того же слога — самые полезные ошибки,
 * поэтому идут сразу после личной путаницы.
 *
 * Важное ограничение: в варианты попадают только те чтения, для которых в базе
 * есть иероглиф. Вслух произносится именно он — синтез читает 汉字 с нужным
 * тоном, а латиницу превращает в набор букв. Слог без своего знака был бы
 * «немым» вариантом, по которому ребёнку нечему учиться.
 */
function pinyinOptions(
  target: ChineseCharacter,
  pool: readonly ChineseCharacter[],
  progress: ChineseProgress,
  rng: Rng,
): string[] {
  const speakable = (list: readonly string[]) => list.filter(canSpeakPinyin);
  const variants = toneVariants(target.pinyin).filter((p) => p !== target.pinyin);

  // Слоги, отличающиеся только тоном, есть в базе не для всех чтений:
  // у 你 это лишь ní. Недостачу добираем похоже звучащими слогами
  // (та же финаль или та же инициаль) — вслушиваться приходится всё равно,
  // а случайное «chāo» рядом с «nǐ» ничему не учит.
  const similar = pool
    .map((c) => c.pinyin)
    .filter((p) => soundsSimilar(target.pinyin, p));

  return shuffle(
    collect(
      target.pinyin,
      [
        speakable(byCount(progress.pinyinConfusions[target.pinyin])),
        speakable(shuffle(variants, rng)),
        shuffle(similar, rng),
        shuffle(pool, rng).map((c) => c.pinyin),
      ],
      OPTION_COUNT,
    ),
    rng,
  );
}

/** Варианты-значения: строки перевода, обязательно различающиеся. */
function meaningOptions(
  target: ChineseCharacter,
  pool: readonly ChineseCharacter[],
  rng: Rng,
): string[] {
  const sameCategory = pool.filter(
    (c) => c.category === target.category && c.meaningRu !== target.meaningRu,
  );
  return shuffle(
    collect(
      target.meaningRu,
      [
        shuffle(sameCategory, rng).map((c) => c.meaningRu),
        shuffle(pool, rng).map((c) => c.meaningRu),
      ],
      OPTION_COUNT,
    ),
    rng,
  );
}

export function buildQuestion(
  target: ChineseCharacter,
  mode: ChineseQuizMode,
  progress: ChineseProgress,
  pool: readonly ChineseCharacter[] = CHARACTERS,
  rng: Rng = Math.random,
): ChineseQuestion {
  const skill = MODE_SKILL[mode];

  if (mode === 'character-to-meaning') {
    return {
      mode,
      skill,
      characterId: target.id,
      options: meaningOptions(target, pool, rng),
      answer: target.meaningRu,
    };
  }
  if (mode === 'character-to-pinyin' || mode === 'audio-to-pinyin') {
    return {
      mode,
      skill,
      characterId: target.id,
      options: pinyinOptions(target, pool, progress, rng),
      answer: target.pinyin,
    };
  }
  return {
    mode,
    skill,
    characterId: target.id,
    options: characterOptions(target, pool, progress, rng),
    answer: target.id,
  };
}

/** Режимы, доступные знаку при текущем уровне освоения. */
export function modesFor(percent: number): ChineseQuizMode[] {
  let modes = MODE_UNLOCK[0].modes;
  for (const rule of MODE_UNLOCK) if (percent >= rule.minPercent) modes = rule.modes;
  return modes;
}

export interface SessionOptions {
  progress: ChineseProgress;
  length?: number;
  now?: number;
  rng?: Rng;
  mistakesOnly?: boolean;
  reviewOnly?: boolean;
  pool?: readonly ChineseCharacter[];
}

/**
 * Сессия: ошибки → просроченные повторения → путаемые пары → новые знаки.
 * Пул ограничен открытым набором, чтобы 700 иероглифов не сваливались сразу.
 */
export function buildSession({
  progress,
  length = SESSION_LENGTH,
  now = Date.now(),
  rng = Math.random,
  mistakesOnly = false,
  reviewOnly = false,
  pool,
}: SessionOptions): ChineseQuestion[] {
  const learned = CHARACTERS.filter((c) => isLearned(progress, c.id)).length;
  const available =
    pool ?? CHARACTERS.slice(0, unlockedCount(learned, CHARACTERS.length));
  const inPool = new Set(available.map((c) => c.id));

  const questions: ChineseQuestion[] = [];
  const used = new Set<string>();

  /**
   * Место под новые иероглифы резервируется заранее: раньше новое стояло
   * последним и почти никогда не помещалось. При частых ошибках норма
   * обнуляется сама — сначала выправиться, потом расширять базу.
   */
  const quota = newItemQuota({ length, cards: Object.values(progress.cards), now });
  let cap = Math.max(1, length - quota);

  const push = (characterId: string, mode: ChineseQuizMode) => {
    if (questions.length >= cap) return;
    const key = cardKey(characterId, MODE_SKILL[mode]);
    if (used.has(key)) return;
    const target = getCharacter(characterId);
    if (!target || !inPool.has(characterId)) return;
    used.add(key);
    questions.push(buildQuestion(target, mode, progress, available, rng));
  };

  /** Режим для знака: из доступных по освоению, с уклоном в слабый навык. */
  const pickMode = (characterId: string): ChineseQuizMode => {
    const modes = modesFor(characterPercent(progress, characterId));
    const weakest = modes.reduce((weak, mode) => {
      const a = skillPercent(progress.cards[cardKey(characterId, MODE_SKILL[mode])]);
      const b = skillPercent(progress.cards[cardKey(characterId, MODE_SKILL[weak])]);
      return a < b ? mode : weak;
    }, modes[0]);
    // Иногда берём случайный режим, чтобы сессия не становилась однообразной.
    return rng() < 0.7 ? weakest : modes[Math.floor(rng() * modes.length)];
  };

  const cards = Object.values(progress.cards);

  // 1. Недавние ошибки.
  const mistakes = cards
    .filter((card) => card.wrong > 0 && card.streak === 0)
    .sort((a, b) => b.wrong - a.wrong);
  for (const card of mistakes.slice(0, mistakesOnly ? length : SESSION_MIX.mistakes)) {
    push(card.characterId, modeForSkill(card.skill, card.characterId));
  }
  if (mistakesOnly) {
    for (const card of cards.filter((c) => c.wrong > 0)) {
      push(card.characterId, modeForSkill(card.skill, card.characterId));
    }
    return questions;
  }

  // 2. Просроченные повторения.
  const due = cards.filter((card) => isDue(card, now)).sort((a, b) => a.due - b.due);
  for (const card of due.slice(0, reviewOnly ? length : SESSION_MIX.review)) {
    push(card.characterId, modeForSkill(card.skill, card.characterId));
  }
  if (reviewOnly) {
    for (const card of due) push(card.characterId, modeForSkill(card.skill, card.characterId));
    return questions;
  }

  // 3. Путаемые пары — спрашиваем обе стороны.
  for (const matrix of [progress.charConfusions, progress.pinyinConfusions]) {
    for (const [item, pairs] of Object.entries(matrix)) {
      for (const other of byCount(pairs)) {
        if (inPool.has(item)) push(item, pickMode(item));
        if (inPool.has(other)) push(other, pickMode(other));
      }
    }
  }

  // 4. Новые иероглифы — в порядке изучения.
  const fresh = available.filter((char) =>
    SKILLS.every((skill) => !progress.cards[cardKey(char.id, skill)]),
  );
  cap = length;
  const newTarget = Math.max(quota, Math.min(SESSION_MIX.newChars, length - questions.length));
  for (const char of fresh.slice(0, newTarget)) push(char.id, 'character-to-pinyin');

  // 5. Добор: знакомые знаки, затем оставшиеся новые.
  for (const card of shuffle(cards, rng)) {
    push(card.characterId, pickMode(card.characterId));
  }
  for (const char of fresh) push(char.id, 'character-to-pinyin');

  return questions;

  /** Возвращает режим, тренирующий заданный навык. */
  function modeForSkill(skill: string, characterId: string): ChineseQuizMode {
    const modes = modesFor(characterPercent(progress, characterId));
    return modes.find((mode) => MODE_SKILL[mode] === skill) ?? modes[0];
  }
}
