import type { CharCategory, CharSkill, ChineseQuizMode } from './types.ts';

export const SESSION_LENGTH = 10;
export const OPTION_COUNT = 4;

/** Ориентир состава сессии: новое + повторение + личные слабые места. */
export const SESSION_MIX = { mistakes: 3, review: 5, newChars: 2 } as const;

/**
 * Постепенное открытие базы. Пока не освоена заметная часть текущего набора,
 * новые иероглифы не выдаются — иначе ребёнок утонет в 700 знаках.
 */
export const UNLOCK_TIERS = [20, 50, 100, 200, 350, 500, 698];
/** Доля выученных знаков текущего набора, после которой открывается следующий. */
export const UNLOCK_RATIO = 0.7;

/** Каждый режим тренирует ровно один навык. */
export const MODE_SKILL: Record<ChineseQuizMode, CharSkill> = {
  'character-to-pinyin': 'pronunciationRecognition',
  'character-to-meaning': 'meaningRecognition',
  'pinyin-to-character': 'characterRecognition',
  'audio-to-character': 'listeningRecognition',
  'audio-to-pinyin': 'listeningRecognition',
};

export const MODE_LABELS: Record<ChineseQuizMode, string> = {
  'character-to-pinyin': 'Как это читается?',
  'character-to-meaning': 'Что это значит?',
  'pinyin-to-character': 'Найди иероглиф',
  'audio-to-character': 'Послушай и найди иероглиф',
  'audio-to-pinyin': 'Послушай и выбери пиньинь',
};

/**
 * Режимы открываются по мере освоения знака: сначала чтение и значение,
 * затем обратное задание, и лишь потом — только на слух.
 */
export const MODE_UNLOCK: Array<{ minPercent: number; modes: ChineseQuizMode[] }> = [
  { minPercent: 0, modes: ['character-to-pinyin', 'character-to-meaning'] },
  {
    minPercent: 30,
    modes: ['character-to-pinyin', 'character-to-meaning', 'pinyin-to-character'],
  },
  {
    minPercent: 55,
    modes: [
      'character-to-pinyin',
      'character-to-meaning',
      'pinyin-to-character',
      'audio-to-character',
      'audio-to-pinyin',
    ],
  },
];

export const SKILL_META: Record<CharSkill, { label: string; short: string; color: string }> = {
  characterRecognition: { label: 'Узнавание иероглифа', short: 'Иероглиф', color: '#38bdf8' },
  pronunciationRecognition: { label: 'Чтение (пиньинь)', short: 'Пиньинь', color: '#f59e0b' },
  meaningRecognition: { label: 'Значение', short: 'Значение', color: '#22c55e' },
  listeningRecognition: { label: 'На слух', short: 'Слух', color: '#a855f7' },
};

export const SKILLS: CharSkill[] = [
  'characterRecognition',
  'pronunciationRecognition',
  'meaningRecognition',
  'listeningRecognition',
];

/** Пороги интервала (в днях) для уровней освоения 2–5. */
export const LEVEL_INTERVALS = [0, 0, 0, 1, 7, 21, 45];

export const MASTERY_LEVELS = [
  { label: 'Новый', color: '#39404f' },
  { label: 'Знакомство', color: '#eab308' },
  { label: 'Учим', color: '#f97316' },
  { label: 'Узнаёт', color: '#38bdf8' },
  { label: 'Уверенно', color: '#818cf8' },
  { label: 'Освоен', color: '#22c55e' },
] as const;

/** Иероглиф считается выученным с этого уровня — им меряется «87 / 698». */
export const LEARNED_LEVEL = 3;

export const CHINESE_XP = { correct: 12, fastBonus: 6, fastMs: 4000 } as const;

/**
 * Автоперехода к следующему вопросу нет: разбор — самый ценный момент урока,
 * и обрывать его таймером нельзя. Дальше листает только сам ученик.
 * Здесь лишь пауза перед тем, как после ошибки прозвучит правильный ответ,
 * чтобы он не накладывался на озвучку выбранного варианта.
 */
export const ECHO_DELAY = 1100;

/** Язык произношения. Позже заменяется записями носителей. */
export const SPEECH_LANG = 'zh-CN';

export const CATEGORY_LABELS: Record<CharCategory, string> = {
  numbers: 'Числа',
  people: 'Люди',
  family: 'Семья',
  nature: 'Природа',
  body: 'Тело',
  qualities: 'Качества',
  colors: 'Цвета',
  position: 'Положение',
  time: 'Время',
  actions: 'Действия',
  grammar: 'Служебные',
  food: 'Еда',
  animals: 'Животные',
  objects: 'Предметы',
  places: 'Места',
  transport: 'Транспорт',
  school: 'Учёба',
  society: 'Общество',
  culture: 'Культура',
  abstract: 'Абстрактные',
};
