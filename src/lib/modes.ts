import type { CountrySkill } from './types';

export interface ModeConfig {
  slug: string;
  /** Навыки, которые тренирует режим. Вопросы чередуются между ними. */
  skills: CountrySkill[];
  title: string;
  emoji: string;
  description: string;
  gradient: string;
  /** Служебные режимы (тренировка страны) не показываются в списках. */
  hidden?: boolean;
}

export const MODES: ModeConfig[] = [
  {
    slug: 'flag',
    skills: ['flagToCountry'],
    title: 'Угадай флаг',
    emoji: '🏳️',
    description: 'Показываем флаг — выбери страну',
    gradient: 'from-sky-500 to-indigo-600',
  },
  {
    slug: 'reverse',
    skills: ['countryToFlag'],
    title: 'Соедини страну и флаг',
    emoji: '🔗',
    description: 'Показываем страну — выбери её флаг',
    gradient: 'from-fuchsia-500 to-purple-600',
  },
  {
    slug: 'globe',
    skills: ['countryLocation'],
    title: 'Найди на глобусе',
    emoji: '🌐',
    description: 'Покрути планету и найди страну',
    gradient: 'from-emerald-500 to-teal-600',
  },
  {
    slug: 'capital',
    skills: ['countryToCapital', 'capitalToCountry'],
    title: 'Столицы мира',
    emoji: '🏛️',
    description: 'Столицы в обе стороны',
    gradient: 'from-amber-500 to-orange-600',
  },
  {
    slug: 'outline',
    skills: ['outlineToCountry'],
    title: 'Угадай по контуру',
    emoji: '🗺️',
    description: 'Только форма страны — ничего больше',
    gradient: 'from-rose-500 to-red-600',
  },
  {
    slug: 'review',
    skills: [
      'flagToCountry',
      'countryToFlag',
      'countryToCapital',
      'capitalToCountry',
      'countryLocation',
      'outlineToCountry',
    ],
    title: 'Повторение',
    emoji: '🔁',
    description: 'Карточки, которые пора повторить',
    gradient: 'from-emerald-500 to-teal-600',
    hidden: true,
  },
  {
    slug: 'train',
    skills: [
      'flagToCountry',
      'countryToFlag',
      'countryToCapital',
      'capitalToCountry',
      'countryLocation',
      'outlineToCountry',
    ],
    title: 'Тренировка страны',
    emoji: '🎯',
    description: 'Все навыки одной страны',
    gradient: 'from-violet-500 to-indigo-600',
    hidden: true,
  },
];

export const MODE_BY_SLUG: ReadonlyMap<string, ModeConfig> = new Map(
  MODES.map((m) => [m.slug, m]),
);

/** Формулировка задания для конкретного навыка. */
export const SKILL_PROMPTS: Record<CountrySkill, string> = {
  flagToCountry: 'Чей это флаг?',
  countryToFlag: 'Найди флаг страны',
  countryToCapital: 'Какая столица у этой страны?',
  capitalToCountry: 'Столица какой это страны?',
  countryLocation: 'Найди на глобусе',
  outlineToCountry: 'Какая страна имеет такой контур?',
};
