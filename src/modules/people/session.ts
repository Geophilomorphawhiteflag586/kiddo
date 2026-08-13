/**
 * Подбор заданий «Известные люди»: сначала знакомство с новыми лицами, затем
 * адаптивный квиз — ошибки и путаница возвращаются чаще освоенного.
 */
import { isDue } from '../../lib/srs.ts';
import {
  LEARN_BATCH,
  LEARN_BATCH_FIRST,
  MODE_SKILL,
  MODE_UNLOCK,
  OPTION_COUNT,
  SESSION_LENGTH,
} from './config.ts';
import { cardKey, isLearned, skillPercent } from './mastery.ts';
import { ALL_ROLES, LEARNING_ORDER, PEOPLE, getPerson } from './people.ts';
import type { PeopleProgress, PeopleQuizMode, Person, PersonCategory } from './types.ts';

export type Rng = () => number;

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const byCount = (pairs: Record<string, number> | undefined): string[] =>
  Object.entries(pairs ?? {})
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

/**
 * Варианты-персоны. Сначала те, кого ребёнок уже путал с этим человеком,
 * затем земляки по категории: спутать двух деятелей Алаш куда полезнее, чем
 * поэта с боксёром.
 */
export function buildPersonOptions(
  target: Person,
  pool: readonly Person[],
  progress: PeopleProgress,
  count = OPTION_COUNT,
  rng: Rng = Math.random,
): string[] {
  const picked = new Set<string>([target.id]);
  const inPool = new Set(pool.map((person) => person.id));
  const add = (ids: readonly string[]) => {
    for (const id of ids) {
      if (picked.size >= count) return;
      if (picked.has(id) || !inPool.has(id)) continue;
      picked.add(id);
    }
  };

  add(byCount(progress.confusions[target.id]));
  add(
    shuffle(
      pool.filter((p) => p.category === target.category && p.id !== target.id),
      rng,
    ).map((p) => p.id),
  );
  add(shuffle(pool, rng).map((p) => p.id));
  return shuffle([...picked], rng);
}

/** Варианты-роли: сначала роли соседей по категории, потом любые другие. */
export function buildRoleOptions(
  target: Person,
  pool: readonly Person[],
  count = OPTION_COUNT,
  rng: Rng = Math.random,
): string[] {
  const picked = new Set<string>([target.role]);
  const sameCategory = pool
    .filter((p) => p.category === target.category && p.role !== target.role)
    .map((p) => p.role);
  for (const role of shuffle([...new Set(sameCategory)], rng)) {
    if (picked.size >= count) break;
    picked.add(role);
  }
  for (const role of shuffle(ALL_ROLES, rng)) {
    if (picked.size >= count) break;
    picked.add(role);
  }
  return shuffle([...picked], rng);
}

export function modesFor(percent: number): PeopleQuizMode[] {
  let modes = MODE_UNLOCK[0].modes;
  for (const rule of MODE_UNLOCK) if (percent >= rule.minPercent) modes = rule.modes;
  return modes;
}

export interface PeopleStep {
  kind: 'learn' | 'quiz';
  personId: string;
  question?: {
    mode: PeopleQuizMode;
    skill: ReturnType<() => (typeof MODE_SKILL)[PeopleQuizMode]>;
    personId: string;
    options: string[];
  };
}

export interface PeopleSessionOptions {
  progress: PeopleProgress;
  /** Ограничение по категориям; пусто — вся база. */
  categories?: PersonCategory[];
  length?: number;
  now?: number;
  rng?: Rng;
  mistakesOnly?: boolean;
}

/**
 * Порядок вопросов: недавние ошибки → новые лица → просроченные повторения →
 * путаемые пары → добор неосвоенным.
 */
export function buildPeopleSession({
  progress,
  categories = [],
  length = SESSION_LENGTH,
  now = Date.now(),
  rng = Math.random,
  mistakesOnly = false,
}: PeopleSessionOptions): PeopleStep[] {
  const pool =
    categories.length > 0 ? PEOPLE.filter((p) => categories.includes(p.category)) : PEOPLE;
  const inPool = new Set(pool.map((p) => p.id));
  const steps: PeopleStep[] = [];
  const askedKeys = new Set<string>();

  const pushQuiz = (personId: string, mode: PeopleQuizMode) => {
    if (steps.length >= length) return;
    const skill = MODE_SKILL[mode];
    const key = cardKey(personId, skill);
    if (askedKeys.has(key)) return;
    const person = getPerson(personId);
    if (!person || !inPool.has(personId)) return;
    askedKeys.add(key);

    const isRoleQuestion = mode === 'photo-to-role' || mode === 'name-to-role';
    steps.push({
      kind: 'quiz',
      personId,
      question: {
        mode,
        skill,
        personId,
        options: isRoleQuestion
          ? buildRoleOptions(person, pool, OPTION_COUNT, rng)
          : buildPersonOptions(person, pool, progress, OPTION_COUNT, rng),
      },
    });
  };

  /**
   * Режим для человека: доступный по освоению, с уклоном в слабый навык.
   *
   * Порог считается по узнаванию лица, а не по среднему четырёх навыков:
   * среднее не вырастет, пока остальные режимы закрыты, — получался замкнутый
   * круг, и дальше «кто это?» ребёнок не проходил никогда.
   */
  const pickMode = (personId: string): PeopleQuizMode => {
    const modes = modesFor(skillPercent(progress.cards[cardKey(personId, 'photoToName')]));
    const weakest = modes.reduce((weak, mode) => {
      const current = progress.cards[cardKey(personId, MODE_SKILL[mode])];
      const best = progress.cards[cardKey(personId, MODE_SKILL[weak])];
      return (current?.interval ?? -1) < (best?.interval ?? -1) ? mode : weak;
    }, modes[0]);
    return rng() < 0.7 ? weakest : modes[Math.floor(rng() * modes.length)];
  };

  const cards = Object.values(progress.cards).filter((card) => inPool.has(card.personId));

  // 1. Недавние ошибки.
  for (const card of cards
    .filter((card) => card.wrong > 0 && card.streak === 0)
    .sort((a, b) => b.wrong - a.wrong)) {
    pushQuiz(card.personId, pickMode(card.personId));
  }
  if (mistakesOnly) return steps;

  // 2. Новые лица: сначала показать, потом сразу спросить.
  const fresh = LEARNING_ORDER.filter((p) => inPool.has(p.id) && !progress.seen.includes(p.id));
  const newcomers = progress.seen.length === 0 ? LEARN_BATCH_FIRST : LEARN_BATCH;
  for (const person of fresh.slice(0, newcomers)) {
    if (steps.length >= length) break;
    steps.push({ kind: 'learn', personId: person.id });
    pushQuiz(person.id, 'photo-to-name');
  }

  // 3. Просроченные повторения.
  for (const card of cards.filter((c) => isDue(c, now)).sort((a, b) => a.due - b.due)) {
    pushQuiz(card.personId, pickMode(card.personId));
  }

  // 4. Путаемые пары — спрашиваем обе стороны подряд.
  for (const [id, pairs] of Object.entries(progress.confusions)) {
    for (const other of byCount(pairs)) {
      pushQuiz(id, pickMode(id));
      pushQuiz(other, pickMode(other));
    }
  }

  // 5. Добор: неосвоенные, затем всё остальное для контрольного повторения.
  for (const person of pool.filter((p) => !isLearned(progress, p.id))) {
    pushQuiz(person.id, pickMode(person.id));
  }
  for (const person of shuffle(pool, rng)) pushQuiz(person.id, pickMode(person.id));

  return steps.slice(0, length);
}
