import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  emptyPlan,
  goalProgress,
  nextModule,
  normalizePlan,
  planComplete,
  planForDay,
  registerPlanActivity,
  remainingModules,
} from './plan.ts';

const DAY1 = Date.UTC(2026, 7, 13, 10);
const DAY2 = Date.UTC(2026, 7, 14, 10);
const ORDER = ['geography', 'mathematics', 'english', 'chess'];

const withGoals = (goals: Record<string, { kind: 'time' | 'tasks'; amount: number }>) => ({
  ...emptyPlan(),
  goals,
});

test('норма по заданиям закрывается ровно на нужном числе', () => {
  let plan = withGoals({ mathematics: { kind: 'tasks', amount: 3 } });
  for (let i = 0; i < 2; i += 1) {
    plan = registerPlanActivity(plan, 'mathematics', DAY1 + i * 10_000);
  }
  assert.equal(goalProgress(plan, 'mathematics', DAY1)!.done, false);
  plan = registerPlanActivity(plan, 'mathematics', DAY1 + 30_000);
  assert.equal(goalProgress(plan, 'mathematics', DAY1)!.done, true);
});

test('норма по времени считает занятие, а не время в браузере', () => {
  // Ребёнок отвлёкся на час — это не час учёбы: длинная пауза обрезается.
  let plan = withGoals({ english: { kind: 'time', amount: 5 } });
  plan = registerPlanActivity(plan, 'english', DAY1);
  plan = registerPlanActivity(plan, 'english', DAY1 + 60 * 60_000);
  const progress = goalProgress(plan, 'english', DAY1)!;
  assert.ok(progress.current < 5, `засчитано ${progress.current} мин вместо паузы`);
});

test('прогресс сбрасывается на следующий день, нормы остаются', () => {
  let plan = withGoals({ chess: { kind: 'tasks', amount: 2 } });
  plan = registerPlanActivity(plan, 'chess', DAY1);
  plan = registerPlanActivity(plan, 'chess', DAY1 + 5000);
  assert.equal(goalProgress(plan, 'chess', DAY1)!.done, true);

  const nextDay = planForDay(plan, DAY2);
  assert.equal(goalProgress(nextDay, 'chess', DAY2)!.current, 0);
  assert.equal(nextDay.goals.chess.amount, 2, 'норма потерялась при смене дня');
});

test('направление без нормы не отслеживается', () => {
  const plan = registerPlanActivity(emptyPlan(), 'chinese', DAY1);
  assert.equal(goalProgress(plan, 'chinese', DAY1), null);
});

test('следующее направление берётся после текущего по порядку', () => {
  let plan = withGoals({
    mathematics: { kind: 'tasks', amount: 1 },
    english: { kind: 'tasks', amount: 1 },
    chess: { kind: 'tasks', amount: 1 },
  });
  plan = registerPlanActivity(plan, 'mathematics', DAY1);
  assert.equal(nextModule(plan, ORDER, 'mathematics', DAY1), 'english');
});

test('закрытые направления не предлагаются следующими', () => {
  let plan = withGoals({
    mathematics: { kind: 'tasks', amount: 1 },
    english: { kind: 'tasks', amount: 1 },
  });
  plan = registerPlanActivity(plan, 'mathematics', DAY1);
  plan = registerPlanActivity(plan, 'english', DAY1);
  assert.equal(nextModule(plan, ORDER, 'mathematics', DAY1), null);
  assert.equal(planComplete(plan, DAY1), true);
  assert.deepEqual(remainingModules(plan, ORDER, DAY1), []);
});

test('пустой план не считается выполненным', () => {
  assert.equal(planComplete(emptyPlan(), DAY1), false);
});

test('нормализация отбрасывает мусор и чинит частичные данные', () => {
  const restored = normalizePlan({
    goals: {
      english: { kind: 'time', amount: 30 },
      broken: { kind: 'time', amount: -5 },
      huge: { kind: 'tasks', amount: 9999 },
    },
    day: '2026-08-13',
    done: { english: { tasks: 4, ms: 120_000, lastAt: DAY1 } },
  } as never);

  assert.deepEqual(Object.keys(restored.goals), ['english']);
  assert.equal(restored.done.english.tasks, 4);
});

test('план переживает JSON-сериализацию', () => {
  let plan = withGoals({ chess: { kind: 'tasks', amount: 10 } });
  plan = registerPlanActivity(plan, 'chess', DAY1);
  assert.deepEqual(normalizePlan(JSON.parse(JSON.stringify(plan))), plan);
});
