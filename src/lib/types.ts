export type ContinentId =
  | 'europe'
  | 'asia'
  | 'africa'
  | 'north-america'
  | 'south-america'
  | 'oceania';

export interface Country {
  /** ISO 3166-1 alpha-2, основной ключ во всём приложении. */
  code: string;
  code3: string;
  name: string;
  nameEn: string;
  capital: string;
  capitalEn: string;
  continent: ContinentId;
  subregion: string;
  lat: number;
  lng: number;
  /** км² */
  area: number;
  landlocked: boolean;
  /** соседи в alpha-3 */
  neighbours: string[];
  languages: string[];
  currency: string;
  emoji: string;
  /** 1 — крупные и общеизвестные, 3 — самые редкие. Задаёт порядок обучения. */
  tier: 1 | 2 | 3;
}

/**
 * Отдельный навык знания страны. Прогресс по каждому хранится независимо:
 * можно на 100% знать флаг Казахстана и на 20% узнавать его контур.
 * Новые навыки (языки, валюты, сборка флага…) добавляются в этот union
 * и в SKILL_META — остальная система подхватит их автоматически.
 */
export type CountrySkill =
  | 'flagToCountry'
  | 'countryToFlag'
  | 'countryToCapital'
  | 'capitalToCountry'
  | 'countryLocation'
  | 'outlineToCountry';

/** Пара «страна × навык» — атом, из которых собирается любая сессия. */
export interface LearningCard {
  countryCode: string;
  skill: CountrySkill;
}

/** Карточка интервального повторения (SM-2) для пары «страна × навык». */
export interface ReviewCard {
  countryCode: string;
  skill: CountrySkill;
  /** Фактор лёгкости SM-2, минимум 1.3. */
  ease: number;
  /** Текущий интервал в днях. */
  interval: number;
  /** Сколько раз подряд отвечено верно. */
  streak: number;
  repetitions: number;
  lapses: number;
  /** Unix ms. */
  due: number;
  lastReviewed: number;
  correct: number;
  wrong: number;
  /** Среднее время ответа, мс. null — ещё не отвечал. */
  avgMs: number | null;
}

export interface CountryProgress {
  countryCode: string;
  /**
   * С чем пользователь путает эту страну — отдельно по каждому навыку:
   * флаги Румынии и Чада можно путать, а их контуры — нет.
   */
  confusedWith: Partial<Record<CountrySkill, Record<string, number>>>;
  discoveredAt: number | null;
}

export type AgeMode = 'kid' | 'school' | 'adult';

/** Привязка локального профиля к серверному аккаунту (соревнования). */
export interface ServerAccount {
  userId: string;
  secret: string;
  nickname: string;
  countryCode: string | null;
}

/** Локальный профиль. Поле account связывает его с серверным аккаунтом. */
export interface UserProfile {
  id: string;
  name: string;
  createdAt: string;
  lastActiveAt: string;
  ageMode: AgeMode;
  guest: boolean;
  account?: ServerAccount;
}

export interface AnswerOutcome {
  correct: boolean;
  countryCode: string;
  skill: CountrySkill;
  /** Что выбрал пользователь, если ошибся. */
  chosenCode?: string;
  /** Мс на ответ — быстрый верный ответ повышает оценку в SM-2. */
  elapsedMs: number;
  /** Ответ с подсказкой не может получить высшую оценку. */
  hintUsed?: boolean;
}
