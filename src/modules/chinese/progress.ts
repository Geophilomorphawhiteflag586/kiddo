/**
 * Чистый слой прогресса Chinese: применение ответа, две матрицы путаницы
 * (иероглифов и произношений), XP. Без React и zustand.
 */
import { newSrsState, reviewSrs } from '../../lib/srs.ts';
import { CHINESE_XP } from './config.ts';
import { cardKey } from './mastery.ts';
import type { CharCard, CharSkill, ChineseAnswerRecord, ChineseProgress } from './types.ts';

export function emptyChineseProgress(): ChineseProgress {
  return { cards: {}, charConfusions: {}, pinyinConfusions: {} };
}

const SKILL_SET = new Set<string>([
  'characterRecognition',
  'pronunciationRecognition',
  'meaningRecognition',
  'listeningRecognition',
]);

/** Дополняет частичные данные — например, из более старой версии store. */
export function normalizeChineseProgress(
  raw: Partial<ChineseProgress> | undefined,
): ChineseProgress {
  const base = emptyChineseProgress();
  if (!raw) return base;

  for (const [key, card] of Object.entries(raw.cards ?? {})) {
    if (!card || typeof card !== 'object') continue;
    const [characterId, skill] = key.split(':');
    if (!characterId || !SKILL_SET.has(skill)) continue;
    base.cards[key] = {
      ...newSrsState(),
      ...card,
      characterId,
      skill: skill as CharSkill,
    };
  }
  for (const field of ['charConfusions', 'pinyinConfusions'] as const) {
    for (const [id, pairs] of Object.entries(raw[field] ?? {})) {
      if (pairs && typeof pairs === 'object') base[field][id] = { ...pairs };
    }
  }
  return base;
}

export function newCharCard(characterId: string, skill: CharSkill): CharCard {
  return { characterId, skill, ...newSrsState() };
}

export function xpForAnswer(responseTimeMs: number): number {
  return CHINESE_XP.correct + (responseTimeMs <= CHINESE_XP.fastMs ? CHINESE_XP.fastBonus : 0);
}

export interface ChineseAnswerResult {
  progress: ChineseProgress;
  xpGained: number;
}

/** Записывает путаницу в обе стороны — пара нужна симметричной. */
function bumpPair(matrix: Record<string, Record<string, number>>, a: string, b: string) {
  for (const [from, to] of [
    [a, b],
    [b, a],
  ]) {
    const pairs = { ...(matrix[from] ?? {}) };
    pairs[to] = (pairs[to] ?? 0) + 1;
    matrix[from] = pairs;
  }
}

/**
 * Применяет ответ: обновляет SRS соответствующего навыка и, при ошибке,
 * нужную матрицу путаницы. Режимы с иероглифами пишут путаницу знаков,
 * режимы с пиньинем — путаницу произношений (mā ↔ má).
 */
export function applyChineseAnswer(
  progress: ChineseProgress,
  answer: ChineseAnswerRecord,
  now = Date.now(),
): ChineseAnswerResult {
  const key = cardKey(answer.characterId, answer.skill);
  const card = progress.cards[key] ?? newCharCard(answer.characterId, answer.skill);
  const updated: CharCard = {
    characterId: answer.characterId,
    skill: answer.skill,
    ...reviewSrs(card, { correct: answer.isCorrect, elapsedMs: answer.responseTimeMs }, now),
  };

  const charConfusions = { ...progress.charConfusions };
  const pinyinConfusions = { ...progress.pinyinConfusions };

  if (!answer.isCorrect && answer.selectedAnswer && answer.selectedAnswer !== answer.correctAnswer) {
    const answersAreCharacters =
      answer.mode === 'pinyin-to-character' || answer.mode === 'audio-to-character';
    const answersArePinyin =
      answer.mode === 'character-to-pinyin' || answer.mode === 'audio-to-pinyin';

    if (answersAreCharacters) {
      bumpPair(charConfusions, answer.correctAnswer, answer.selectedAnswer);
    } else if (answersArePinyin) {
      bumpPair(pinyinConfusions, answer.correctAnswer, answer.selectedAnswer);
    }
    // Режим значений путаницу не пишет: варианты — это переводы, а не знаки.
  }

  return {
    progress: {
      cards: { ...progress.cards, [key]: updated },
      charConfusions,
      pinyinConfusions,
    },
    xpGained: answer.isCorrect ? xpForAnswer(answer.responseTimeMs) : 0,
  };
}

function topPairs(
  matrix: Record<string, Record<string, number>>,
  limit: number,
): Array<{ a: string; b: string; count: number }> {
  const seen = new Map<string, { a: string; b: string; count: number }>();
  for (const [item, pairs] of Object.entries(matrix)) {
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

export const topCharConfusions = (progress: ChineseProgress, limit = 5) =>
  topPairs(progress.charConfusions, limit);

export const topPinyinConfusions = (progress: ChineseProgress, limit = 5) =>
  topPairs(progress.pinyinConfusions, limit);

/** Знаки, в которых ребёнок ошибается чаще всего. */
export function weakCharacters(progress: ChineseProgress, limit = 5): string[] {
  const wrongByChar = new Map<string, number>();
  for (const card of Object.values(progress.cards)) {
    if (card.wrong > 0) {
      wrongByChar.set(card.characterId, (wrongByChar.get(card.characterId) ?? 0) + card.wrong);
    }
  }
  return [...wrongByChar.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}
