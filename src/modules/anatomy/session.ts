/**
 * Подбор заданий Anatomy: сначала новые структуры на изучение, затем
 * адаптивный квиз — ошибки и путаница возвращаются чаще, чем освоенное.
 */
import { isDue } from '../../lib/srs.ts';
import { LEARN_BATCH, MODE_SKILL, MODE_UNLOCK, OPTION_COUNT, SESSION_LENGTH } from './config.ts';
import { cardKey, isLearned, structurePercent } from './mastery.ts';
import { structuresWithHotspot } from './data/hotspots.ts';
import { getStructure, structuresDrawnIn } from './structures.ts';
import type {
  AnatomyProgress,
  AnatomyQuestion,
  AnatomyStructure,
  QuizMode,
  RegionId,
} from './types.ts';

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
 * Варианты ответа. Сначала то, что ребёнок уже путал с этой структурой, затем
 * соседи по региону: спутать теменную с височной куда полезнее, чем с почкой.
 */
export function buildOptions(
  target: AnatomyStructure,
  pool: readonly AnatomyStructure[],
  progress: AnatomyProgress,
  count = OPTION_COUNT,
  rng: Rng = Math.random,
): string[] {
  const picked = new Set<string>([target.id]);
  const inPool = new Set(pool.map((s) => s.id));
  const add = (ids: readonly string[]) => {
    for (const id of ids) {
      if (picked.size >= count) return;
      if (picked.has(id) || !inPool.has(id)) continue;
      picked.add(id);
    }
  };

  add(byCount(progress.confusions[target.id]));
  add(shuffle(pool.filter((s) => s.region === target.region && s.id !== target.id), rng).map((s) => s.id));
  add(shuffle(pool.filter((s) => s.system === target.system && s.id !== target.id), rng).map((s) => s.id));
  add(shuffle(pool, rng).map((s) => s.id));

  return shuffle([...picked], rng);
}

export function modesFor(percent: number): QuizMode[] {
  let modes = MODE_UNLOCK[0].modes;
  for (const rule of MODE_UNLOCK) if (percent >= rule.minPercent) modes = rule.modes;
  return modes;
}

export interface SessionStep {
  kind: 'learn' | 'quiz';
  structureId: string;
  question?: AnatomyQuestion;
}

export interface SessionOptions {
  progress: AnatomyProgress;
  /** Регионы, доступные в этой сессии. */
  regions: RegionId[];
  length?: number;
  now?: number;
  rng?: Rng;
  mistakesOnly?: boolean;
}

/**
 * Собирает сессию: несколько новых структур с показом, затем вопросы.
 * Порядок вопросов: недавние ошибки → просроченные повторения → путаница →
 * только что изученное → остальное.
 */
export function buildSession({
  progress,
  regions,
  length = SESSION_LENGTH,
  now = Date.now(),
  rng = Math.random,
  mistakesOnly = false,
}: SessionOptions): SessionStep[] {
  // Спрашиваем то, что показано на иллюстрациях выбранных регионов. Так в
  // сессию по полному скелету попадают кости, «приписанные» к руке и ноге, а
  // мелких костей черепа там не оказывается — на них нет зоны.
  const pool = [
    ...new Map(
      regions
        .flatMap((region) => structuresWithHotspot(region))
        .map((id) => getStructure(id))
        .filter((structure): structure is AnatomyStructure => Boolean(structure))
        .map((structure) => [structure.id, structure] as const),
    ).values(),
  ].sort((a, b) => a.order - b.order);
  const inPool = new Set(pool.map((s) => s.id));
  const steps: SessionStep[] = [];
  const askedKeys = new Set<string>();

  /** На полном скелете спрашиваем только «покажи», регион большой. */
  const regionFor = (structureId: string, mode: QuizMode): RegionId => {
    const structure = getStructure(structureId);
    if (!structure) return regions[0];
    if (mode === 'find-on-body' && regions.includes('skeleton')) return 'skeleton';
    return structure.region;

  };

  const pushQuiz = (structureId: string, mode: QuizMode) => {
    if (steps.length >= length) return;
    const skill = MODE_SKILL[mode];
    const key = cardKey(structureId, skill);
    if (askedKeys.has(key)) return;
    const structure = getStructure(structureId);
    if (!structure || !inPool.has(structureId)) return;
    askedKeys.add(key);
    steps.push({
      kind: 'quiz',
      structureId,
      question: {
        mode,
        skill,
        structureId,
        region: regionFor(structureId, mode),
        // В режиме поиска на теле варианты не нужны: ребёнок кликает по схеме.
        options: mode === 'find-on-body' ? [] : buildOptions(structure, pool, progress, OPTION_COUNT, rng),
      },
    });
  };

  /** Режим для структуры: доступный по освоению, с уклоном в слабый навык. */
  const pickMode = (structureId: string): QuizMode => {
    const modes = modesFor(structurePercent(progress, structureId));
    const weakest = modes.reduce((weak, mode) => {
      const current = progress.cards[cardKey(structureId, MODE_SKILL[mode])];
      const best = progress.cards[cardKey(structureId, MODE_SKILL[weak])];
      return (current?.interval ?? -1) < (best?.interval ?? -1) ? mode : weak;
    }, modes[0]);
    return rng() < 0.7 ? weakest : modes[Math.floor(rng() * modes.length)];
  };

  const cards = Object.values(progress.cards).filter((card) => inPool.has(card.structureId));

  // 1. Недавние ошибки.
  const mistakes = cards
    .filter((card) => card.wrong > 0 && card.streak === 0)
    .sort((a, b) => b.wrong - a.wrong);
  for (const card of mistakes) pushQuiz(card.structureId, pickMode(card.structureId));
  if (mistakesOnly) return steps;

  // 2. Новые структуры: сначала показать, потом сразу спросить.
  const fresh = pool.filter((s) => !progress.seen.includes(s.id));
  for (const structure of fresh.slice(0, LEARN_BATCH)) {
    if (steps.length >= length) break;
    steps.push({ kind: 'learn', structureId: structure.id });
    pushQuiz(structure.id, 'what-is-this');
  }

  // 3. Просроченные повторения.
  for (const card of cards.filter((c) => isDue(c, now)).sort((a, b) => a.due - b.due)) {
    pushQuiz(card.structureId, pickMode(card.structureId));
  }

  // 4. Путаемые пары — спрашиваем обе стороны.
  for (const [id, pairs] of Object.entries(progress.confusions)) {
    for (const other of byCount(pairs)) {
      pushQuiz(id, pickMode(id));
      pushQuiz(other, pickMode(other));
    }
  }

  // 5. Добор: неосвоенное, затем всё остальное для контрольного повторения.
  for (const structure of pool.filter((s) => !isLearned(progress, s.id))) {
    pushQuiz(structure.id, pickMode(structure.id));
  }
  for (const structure of shuffle(pool, rng)) pushQuiz(structure.id, pickMode(structure.id));

  return steps.slice(0, length);
}

/** Структуры, которые можно кликнуть в режиме «покажи на теле». */
export function pickableIn(region: RegionId): string[] {
  return structuresDrawnIn(region);
}
