import type { CountrySkill, ReviewCard } from './types';

export const SKILLS: CountrySkill[] = [
  'flagToCountry',
  'countryToFlag',
  'countryToCapital',
  'capitalToCountry',
  'countryLocation',
  'outlineToCountry',
];

export interface SkillMeta {
  label: string;
  /** Короткая подпись для узких мест интерфейса. */
  short: string;
  emoji: string;
  /** Цвет иконки навыка в интерфейсе. */
  color: string;
  /** Вклад навыка в общее освоение страны. Сумма по всем навыкам = 1. */
  weight: number;
}

/** Веса вынесены в конфиг сознательно — их можно крутить без правки логики. */
export const SKILL_META: Record<CountrySkill, SkillMeta> = {
  flagToCountry: { label: 'Флаг → страна', short: 'Флаг → страна', emoji: '🏳️', color: '#3b82f6', weight: 0.2 },
  countryToFlag: { label: 'Страна → флаг', short: 'Страна → флаг', emoji: '🔗', color: '#8b5cf6', weight: 0.15 },
  countryToCapital: { label: 'Столица', short: 'Столица', emoji: '🏛️', color: '#f59e0b', weight: 0.2 },
  capitalToCountry: { label: 'Столица → страна', short: 'Столица → страна', emoji: '🏙️', color: '#14b8a6', weight: 0.1 },
  countryLocation: { label: 'На карте', short: 'На карте', emoji: '🌐', color: '#22c55e', weight: 0.2 },
  outlineToCountry: { label: 'По контуру', short: 'По контуру', emoji: '🗺️', color: '#ec4899', weight: 0.15 },
};

export const cardKey = (code: string, skill: CountrySkill) => `${code}:${skill}`;

/** Шесть уровней освоения навыка. Индекс массива = численный уровень. */
export const LEVELS = [
  { label: 'Не изучено', color: '#39404f' },
  { label: 'Знакомство', color: '#eab308' },
  { label: 'Изучается', color: '#f97316' },
  { label: 'Запоминается', color: '#38bdf8' },
  { label: 'Уверенно', color: '#818cf8' },
  { label: 'Освоено', color: '#22c55e' },
] as const;

export type SkillLevel = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Пороги интервала (в днях) для уровней 2–5. Уровень 1 — карточка заведена,
 * но верных ответов подряд нет. Ceiling уровня 5 (45) нужен только skillPercent.
 */
const LEVEL_INTERVALS = [0, 0, 0, 1, 7, 21, 45];

export function skillLevel(card: ReviewCard | undefined): SkillLevel {
  if (!card) return 0;
  if (card.repetitions === 0) return 1;
  for (let level = 5; level >= 2; level--) {
    if (card.interval >= LEVEL_INTERVALS[level]) return level as SkillLevel;
  }
  return 2;
}

/**
 * Освоение навыка в процентах: уровень задаёт полосу по 20%, положение внутри
 * полосы — прогресс интервала к следующему порогу. Так проценты растут плавно,
 * а не скачками.
 */
export function skillPercent(card: ReviewCard | undefined): number {
  const level = skillLevel(card);
  if (level === 0) return 0;
  if (level === 5 || !card) return level * 20;
  const floor = LEVEL_INTERVALS[level];
  const ceil = LEVEL_INTERVALS[level + 1];
  const within = Math.max(0, Math.min(1, (card.interval - floor) / (ceil - floor)));
  return Math.round(level * 20 + within * 20);
}

/**
 * Общее освоение страны — взвешенная сумма навыков. Для стран без контура
 * (микрогосударства вне Natural Earth 110m) вес контура перераспределяется
 * на остальные навыки, чтобы 100% оставались достижимыми.
 */
export function countryMastery(
  cards: Partial<Record<CountrySkill, ReviewCard>>,
  hasOutline = true,
): number {
  let total = 0;
  let weightSum = 0;
  for (const skill of SKILLS) {
    if (!hasOutline && skill === 'outlineToCountry') continue;
    const weight = SKILL_META[skill].weight;
    weightSum += weight;
    total += weight * skillPercent(cards[skill]);
  }
  return weightSum === 0 ? 0 : Math.round(total / weightSum);
}

/** Уровень страны в целом — для окраски глобуса в режиме «общий прогресс». */
export function countryLevel(
  cards: Partial<Record<CountrySkill, ReviewCard>>,
  hasOutline = true,
): SkillLevel {
  const practiced = SKILLS.filter((s) => cards[s]);
  if (practiced.length === 0) return 0;
  const percent = countryMastery(cards, hasOutline);
  const level = Math.min(5, Math.floor(percent / 20)) as SkillLevel;
  // «Освоено» целиком требует подтверждения минимум в двух навыках.
  if (level === 5 && practiced.length < 2) return 4;
  return level;
}
