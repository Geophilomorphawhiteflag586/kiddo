'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import Hud from '@/components/Hud';
import { useActiveData, useHydrated } from '@/lib/store';
import { TOTAL_PUZZLES } from '@/modules/chess/config';
import { normalizeChessProgress, summarize } from '@/modules/chess/progress';
import { usePuzzles } from '@/modules/chess/puzzles';

const LEVELS = [
  { id: 1 as const, title: 'Простые', hint: '~8 фигур, мат виден сразу' },
  { id: 2 as const, title: 'Средние', hint: '~11 фигур, есть ложные шахи' },
  { id: 3 as const, title: 'Сложные', hint: '~14 фигур, мат надо искать' },
];

/**
 * Детский экран: доска, задача и прогресс. Никакой аналитики — точность,
 * среднее время и разбор попыток живут в родительском разделе.
 */
export default function ChessPage() {
  const hydrated = useHydrated();
  const data = useActiveData();

  const puzzles = usePuzzles();
  const stats = useMemo(() => summarize(normalizeChessProgress(data.chess)), [data.chess]);
  const solved = hydrated ? stats.solved : 0;
  const percent = Math.round((solved / TOTAL_PUZZLES) * 100);

  /** Сколько всего задач и сколько решено на каждом уровне. */
  const { counts, solvedByLevel } = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    const solvedByLevel: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    const progress = normalizeChessProgress(data.chess);
    for (const puzzle of puzzles ?? []) {
      counts[puzzle.difficulty] += 1;
      if (progress.puzzles[puzzle.id]?.solved) solvedByLevel[puzzle.difficulty] += 1;
    }
    return { counts, solvedByLevel };
  }, [puzzles, data.chess]);

  return (
    <div className="min-h-dvh">
      <Hud />

      <main className="mx-auto w-full max-w-3xl px-4 pb-20 pt-8 sm:px-6">
        <Link href="/learn" className="text-sm text-slate-500 hover:text-white">
          ← Все направления
        </Link>

        <section className="mt-6 text-center">
          <span className="text-5xl" aria-hidden>
            ♟️
          </span>
          <h1 className="mt-3 text-4xl font-extrabold">Шахматы</h1>
          <p className="mt-2 text-slate-400">
            Мат в 1 ход. Найди единственный ход, который ставит мат.
          </p>

          <Link href="/chess/play" className="btn-primary mt-6 inline-block px-10 py-4 text-lg">
            Решать задачи
          </Link>
        </section>

        {/* Без явного выбора уровня сессия всегда брала бы начало базы —
            а это самые лёгкие позиции из всей тысячи. */}
        <section className="panel mt-6 p-5">
          <p className="panel-title mb-3">Выбрать уровень</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {LEVELS.map((level) => {
              const done = hydrated ? solvedByLevel[level.id] : 0;
              return (
                <Link
                  key={level.id}
                  href={`/chess/play?level=${level.id}`}
                  className="rounded-xl border border-line bg-ink-700/50 p-4 transition hover:border-accent/50"
                >
                  <p className="font-extrabold">{level.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{level.hint}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    {done} / {counts[level.id] ?? 0} решено
                  </p>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="panel mt-8 p-5">
          <div className="flex items-baseline justify-between">
            <span className="font-extrabold">
              {solved} / {TOTAL_PUZZLES} задач решено
            </span>
            <span className="text-sm font-bold text-emerald-300">{percent}%</span>
          </div>
          <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-ink-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-slate-400 to-emerald-400 transition-[width] duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>

          {/* Ребёнку — только ободряющие цифры, без разбора ошибок. */}
          <div className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-3">
            <Tile label="С первой попытки" value={hydrated ? stats.solvedFirstTry : 0} />
            <Tile label="Матов поставлено" value={hydrated ? stats.checkmates : 0} />
            <Tile label="Лучшая серия" value={hydrated ? stats.bestStreak : 0} />
          </div>
        </section>

        <section className="panel mt-4 p-5">
          <p className="panel-title mb-2">Как это работает</p>
          <ul className="space-y-1.5 text-sm text-slate-400">
            <li>· Нажми свою фигуру, потом клетку, куда пойти.</li>
            <li>· Подсказок нет: куда ходит фигура — придумай сам.</li>
            <li>· Ошибся — ничего страшного, позиция вернётся, пробуй ещё.</li>
            <li>· Время считается, но это не гонка: думай сколько нужно.</li>
          </ul>
        </section>

        <div className="mt-6 text-center">
          <Link href="/chess/progress" className="text-sm text-slate-500 hover:underline">
            Подробная статистика для родителя →
          </Link>
        </div>
      </main>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line bg-ink-700/40 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-extrabold">{value}</p>
    </div>
  );
}
