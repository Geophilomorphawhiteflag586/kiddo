import type { QuizMode, WordCategory } from './types.ts';

/** Вопросов в стандартной сессии. */
export const SESSION_LENGTH = 10;

/** Вариантов ответа на экране. Четыре крупные карточки — не больше. */
export const OPTION_COUNT = 4;

/**
 * Состав сессии — ориентир, а не жёсткое правило: если просроченных повторений
 * меньше, недобор заполняется новыми словами и наоборот.
 */
export const SESSION_MIX = {
  mistakes: 2,
  review: 3,
  newWords: 5,
} as const;

/**
 * Режимы по мере освоения слова: сначала узнавание картинки, потом обратная
 * связь и только затем — только на слух.
 */
export const MODE_UNLOCK: Array<{ minPercent: number; modes: QuizMode[] }> = [
  { minPercent: 0, modes: ['image-to-word'] },
  { minPercent: 30, modes: ['image-to-word', 'word-to-image'] },
  { minPercent: 55, modes: ['image-to-word', 'word-to-image', 'audio-to-image'] },
];

/** Пороги интервала (в днях) для уровней освоения слова 2–5. */
export const LEVEL_INTERVALS = [0, 0, 0, 1, 7, 21, 45];

export const MASTERY_LEVELS = [
  { label: 'Новое', color: '#39404f' },
  { label: 'Знакомство', color: '#eab308' },
  { label: 'Учим', color: '#f97316' },
  { label: 'Узнаёт', color: '#38bdf8' },
  { label: 'Уверенно', color: '#818cf8' },
  { label: 'Выучено', color: '#22c55e' },
] as const;

/** Слово считается выученным с этого уровня — им меряется «87 / 400». */
export const LEARNED_LEVEL = 3;

export const ENGLISH_XP = {
  correct: 10,
  fastBonus: 5,
  fastMs: 3500,
} as const;

/**
 * Автоперехода к следующему вопросу нет: разбор — самый ценный момент урока.
 * Здесь лишь пауза перед тем, как после ошибки прозвучит правильное слово,
 * чтобы оно не наложилось на озвучку выбранного варианта.
 */
export const ECHO_DELAY = 900;

export const CATEGORY_LABELS: Record<WordCategory, string> = {
  animals: 'Животные',
  food: 'Еда',
  drinks: 'Напитки',
  people: 'Люди',
  body: 'Тело',
  home: 'Дом',
  clothes: 'Одежда',
  transport: 'Транспорт',
  nature: 'Природа',
  weather: 'Погода',
  places: 'Места',
  school: 'Школа',
  toys: 'Игрушки',
  objects: 'Предметы',
  colors: 'Цвета',
  numbers: 'Числа',
  actions: 'Действия',
};

export const MODE_LABELS: Record<QuizMode, string> = {
  'image-to-word': 'Что это?',
  'word-to-image': 'Найди картинку',
  'audio-to-image': 'Послушай и найди',
};

/** Язык произношения. Позже заменяется на записанные аудиофайлы. */
export const SPEECH_LANG = 'en-US';
