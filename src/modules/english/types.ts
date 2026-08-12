import type { SrsState } from '../../lib/srs.ts';

export type WordType = 'noun' | 'verb';

export type WordCategory =
  | 'animals'
  | 'food'
  | 'drinks'
  | 'people'
  | 'body'
  | 'home'
  | 'clothes'
  | 'transport'
  | 'nature'
  | 'weather'
  | 'places'
  | 'school'
  | 'toys'
  | 'objects'
  | 'colors'
  | 'numbers'
  | 'actions';

/** Компактная строка словаря: [id, эмодзи, перевод, категория, сложность]. */
export type WordRow = [string, string, string, WordCategory, 1 | 2 | 3];

export interface EnglishWord {
  id: string;
  word: string;
  translationRu: string;
  type: WordType;
  category: WordCategory;
  /** Текущее изображение слова. Заменяется файлом, когда он появится. */
  emoji: string;
  /**
   * Путь к локальной картинке (`/english/images/apple.webp`). Пока null —
   * рендерер показывает emoji. Никаких внешних CDN.
   */
  image: string | null;
  pronunciation: string;
  difficulty: 1 | 2 | 3;
}

/** Три типа заданий первой версии. Печатать ребёнку не нужно нигде. */
export type QuizMode = 'image-to-word' | 'word-to-image' | 'audio-to-image';

export interface EnglishQuestion {
  mode: QuizMode;
  wordId: string;
  /** Варианты ответа — id слов, уже перемешанные. */
  options: string[];
}

/** Карточка повторения одного слова: общий SRS-движок платформы. */
export interface WordCard extends SrsState {
  wordId: string;
}

export interface EnglishProgress {
  /** wordId → карточка повторения. Только для слов, которые уже встречались. */
  cards: Record<string, WordCard>;
  /** wordId → { перепутанное слово: сколько раз }. */
  confusions: Record<string, Record<string, number>>;
}

export interface EnglishAnswerRecord {
  wordId: string;
  chosenId: string;
  mode: QuizMode;
  isCorrect: boolean;
  responseTimeMs: number;
}

export interface WordMastery {
  percent: number;
  level: 0 | 1 | 2 | 3 | 4 | 5;
  label: string;
  color: string;
}
