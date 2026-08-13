'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { goalProgress, nextModule, normalizePlan } from '@/lib/plan';
import { useActiveData, useHydrated } from '@/lib/store';
import { LEARNING_MODULES } from '@/modules/registry';

/**
 * Полоса дневной нормы.
 *
 * Живёт в общей шапке, а не в каждом занятии: направление определяется по
 * адресу страницы, поэтому новый модуль подхватывается сам, без правок в его
 * компонентах.
 *
 * Когда норма закрыта, полоса не выгоняет ребёнка из занятия — он может
 * продолжать сколько хочет. Она лишь говорит, что на сегодня сделано, и
 * предлагает следующее направление из плана.
 */

/** Адрес страницы → направление. Первое совпадение по началу пути. */
const ROUTE_MODULE: Array<[string, string]> = [
  ['/math', 'mathematics'],
  ['/english', 'english'],
  ['/chinese', 'chinese'],
  ['/chess', 'chess'],
  ['/anatomy', 'anatomy'],
  ['/people', 'people'],
  ['/play', 'geography'],
];

const ORDER = LEARNING_MODULES.map((module) => module.id);

function moduleOf(pathname: string): string | null {
  for (const [prefix, id] of ROUTE_MODULE) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return id;
  }
  return pathname === '/' ? 'geography' : null;
}

export default function DailyGoalBar() {
  const hydrated = useHydrated();
  const data = useActiveData();
  const pathname = usePathname();
  const plan = useMemo(() => normalizePlan(data.plan), [data.plan]);

  const moduleId = moduleOf(pathname);
  if (!hydrated || !moduleId) return null;

  const progress = goalProgress(plan, moduleId);
  if (!progress) return null;

  const unit = progress.goal.kind === 'time' ? ' мин' : '';
  const nextId = progress.done ? nextModule(plan, ORDER, moduleId) : null;
  const next = LEARNING_MODULES.find((module) => module.id === nextId);

  return (
    <div
      className={`border-b border-line ${progress.done ? 'bg-emerald-500/10' : 'bg-ink-900/60'}`}
    >
      <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center gap-3 px-4 py-2 text-sm sm:px-6">
        {progress.done ? (
          <>
            <span className="font-extrabold text-emerald-500">Норма на сегодня выполнена</span>
            <span className="text-slate-400">
              {progress.current}
              {unit} — можно продолжать или перейти дальше
            </span>
            {next ? (
              <Link href={next.href} className="btn-primary ml-auto px-4 py-1.5 text-xs">
                Дальше: {next.title}
              </Link>
            ) : (
              <span className="ml-auto text-xs font-extrabold text-emerald-500">
                План на сегодня закрыт
              </span>
            )}
          </>
        ) : (
          <>
            <span className="font-bold text-slate-400">Сегодня</span>
            <span className="font-extrabold tabular-nums">
              {progress.current} / {progress.target}
              {unit}
            </span>
            <span className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-ink-700">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-sky-400 to-violet-400 transition-[width] duration-500"
                style={{ width: `${progress.percent}%` }}
              />
            </span>
            <Link href="/plan" className="text-xs font-bold text-slate-500 hover:text-ink">
              Изменить
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
