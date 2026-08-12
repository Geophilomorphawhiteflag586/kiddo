import type { SrsState } from '../../lib/srs.ts';
import type { Tone } from './pinyin.ts';

export type CharCategory =
  | 'numbers'
  | 'people'
  | 'family'
  | 'nature'
  | 'body'
  | 'qualities'
  | 'colors'
  | 'position'
  | 'time'
  | 'actions'
  | 'grammar'
  | 'food'
  | 'animals'
  | 'objects'
  | 'places'
  | 'transport'
  | 'school'
  | 'society'
  | 'culture'
  | 'abstract';

/** Компактная строка базы: [иероглиф, пиньинь, RU, EN, категория]. */
export type CharacterRow = [string, string, string, string, CharCategory];

export interface ChineseCharacter {
  /** id совпадает с самим иероглифом — он уникален. */
  id: string;
  character: string;
  pinyin: string;
  /** Выводится из диакритики пиньиня, отдельно хранится для запросов и UI. */
  tone: Tone;
  meaningRu: string;
  meaningEn: string;
  category: CharCategory;
  difficulty: 1 | 2 | 3;
  /** Порядковый номер в порядке изучения = оценка полезности/частотности. */
  frequency: number;
  /** Задел на будущее: ключ и число черт пока не заполняются. */
  radical: string | null;
  strokeCount: number | null;
}

/**
 * Узнавать иероглиф глазами — не то же самое, что понимать его на слух.
 * Поэтому у каждого знака четыре независимых навыка со своим SRS.
 */
export type CharSkill =
  | 'characterRecognition'
  | 'pronunciationRecognition'
  | 'meaningRecognition'
  | 'listeningRecognition';

/** Пять типов заданий первой версии. Ребёнок ничего не печатает. */
export type ChineseQuizMode =
  | 'character-to-pinyin'
  | 'character-to-meaning'
  | 'pinyin-to-character'
  | 'audio-to-character'
  | 'audio-to-pinyin';

export interface ChineseQuestion {
  mode: ChineseQuizMode;
  skill: CharSkill;
  characterId: string;
  /**
   * Варианты ответа. Для режимов с иероглифами — id знаков, для режимов
   * с пиньинем — строки пиньиня, для значений — строки перевода.
   */
  options: string[];
  /** Правильный вариант в том же представлении, что и options. */
  answer: string;
}

export interface CharCard extends SrsState {
  characterId: string;
  skill: CharSkill;
}

export interface ChineseProgress {
  /** Ключ — `${иероглиф}:${навык}`. */
  cards: Record<string, CharCard>;
  /** Путаница иероглифов: 你 ↔ 他. */
  charConfusions: Record<string, Record<string, number>>;
  /** Путаница произношений: mā ↔ má. */
  pinyinConfusions: Record<string, Record<string, number>>;
}

export interface ChineseAnswerRecord {
  characterId: string;
  skill: CharSkill;
  mode: ChineseQuizMode;
  /** Что выбрал пользователь — в представлении режима. */
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  responseTimeMs: number;
}

export interface CharMastery {
  percent: number;
  level: 0 | 1 | 2 | 3 | 4 | 5;
  label: string;
  color: string;
}
