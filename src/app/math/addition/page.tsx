'use client';

import Link from 'next/link';
import Hud from '@/components/Hud';
import { useActiveData, useHydrated } from '@/lib/store';
import { LEVELS, LEVEL_META } from '@/modules/mathematics/config';
import { accuracyOf, avgMsOf, masteryOf } from '@/modules/mathematics/mastery';
import { emptyLevelStats, normalizeMathProgress } from '@/modules/mathematics/progress';

const pct = (x: number) => `${Math.round(x * 100)}%`;

export default function AdditionPage() {
  const hydrated = useHydrated();
  const data = useActiveData();
  const math = normalizeMathProgress(data.math);

  return (
    <div className="min-h-dvh">
      <Hud />

      <main className="mx-auto w-full max-w-3xl px-4 pb-20 pt-8 sm:px-6">
        <Link href="/math" className="text-sm text-slate-400 hover:text-ink">
          ← Математика
        </Link>

        <h1 className="mt-3 text-3xl font-extrabold">Сложение</h1>
        <p className="mt-1 text-slate-400">
          Уровень сложности внутри каждого раздела подбирается автоматически.
        </p>

        <div className="mt-6 space-y-3">
          {LEVELS.map((level) => {
            const meta = LEVEL_META[level];
            const stats = hydrated ? math.addition[level] : emptyLevelStats();
            const mastery = masteryOf(stats, level);
            const avgMs = avgMsOf(stats);
            const goalPercent = Math.min(100, (stats.correct / meta.goal) * 100);

            return (
              <section key={level} className="panel p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-extrabold">{meta.title}</h2>
                    <p className="text-xs text-slate-400">Например: {meta.example}</p>
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-extrabold"
                    style={{ background: `${mastery.color}22`, color: mastery.color }}
                  >
                    {mastery.label} · {mastery.percent}%
                  </span>
                </div>

                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink-700">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${goalPercent}%`, background: meta.color }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-400">
                  <span>
                    <span className="font-extrabold text-slate-400">{stats.correct}</span> / {meta.goal}
                  </span>
                  <span>Точность: {stats.solved ? pct(accuracyOf(stats)) : '—'}</span>
                  <span>
                    Среднее время: {avgMs === null ? '—' : `${(avgMs / 1000).toFixed(1)} сек`}
                  </span>
                  <span>Лучшая серия: {stats.bestStreak}</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/math/addition/${meta.slug}`}
                    className="btn-primary px-5 py-2.5 text-sm"
                  >
                    {stats.solved > 0 ? 'Продолжить' : 'Начать'}
                  </Link>
                  {stats.mistakes.length > 0 && (
                    <Link
                      href={`/math/addition/${meta.slug}?mistakes=1`}
                      className="btn-ghost px-5 py-2.5 text-sm"
                    >
                      Повторить ошибки · {stats.mistakes.length}
                    </Link>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
