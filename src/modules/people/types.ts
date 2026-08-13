/** Категория, по которой можно фильтровать обучение. */
export type PersonCategory =
  | 'history'
  | 'alash'
  | 'literature'
  | 'science'
  | 'music'
  | 'art'
  | 'sport'
  | 'space';

/**
 * Чем является изображение.
 *
 * `photo` — настоящая фотография. `depiction` — портрет или памятник: у ханов
 * и жырау фотографий не существует, их лицо неизвестно, и подписывать такое
 * фотографией нельзя. В карточке это оговаривается прямо.
 */
export type ImageKind = 'photo' | 'depiction';

export interface Person {
  id: string;
  nameRu: string;
  nameKk: string | null;
  /** Кем является: «Певица», «Геолог», «Хан». */
  role: string;
  /** Одна строка о человеке — из Wikidata, не сочинённая. */
  shortDescription: string | null;
  category: PersonCategory;
  birthYear: number | null;
  deathYear: number | null;
  imageKind: ImageKind;
  /** 1–3 по числу языковых разделов Википедии: измеримый признак, не оценка. */
  famousLevel: 1 | 2 | 3;
  wikidataId: string;
}

/**
 * Четыре независимых навыка. Узнать лицо и знать, чем человек занимался, —
 * разные умения, и держать их одним числом значит потерять смысл.
 */
export type PeopleSkill = 'photoToName' | 'nameToPhoto' | 'photoToRole' | 'nameToRole';

export type PeopleQuizMode = 'photo-to-name' | 'name-to-photo' | 'photo-to-role' | 'name-to-role';

export interface PeopleQuestion {
  mode: PeopleQuizMode;
  skill: PeopleSkill;
  personId: string;
  /** Идентификаторы персон-вариантов; для «роли» — тексты ролей. */
  options: string[];
}

import type { SrsState } from '../../lib/srs.ts';

export interface PersonCard extends SrsState {
  personId: string;
  skill: PeopleSkill;
}

export interface PeopleProgress {
  /** Ключ — `${personId}:${skill}`. */
  cards: Record<string, PersonCard>;
  /** Кого ребёнок уже видел на экране знакомства. */
  seen: string[];
  /** Кого с кем путает: Бөкейхан ↔ Байтұрсынұлы. */
  confusions: Record<string, Record<string, number>>;
}

export interface PeopleAnswerRecord {
  personId: string;
  skill: PeopleSkill;
  mode: PeopleQuizMode;
  /** Что выбрали: id персоны либо текст роли. */
  chosen: string;
  isCorrect: boolean;
  responseTimeMs: number;
}
