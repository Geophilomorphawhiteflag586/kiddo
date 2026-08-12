import { NOUN_ROWS } from './data/nouns.ts';
import { VERB_ROWS } from './data/verbs.ts';
import type { EnglishWord, WordCategory, WordRow, WordType } from './types.ts';

/**
 * Словарь собирается из компактных строк. Чтобы расширить базу с 400 до 1000
 * слов, достаточно дописать строки в data/*.ts — остальной модуль не меняется.
 */
function build(rows: WordRow[], type: WordType): EnglishWord[] {
  return rows.map(([id, emoji, translationRu, category, difficulty]) => ({
    id,
    word: id,
    translationRu,
    type,
    category,
    emoji,
    // Локальный файл подставится сюда, когда появится: /english/images/<id>.webp
    image: null,
    pronunciation: id,
    difficulty,
  }));
}

export const NOUNS: EnglishWord[] = build(NOUN_ROWS, 'noun');
export const VERBS: EnglishWord[] = build(VERB_ROWS, 'verb');
export const WORDS: EnglishWord[] = [...NOUNS, ...VERBS];

export const WORD_BY_ID: ReadonlyMap<string, EnglishWord> = new Map(
  WORDS.map((word) => [word.id, word]),
);

export function getWord(id: string): EnglishWord | undefined {
  return WORD_BY_ID.get(id);
}

export const TOTAL_WORDS = WORDS.length;
export const TOTAL_NOUNS = NOUNS.length;
export const TOTAL_VERBS = VERBS.length;

export function wordsOfCategory(category: WordCategory): EnglishWord[] {
  return WORDS.filter((word) => word.category === category);
}

export const CATEGORIES: WordCategory[] = [...new Set(WORDS.map((w) => w.category))];
