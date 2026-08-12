/**
 * Конфиг соревновательной системы. Все веса и пороги — здесь, чтобы менять
 * баланс без переписывания логики.
 *
 * Три независимые величины:
 *  - Skill Score — насколько хорошо человек ЗНАЕТ географию;
 *  - XP          — насколько активно он учится и играет;
 *  - ELO         — насколько успешно соревнуется (только дуэли и Battle Royale).
 */

/* ------------------------------ Skill Score ------------------------------ */

export const SKILL_SCORE = {
  mastery: {
    /** Очков за 1% освоения одного микронавыка. */
    perPercent: 0.8,
    /** Множитель по редкости страны (tier 1..3): редкие страны ценнее. */
    tierMult: [1, 1.15, 1.3] as const,
  },
  accuracy: {
    max: 15000,
    /** Точность даёт максимум при таком объёме ответов. */
    fullVolume: 2000,
  },
  speed: {
    max: 8000,
    /** Средний ответ быстрее fastMs — максимум, медленнее slowMs — ноль. */
    fastMs: 1500,
    slowMs: 6000,
    fullVolume: 500,
  },
  retention: {
    max: 9000,
    /** Карточка считается «устойчивой» с этого интервала (дни). */
    matureDays: 21,
  },
  streak: {
    max: 4000,
    /** Серия, дающая максимум (нелинейно, показатель 0.7). */
    target: 500,
    exponent: 0.7,
  },
  difficulty: {
    max: 6000,
    /** Доля освоенных стран tier 3 (уровень навыка ≥ 3). */
    masteryLevel: 3,
  },
} as const;

export interface SkillScoreBreakdown {
  masteryScore: number;
  accuracyScore: number;
  speedScore: number;
  retentionScore: number;
  streakScore: number;
  difficultyScore: number;
  totalScore: number;
}

export const BREAKDOWN_LABELS: Record<keyof Omit<SkillScoreBreakdown, 'totalScore'>, string> = {
  masteryScore: 'Освоение навыков',
  accuracyScore: 'Точность',
  speedScore: 'Скорость',
  retentionScore: 'Устойчивость знаний',
  streakScore: 'Серии',
  difficultyScore: 'Сложность стран',
};

/* --------------------------------- Лиги ---------------------------------- */

export interface League {
  name: string;
  minElo: number;
  emoji: string;
}

/** Лиги считаются ТОЛЬКО от ELO (дуэли и Battle Royale). */
export const LEAGUES: League[] = [
  { name: 'Бронза', minElo: 0, emoji: '🥉' },
  { name: 'Серебро', minElo: 1200, emoji: '🥈' },
  { name: 'Золото', minElo: 1400, emoji: '🥇' },
  { name: 'Платина', minElo: 1600, emoji: '💠' },
  { name: 'Алмаз', minElo: 1800, emoji: '💎' },
  { name: 'Мастер', minElo: 2000, emoji: '👑' },
  { name: 'Грандмастер', minElo: 2200, emoji: '🏆' },
];

export function leagueOf(elo: number | null): League | null {
  if (elo === null) return null;
  return [...LEAGUES].reverse().find((l) => elo >= l.minElo) ?? LEAGUES[0];
}

export const ELO = {
  initial: 1000,
  /** Первые N матчей — provisional: повышенный K, рейтинг «калибруется». */
  provisionalGames: 10,
  kProvisional: 64,
  kNormal: 24,
  /** Защита от фарма одного соперника: множитель за повтор в последних N матчах. */
  repeatOpponentWindow: 10,
  repeatOpponentMult: 0.5,
} as const;

/* ------------------------------ Очки в дуэли ------------------------------ */

export const DUEL_SCORING = {
  questions: 20,
  perQuestionMs: 15000,
  correct: 100,
  /** Бонус скорости: линейно от 0 (на границе времени) до max (мгновенно). Только за верный ответ. */
  speedMax: 50,
  /** Бонус сложности: tier страны 1..3 → 0/15/30. */
  difficultyByTier: [0, 15, 30] as const,
  /** Комбо: +5 за каждый верный подряд после второго, максимум +25. */
  comboStep: 5,
  comboMax: 25,
  wrong: 0,
} as const;

/* --------------------------- XP за Battle Royale -------------------------- */

/** XP по итоговому месту (для лобби 100; для меньших — пропорция по percentile). */
export const BR_XP = {
  byPlace: [
    { maxPlace: 1, xp: 1000 },
    { maxPlace: 2, xp: 800 },
    { maxPlace: 3, xp: 650 },
    { maxPlace: 10, xp: 500 },
    { maxPlace: 25, xp: 250 },
    { maxPlace: 50, xp: 150 },
  ],
  participation: 75,
  /** XP выдаётся только если игрок ответил минимум на столько вопросов. */
  minAnsweredShare: 0.5,
} as const;

/**
 * Рейтинг Battle Royale: pairwise-Elo — каждый участник «сыграл» против всех,
 * победив тех, кто ниже, и проиграв тем, кто выше; K нормируется на размер
 * лобби, чтобы одна игра на 100 человек не была равна 99 дуэлям.
 */
export const BR_RATING = {
  kBase: 32,
  /** Итоговое K = kBase / sqrt(участников − 1). */
  normalize: 'sqrt' as const,
};

/* ------------------------------- Прочее ----------------------------------- */

export const NICKNAME_RE = /^[a-zA-Zа-яА-ЯёЁ0-9_-]{3,20}$/;

/** Минимум ответов, чтобы страна попала в «самые сложные» (защита от шума). */
export const HARDEST_MIN_ANSWERS = 100;

export const LEADERBOARD_PAGE_SIZE = 25;
