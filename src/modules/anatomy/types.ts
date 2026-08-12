import type { SrsState } from '../../lib/srs.ts';

/** Системы организма. Список открыт: нервная, кровеносная и прочие добавляются сюда. */
export type AnatomySystem = 'organs' | 'bones' | 'muscles';

/**
 * Анатомический регион — то, что показывается на экране целиком.
 * Обучение идёт по регионам: череп, рука, нога, а не «весь скелет сразу».
 */
export type RegionId =
  | 'organs_main'
  | 'organs_digestive'
  | 'skull'
  | 'arm'
  | 'leg'
  | 'torso_bones'
  | 'skeleton'
  | 'muscles';

/**
 * Три независимых навыка на структуру. Знать название и уметь показать, где
 * это находится, — разные умения, и система должна их различать.
 */
export type AnatomySkill = 'recognition' | 'name' | 'location';

export interface AnatomyStructure {
  id: string;
  /** Название по-русски — основной язык модуля. */
  nameRu: string;
  system: AnatomySystem;
  /** Регион, в котором структура изучается и ищется. */
  region: RegionId;
  /** Короткая подсказка при изучении. Одна строка, без медицинских деталей. */
  factRu: string;
  /** Порядок изучения внутри региона. */
  order: number;
}

export type QuizMode = 'what-is-this' | 'find-image' | 'find-on-body';

export interface AnatomyQuestion {
  mode: QuizMode;
  skill: AnatomySkill;
  structureId: string;
  /** Для режимов с выбором: id структур-вариантов. Для поиска на теле пуст. */
  options: string[];
  /** Регион, на котором задаётся вопрос. */
  region: RegionId;
}

export interface StructureCard extends SrsState {
  structureId: string;
  skill: AnatomySkill;
}

export interface AnatomyProgress {
  /** Ключ — `${structureId}:${skill}`. */
  cards: Record<string, StructureCard>;
  /** Структуры, которые ребёнок уже посмотрел на экране изучения. */
  seen: string[];
  /** Что с чем путает: теменная ↔ височная. */
  confusions: Record<string, Record<string, number>>;
}

export interface AnatomyAnswerRecord {
  structureId: string;
  skill: AnatomySkill;
  mode: QuizMode;
  chosenId: string;
  isCorrect: boolean;
  responseTimeMs: number;
}

export interface StructureMastery {
  percent: number;
  level: 0 | 1 | 2 | 3 | 4 | 5;
  label: string;
  color: string;
  bySkill: Record<AnatomySkill, number>;
}
