import type { AnatomySkill, AnatomySystem, QuizMode, RegionId } from './types.ts';

export const SESSION_LENGTH = 10;
export const OPTION_COUNT = 4;

/** Сколько новых структур показать перед первым квизом. */
export const LEARN_BATCH = 3;

export const ANATOMY_XP = { correct: 10, fastBonus: 5, fastMs: 4000 } as const;

/** Каждый режим тренирует ровно один навык. */
export const MODE_SKILL: Record<QuizMode, AnatomySkill> = {
  'what-is-this': 'recognition',
  'find-image': 'name',
  'find-on-body': 'location',
};

export const MODE_LABELS: Record<QuizMode, string> = {
  'what-is-this': 'Что это?',
  'find-image': 'Найди изображение',
  'find-on-body': 'Покажи на теле',
};

export const SKILL_META: Record<AnatomySkill, { label: string; short: string; color: string }> = {
  recognition: { label: 'Узнавание', short: 'Узнаёт', color: '#38bdf8' },
  name: { label: 'Название', short: 'Название', color: '#22c55e' },
  location: { label: 'Расположение', short: 'Где', color: '#f59e0b' },
};

export const SKILLS: AnatomySkill[] = ['recognition', 'name', 'location'];

/**
 * Режимы открываются по мере освоения структуры: сначала узнать, потом связать
 * название с изображением, и только затем показать место на теле.
 */
export const MODE_UNLOCK: Array<{ minPercent: number; modes: QuizMode[] }> = [
  { minPercent: 0, modes: ['what-is-this'] },
  { minPercent: 30, modes: ['what-is-this', 'find-image'] },
  { minPercent: 50, modes: ['what-is-this', 'find-image', 'find-on-body'] },
];

export interface SystemMeta {
  id: AnatomySystem;
  titleRu: string;
  subtitleRu: string;
  regions: RegionId[];
  /** Доля освоения предыдущей системы, после которой открывается эта. */
  unlockAfter: AnatomySystem | null;
  color: string;
}

/**
 * Путь обучения: органы → кости → мышцы. Новые системы (нервная, кровеносная,
 * органы чувств) добавляются сюда же — порядок задаётся полем unlockAfter.
 */
export const SYSTEMS: SystemMeta[] = [
  {
    id: 'organs',
    titleRu: 'Органы',
    subtitleRu: 'Главные органы и органы пищеварения',
    regions: ['organs_main', 'organs_digestive'],
    unlockAfter: null,
    color: '#f43f5e',
  },
  {
    id: 'bones',
    titleRu: 'Кости',
    subtitleRu: 'Скелет по частям: череп, руки, ноги, туловище',
    regions: ['skull', 'arm', 'leg', 'torso_bones'],
    unlockAfter: 'organs',
    color: '#e2e8f0',
  },
  {
    id: 'muscles',
    titleRu: 'Мышцы',
    subtitleRu: 'Основные мышцы тела',
    regions: ['muscles'],
    unlockAfter: 'bones',
    color: '#f97316',
  },
];

/** Доля освоенных структур системы, открывающая следующую. */
export const UNLOCK_RATIO = 0.6;

/** Полный скелет открывается, когда изучены все отдельные регионы костей. */
export const SKELETON_UNLOCK_RATIO = 0.75;

export const LEVEL_INTERVALS = [0, 0, 0, 1, 7, 21, 45];

export const MASTERY_LEVELS = [
  { label: 'Не изучено', color: '#39404f' },
  { label: 'Знакомство', color: '#eab308' },
  { label: 'Учим', color: '#f97316' },
  { label: 'Узнаёт', color: '#38bdf8' },
  { label: 'Уверенно', color: '#818cf8' },
  { label: 'Освоено', color: '#22c55e' },
] as const;

/** Структура считается изученной с этого уровня. */
export const LEARNED_LEVEL = 3;

/** Пауза перед автоподсказкой правильного ответа в режиме поиска, мс. */
export const REVEAL_DELAY = 600;
