'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import Hud from '@/components/Hud';
import { useActiveData, useGame, useHydrated } from '@/lib/store';
import { GOAL_PRESETS, goalProgress, normalizePlan, type GoalKind } from '@/lib/plan';
import { LEARNING_MODULES } from '@/modules/registry';

/**
 * Настройка занятий: сколько заниматься каждым направлением за день.
 *
 * Норма бывает двух видов, и это не прихоть. Время подходит там, где важно
 * «посидеть и повариться» — язык, чтение. Число заданий честнее для шахмат и
 * счёта: ребёнок видит конец работы, а не таймер, который тикает, пока он
 * думает над задачей.
 */
export default function PlanPage() {
  const hydrated = useHydrated();
  const data = useActiveData();
  const setDailyGoal = useGame((s) => s.setDailyGoal);
  const plan = useMemo(() => normalizePlan(data.plan), [data.plan]);

  const active = LEARNING_MODULES.filter((module) => module.status === 'active');
  const inPlan = active.filter((module) => plan.goals[module.id]).length;

  return (
    <div className="min-h-dvh">
      <Hud />

      <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6 sm:px-6">
        <Link href="/learn" className="text-sm text-slate-500 hover:text-ink">
          ← Все направления
        </Link>

        <h1 className="mt-3 text-3xl font-extrabold">Настроить занятия</h1>
        <p className="mt-2 text-slate-400">
          Выберите, сколько заниматься каждым направлением за день. Когда норма выполнена,
          приложение само предложит перейти к следующему.
        </p>

        <p className="mt-4 text-sm font-bold text-slate-500">
          {hydrated ? `В плане направлений: ${inPlan}` : ' '}
        </p>

        <div className="mt-4 space-y-3">
          {active.map((module) => {
            const goal = hydrated ? plan.goals[module.id] : undefined;
            const progress = hydrated ? goalProgress(plan, module.id) : null;

            return (
              <section key={module.id} className="panel p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span aria-hidden className="text-2xl">
                    {module.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-extrabold">{module.title}</h2>
                    <p className="text-xs text-slate-500">{module.tagline}</p>
                  </div>
                  {progress && (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-extrabold ${
                        progress.done
                          ? 'bg-emerald-500/15 text-emerald-500'
                          : 'bg-ink-700 text-slate-400'
                      }`}
                    >
                      {progress.done
                        ? 'На сегодня готово'
                        : `${progress.current} / ${progress.target}` +
                          (progress.goal.kind === 'time' ? ' мин' : '')}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDailyGoal(module.id, null)}
                    aria-pressed={!goal}
                    className={`rounded-xl border-2 px-4 py-2 text-sm font-bold transition ${
                      !goal ? 'border-accent bg-accent/10' : 'border-line hover:border-accent/40'
                    }`}
                  >
                    Без нормы
                  </button>

                  {(['tasks', 'time'] as GoalKind[]).map((kind) => (
                    <div key={kind} className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-500">
                        {kind === 'tasks' ? 'Заданий:' : 'Минут:'}
                      </span>
                      {GOAL_PRESETS[kind].map((amount) => {
                        const chosen = goal?.kind === kind && goal.amount === amount;
                        return (
                          <button
                            key={amount}
                            type="button"
                            onClick={() => setDailyGoal(module.id, { kind, amount })}
                            aria-pressed={chosen}
                            className={`h-9 w-9 rounded-lg text-sm font-extrabold transition ${
                              chosen
                                ? 'bg-accent text-white'
                                : 'bg-ink-700 text-slate-400 hover:text-ink'
                            }`}
                          >
                            {amount}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <div className="mt-6 text-center">
          <Link href="/learn" className="btn-primary inline-block px-8 py-3">
            Готово
          </Link>
        </div>
      </main>
    </div>
  );
}
