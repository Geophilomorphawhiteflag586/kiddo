import { PEOPLE } from './data/people.ts';
import { CATEGORY_ORDER } from './config.ts';
import type { Person, PersonCategory } from './types.ts';

export { PEOPLE };

export const PERSON_BY_ID: ReadonlyMap<string, Person> = new Map(
  PEOPLE.map((person) => [person.id, person]),
);

export function getPerson(id: string): Person | undefined {
  return PERSON_BY_ID.get(id);
}

export const TOTAL_PEOPLE = PEOPLE.length;

export function peopleOfCategory(category: PersonCategory): Person[] {
  return PEOPLE.filter((person) => person.category === category);
}

/** Все встречающиеся роли — из них собираются варианты в вопросах о роли. */
export const ALL_ROLES: string[] = [...new Set(PEOPLE.map((person) => person.role))].sort();

/**
 * Порядок знакомства: сначала самые известные.
 *
 * Известность взята из числа языковых разделов Википедии — измеримый признак,
 * а не наш вкус. Внутри одной ступени порядок задан категорией, чтобы первые
 * пять человек не оказались все из спорта.
 */
export const LEARNING_ORDER: Person[] = [...PEOPLE].sort((a, b) => {
  if (b.famousLevel !== a.famousLevel) return b.famousLevel - a.famousLevel;
  const byCategory =
    CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
  return byCategory !== 0 ? byCategory : a.nameRu.localeCompare(b.nameRu, 'ru');
});
