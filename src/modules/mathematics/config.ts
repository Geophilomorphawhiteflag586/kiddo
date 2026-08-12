import type { AdditionLevel, MasteryStage, MathDifficulty } from './types.ts';

/**
 * Конфиг модуля математики. Ни одно из этих чисел не должно быть зашито в
 * компоненты: цели можно поменять со 100 на 500 без правки UI.
 */
export const MATH_CONFIG = {
  addition: {
    singleDigit: 100,
    doubleDigit: 1000,
    tripleDigit: 500,
  },
} as const;

/** Сколько задач в одной сессии. */
export const SESSION_LENGTH = 20;

/** Сколько последних ошибок храним для режима «Повторить ошибки». */
export const MISTAKES_KEPT = 50;

export const LEVELS: AdditionLevel[] = ['single_digit', 'double_digit', 'triple_digit'];

export interface LevelMeta {
  slug: string;
  title: string;
  example: string;
  /** Диапазон операндов, включительно. */
  min: number;
  max: number;
  goal: number;
  color: string;
}

export const LEVEL_META: Record<AdditionLevel, LevelMeta> = {
  single_digit: {
    slug: 'single',
    title: 'Однозначные',
    example: '7 + 2',
    min: 1,
    max: 9,
    goal: MATH_CONFIG.addition.singleDigit,
    color: '#22c55e',
  },
  double_digit: {
    slug: 'double',
    title: 'Двузначные',
    example: '47 + 28',
    min: 10,
    max: 99,
    goal: MATH_CONFIG.addition.doubleDigit,
    color: '#38bdf8',
  },
  triple_digit: {
    slug: 'triple',
    title: 'Трёхзначные',
    example: '234 + 157',
    min: 100,
    max: 999,
    goal: MATH_CONFIG.addition.tripleDigit,
    color: '#a855f7',
  },
};

export const LEVEL_BY_SLUG: ReadonlyMap<string, AdditionLevel> = new Map(
  LEVELS.map((level) => [LEVEL_META[level].slug, level]),
);

/**
 * Доли сложностей в зависимости от освоения уровня. Новичку — почти только
 * лёгкие примеры, освоившему — примеры с несколькими переносами.
 */
export const DIFFICULTY_MIX: Array<{
  upToMastery: number;
  weights: Record<MathDifficulty, number>;
}> = [
  { upToMastery: 30, weights: { easy: 0.7, medium: 0.25, hard: 0.05 } },
  { upToMastery: 60, weights: { easy: 0.45, medium: 0.4, hard: 0.15 } },
  { upToMastery: 85, weights: { easy: 0.25, medium: 0.45, hard: 0.3 } },
  { upToMastery: 101, weights: { easy: 0.15, medium: 0.4, hard: 0.45 } },
];

/** Веса формулы освоения: важна не только точность, но и объём со скоростью. */
export const MASTERY_WEIGHTS = { accuracy: 0.6, coverage: 0.25, speed: 0.15 } as const;

/** Границы «быстро/медленно» для оценки скорости, мс. */
export const SPEED_MS = { fast: 2000, slow: 9000 } as const;

export const MASTERY_STAGES: Array<{
  stage: MasteryStage;
  minPercent: number;
  label: string;
  color: string;
}> = [
  { stage: 'learning', minPercent: 0, label: 'Изучение', color: '#f97316' },
  { stage: 'practicing', minPercent: 25, label: 'Практика', color: '#eab308' },
  { stage: 'familiar', minPercent: 55, label: 'Уверенно', color: '#38bdf8' },
  { stage: 'mastered', minPercent: 85, label: 'Освоено', color: '#22c55e' },
];

/** XP за верный пример: база + бонус за скорость, умноженные на вес уровня. */
export const MATH_XP = {
  base: 5,
  fastBonus: 3,
  fastMs: 3000,
  levelMultiplier: { single_digit: 1, double_digit: 1.5, triple_digit: 2 } as Record<
    AdditionLevel,
    number
  >,
} as const;

/** Ответ быстрее этого порога помечается сервером как подозрительный. */
export const SUSPICIOUS_MS = 150;
