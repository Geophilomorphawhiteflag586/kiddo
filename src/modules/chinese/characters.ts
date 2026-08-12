import { CHARACTER_ROWS } from './data/characters.ts';
import { toneOf } from './pinyin.ts';
import type { CharCategory, ChineseCharacter } from './types.ts';

/**
 * Сборка базы из компактных строк. Порядок строки = порядок изучения:
 * первые знаки самые простые и полезные, дальше — более редкие.
 *
 * Сложность выводится из позиции: она же управляет тем, какие знаки
 * попадают в ранние сессии.
 */
function difficultyOf(index: number): 1 | 2 | 3 {
  if (index < 150) return 1;
  if (index < 400) return 2;
  return 3;
}

export const CHARACTERS: ChineseCharacter[] = CHARACTER_ROWS.map(
  ([character, pinyin, meaningRu, meaningEn, category], index) => ({
    id: character,
    character,
    pinyin,
    tone: toneOf(pinyin),
    meaningRu,
    meaningEn,
    category,
    difficulty: difficultyOf(index),
    frequency: index + 1,
    // Ключ и число черт появятся позже — модель к ним готова.
    radical: null,
    strokeCount: null,
  }),
);

export const CHARACTER_BY_ID: ReadonlyMap<string, ChineseCharacter> = new Map(
  CHARACTERS.map((char) => [char.id, char]),
);

export function getCharacter(id: string): ChineseCharacter | undefined {
  return CHARACTER_BY_ID.get(id);
}

export const TOTAL_CHARACTERS = CHARACTERS.length;

export function charactersOfCategory(category: CharCategory): ChineseCharacter[] {
  return CHARACTERS.filter((char) => char.category === category);
}

export const CATEGORIES: CharCategory[] = [...new Set(CHARACTERS.map((c) => c.category))];

/**
 * Иероглиф с таким же чтением. Нужен для озвучки варианта пиньиня: синтез
 * читает 汉字 с правильным тоном, а латиницу произносит как английские буквы —
 * поэтому вслух всегда идёт иероглиф, а не «nì».
 *
 * Из нескольких знаков с одинаковым чтением берётся самый частотный: он проще
 * и вероятнее озвучится корректно.
 */
const BY_PINYIN = new Map<string, string>();
for (const char of CHARACTERS) {
  if (!BY_PINYIN.has(char.pinyin)) BY_PINYIN.set(char.pinyin, char.character);
}

export function characterForPinyin(pinyin: string): string | undefined {
  return BY_PINYIN.get(pinyin);
}

/**
 * Можно ли произнести этот пиньинь вслух. Вариант ответа, который нельзя
 * озвучить, в задании бесполезен — по нему нечему учиться.
 */
export function canSpeakPinyin(pinyin: string): boolean {
  return BY_PINYIN.has(pinyin);
}

/** Все чтения, встречающиеся в базе, — только они годятся в варианты ответа. */
export const SPEAKABLE_PINYIN: readonly string[] = [...BY_PINYIN.keys()];
