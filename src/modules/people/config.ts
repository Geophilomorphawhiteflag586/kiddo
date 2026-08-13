import type { PeopleQuizMode, PeopleSkill, PersonCategory } from './types.ts';

export const SESSION_LENGTH = 10;
export const OPTION_COUNT = 4;

/**
 * Сколько новых лиц показывать за сессию.
 *
 * В первый раз — пять, как знакомство с нуля. Дальше только два: пять новых
 * плюс пять вопросов о них занимают всю сессию целиком, и на повторение уже
 * выученных не остаётся места — режимы «имя → фото» и «чем известен» тогда
 * не открываются никогда.
 */
export const LEARN_BATCH_FIRST = 5;
export const LEARN_BATCH = 2;

export const PEOPLE_XP = { correct: 10, fastBonus: 5, fastMs: 4000 } as const;

/** Каждый режим тренирует ровно один навык. */
export const MODE_SKILL: Record<PeopleQuizMode, PeopleSkill> = {
  'photo-to-name': 'photoToName',
  'name-to-photo': 'nameToPhoto',
  'photo-to-role': 'photoToRole',
  'name-to-role': 'nameToRole',
};

export const MODE_LABELS: Record<PeopleQuizMode, string> = {
  'photo-to-name': 'Кто это?',
  'name-to-photo': 'Найди человека',
  'photo-to-role': 'Чем известен?',
  'name-to-role': 'Кем является?',
};

export const SKILLS: PeopleSkill[] = ['photoToName', 'nameToPhoto', 'photoToRole', 'nameToRole'];

export const SKILL_META: Record<PeopleSkill, { label: string; short: string; color: string }> = {
  photoToName: { label: 'Фото → имя', short: 'Узнаёт', color: '#38bdf8' },
  nameToPhoto: { label: 'Имя → фото', short: 'Находит', color: '#22c55e' },
  photoToRole: { label: 'Фото → роль', short: 'Чем известен', color: '#f59e0b' },
  nameToRole: { label: 'Имя → роль', short: 'Кем был', color: '#e879f9' },
};

/**
 * Режимы открываются по мере узнавания лица: пока ребёнок не отличает
 * человека по фотографии, спрашивать «чем он известен» рано.
 *
 * Порог считается по навыку photoToName, а не по среднему четырёх: среднее
 * не вырастет, пока остальные режимы закрыты.
 */
export const MODE_UNLOCK: Array<{ minPercent: number; modes: PeopleQuizMode[] }> = [
  { minPercent: 0, modes: ['photo-to-name'] },
  { minPercent: 25, modes: ['photo-to-name', 'name-to-photo'] },
  { minPercent: 45, modes: ['photo-to-name', 'name-to-photo', 'photo-to-role'] },
  {
    minPercent: 60,
    modes: ['photo-to-name', 'name-to-photo', 'photo-to-role', 'name-to-role'],
  },
];

export const CATEGORY_META: Record<PersonCategory, { titleRu: string; color: string }> = {
  history: { titleRu: 'История', color: '#f59e0b' },
  alash: { titleRu: 'Алаш', color: '#38bdf8' },
  literature: { titleRu: 'Литература', color: '#a78bfa' },
  science: { titleRu: 'Наука', color: '#22c55e' },
  music: { titleRu: 'Музыка', color: '#f43f5e' },
  art: { titleRu: 'Искусство и кино', color: '#e879f9' },
  sport: { titleRu: 'Спорт', color: '#06b6d4' },
  space: { titleRu: 'Космос и авиация', color: '#818cf8' },
};

export const CATEGORY_ORDER: PersonCategory[] = [
  'history',
  'alash',
  'literature',
  'science',
  'music',
  'art',
  'sport',
  'space',
];

export const LEVEL_INTERVALS = [0, 0, 0, 1, 7, 21, 45];

export const MASTERY_LEVELS = [
  { label: 'Не знаком', color: '#39404f' },
  { label: 'Видел', color: '#eab308' },
  { label: 'Узнаём', color: '#f97316' },
  { label: 'Узнаёт', color: '#38bdf8' },
  { label: 'Уверенно', color: '#818cf8' },
  { label: 'Освоено', color: '#22c55e' },
] as const;

/** Человек считается изученным с этого уровня. */
export const LEARNED_LEVEL = 3;
