/**
 * План занятий: дневная норма по каждому направлению.
 *
 * Норма задаётся либо временем («полчаса английского»), либо числом заданий
 * («двадцать примеров, и свободен»). Второе честнее для шахмат и математики:
 * ребёнок видит конец работы, а не таймер, который тикает, пока он думает.
 *
 * Считается в одном месте — в `registerActivity`, через которое проходит
 * каждый ответ во всех модулях. Поэтому новый модуль попадает в план
 * автоматически, ничего не дописывая.
 */

export type GoalKind = 'time' | 'tasks';

export interface DailyGoal {
  kind: GoalKind;
  /** Минуты для `time`, количество заданий для `tasks`. */
  amount: number;
}

export interface ModuleDone {
  tasks: number;
  ms: number;
  /** Время последнего ответа: по нему считается, сколько ребёнок занимался. */
  lastAt: number;
}

export interface TrainingPlan {
  /** id направления → норма. Нет записи — направление не в плане. */
  goals: Record<string, DailyGoal>;
  /** День, за который посчитан прогресс, в формате YYYY-MM-DD. */
  day: string;
  done: Record<string, ModuleDone>;
}

/**
 * Пауза между ответами, которая ещё считается занятием.
 *
 * Ребёнок отвлёкся на полчаса — это не полчаса учёбы. Всё, что дольше,
 * засчитывается как одна минута: сам ответ время всё-таки занял.
 */
const MAX_GAP_MS = 90_000;
const MIN_GAP_MS = 60_000;

export const GOAL_PRESETS: Record<GoalKind, number[]> = {
  time: [5, 10, 15, 20, 30, 45],
  tasks: [5, 10, 15, 20, 30, 50],
};

export function emptyPlan(): TrainingPlan {
  return { goals: {}, day: '', done: {} };
}

const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10);

export function normalizePlan(raw: Partial<TrainingPlan> | undefined): TrainingPlan {
  const base = emptyPlan();
  if (!raw) return base;

  for (const [moduleId, goal] of Object.entries(raw.goals ?? {})) {
    if (!goal || typeof goal !== 'object') continue;
    const kind: GoalKind = goal.kind === 'time' ? 'time' : 'tasks';
    const amount = Math.round(Number(goal.amount));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 500) continue;
    base.goals[moduleId] = { kind, amount };
  }

  base.day = typeof raw.day === 'string' ? raw.day : '';
  for (const [moduleId, done] of Object.entries(raw.done ?? {})) {
    if (!done || typeof done !== 'object') continue;
    base.done[moduleId] = {
      tasks: Math.max(0, Math.round(Number(done.tasks) || 0)),
      ms: Math.max(0, Math.round(Number(done.ms) || 0)),
      lastAt: Math.max(0, Number(done.lastAt) || 0),
    };
  }
  return base;
}

/** Сбрасывает дневной прогресс, если наступил новый день. Нормы остаются. */
export function planForDay(plan: TrainingPlan, now: number): TrainingPlan {
  const day = dayOf(now);
  return plan.day === day ? plan : { goals: plan.goals, day, done: {} };
}

/** Засчитывает один ответ в дневную норму направления. */
export function registerPlanActivity(
  plan: TrainingPlan,
  moduleId: string,
  now: number,
): TrainingPlan {
  const fresh = planForDay(plan, now);
  const previous = fresh.done[moduleId] ?? { tasks: 0, ms: 0, lastAt: 0 };
  const gap = previous.lastAt > 0 ? now - previous.lastAt : MIN_GAP_MS;

  return {
    ...fresh,
    done: {
      ...fresh.done,
      [moduleId]: {
        tasks: previous.tasks + 1,
        ms: previous.ms + Math.min(Math.max(gap, 0), MAX_GAP_MS),
        lastAt: now,
      },
    },
  };
}

export interface GoalProgress {
  goal: DailyGoal;
  /** Сделано: минуты или задания, в единицах нормы. */
  current: number;
  target: number;
  percent: number;
  done: boolean;
}

/** Прогресс по норме направления. `null` — направления нет в плане. */
export function goalProgress(
  plan: TrainingPlan,
  moduleId: string,
  now = Date.now(),
): GoalProgress | null {
  const goal = plan.goals[moduleId];
  if (!goal) return null;

  const fresh = planForDay(plan, now);
  const done = fresh.done[moduleId] ?? { tasks: 0, ms: 0, lastAt: 0 };
  const current = goal.kind === 'time' ? Math.floor(done.ms / 60_000) : done.tasks;

  return {
    goal,
    current,
    target: goal.amount,
    percent: Math.min(100, Math.round((current / goal.amount) * 100)),
    done: current >= goal.amount,
  };
}

/** Направления в плане, где норма на сегодня ещё не закрыта. */
export function remainingModules(
  plan: TrainingPlan,
  order: readonly string[],
  now = Date.now(),
): string[] {
  return order.filter((moduleId) => {
    const progress = goalProgress(plan, moduleId, now);
    return progress !== null && !progress.done;
  });
}

/** Следующее направление после текущего — куда идти, когда норма закрыта. */
export function nextModule(
  plan: TrainingPlan,
  order: readonly string[],
  currentId: string,
  now = Date.now(),
): string | null {
  const remaining = remainingModules(plan, order, now).filter((id) => id !== currentId);
  if (remaining.length === 0) return null;
  // Идём по порядку из плана, начиная с того, что стоит после текущего.
  const position = order.indexOf(currentId);
  const after = remaining.find((id) => order.indexOf(id) > position);
  return after ?? remaining[0];
}

/** Весь план на сегодня выполнен: все направления закрыты. */
export function planComplete(plan: TrainingPlan, now = Date.now()): boolean {
  const ids = Object.keys(plan.goals);
  return ids.length > 0 && ids.every((id) => goalProgress(plan, id, now)?.done);
}
