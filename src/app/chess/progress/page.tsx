'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import Hud from '@/components/Hud';
import { useActiveData, useActiveProfile, useHydrated } from '@/lib/store';
import AttemptList from '@/modules/chess/components/AttemptList';
import { TOTAL_PUZZLES } from '@/modules/chess/config';
import { hardestPuzzles, normalizeChessProgress, summarize } from '@/modules/chess/progress';
import type { PuzzleRecord } from '@/modules/chess/types';

const formatMs = (ms: number | null) => {
  if (ms === null || ms <= 0) return '—';
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total} сек`;
  return `${Math.floor(total / 60)} мин ${String(total % 60).padStart(2, '0')} сек`;
};

/**
 * Родительский раздел. Здесь важно не «сколько решено», а как ребёнок решал:
 * с первой ли попытки, сколько времени думал, какие ходы пробовал.
 */
export default function ChessProgressPage() {
  const hydrated = useHydrated();
  const profile = useActiveProfile();
  const data = useActiveData();
  const [openPuzzle, setOpenPuzzle] = useState<number | null>(null);

  const progress = useMemo(() => normalizeChessProgress(data.chess), [data.chess]);
  const stats = summarize(progress);
  const hardest = hardestPuzzles(progress, 5);

  const recent = useMemo(
    () =>
      Object.values(progress.puzzles)
        .filter((record) => record.attempts.length > 0)
        .sort((a, b) => (b.completedAt ?? b.startedAt).localeCompare(a.completedAt ?? a.startedAt))
        .slice(0, 12),
    [progress.puzzles],
  );

  return (
    <div className="min-h-dvh">
      <Hud />

      <main className="mx-auto w-full max-w-4xl px-4 pb-20 pt-8 sm:px-6">
        <Link href="/chess" className="text-sm text-slate-500 hover:text-white">
          ← Шахматы
        </Link>

        <h1 className="mt-3 text-3xl font-extrabold">Шахматы · статистика</h1>
        <p className="mt-1 text-sm text-slate-400">
          Профиль: {profile.name}. Здесь видно не только результат, но и ход мысли.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Решено" value={`${hydrated ? stats.solved : 0} / ${TOTAL_PUZZLES}`} />
          <Tile
            label="С первой попытки"
            value={`${hydrated ? Math.round(stats.firstTryAccuracy * 100) : 0}%`}
          />
          <Tile
            label="Попыток в среднем"
            value={hydrated ? stats.averageAttempts.toFixed(1) : '0'}
          />
          <Tile label="Лучшая серия" value={hydrated ? stats.bestStreak : 0} />
        </div>

        <section className="panel mt-4 p-5">
          <p className="panel-title mb-3">Время на задачу</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Среднее" value={formatMs(stats.averageTimeMs)} />
            {/* Медиана рядом со средним: пара очень долгих задач иначе
                перекашивает картину и создаёт ложное впечатление. */}
            <Tile label="Медиана" value={formatMs(stats.medianTimeMs)} />
            <Tile label="Самая быстрая" value={formatMs(stats.fastestMs)} />
            <Tile label="Самая долгая" value={formatMs(stats.slowestMs)} />
          </div>
        </section>

        <section className="panel mt-4 p-5">
          <p className="panel-title mb-3">Из чего складывались попытки</p>
          <div className="grid grid-cols-3 gap-3">
            <Tile label="Матов" value={hydrated ? stats.checkmates : 0} />
            <Tile label="Ход есть, мата нет" value={hydrated ? stats.legalNonMateMoves : 0} />
            <Tile label="Невозможные ходы" value={hydrated ? stats.illegalMoves : 0} />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Много невозможных ходов — ребёнок ещё не уверен, как ходят фигуры. Много
            легальных ходов без мата — фигуры знает, но не видит матовую сеть.
          </p>
        </section>

        {hardest.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-3 text-xl font-extrabold">Самые трудные задачи</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {hardest.map((record) => (
                <PuzzleCard
                  key={record.puzzleId}
                  record={record}
                  open={openPuzzle === record.puzzleId}
                  onToggle={() =>
                    setOpenPuzzle(openPuzzle === record.puzzleId ? null : record.puzzleId)
                  }
                />
              ))}
            </div>
          </section>
        )}

        <section className="mt-6">
          <h2 className="mb-3 text-xl font-extrabold">История решений</h2>
          {recent.length === 0 ? (
            <p className="panel p-4 text-sm text-slate-500">
              Пока нет ни одной попытки. Как только ребёнок начнёт решать, здесь появится
              полная история каждой задачи.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {recent.map((record) => (
                <PuzzleCard
                  key={record.puzzleId}
                  record={record}
                  open={openPuzzle === record.puzzleId}
                  onToggle={() =>
                    setOpenPuzzle(openPuzzle === record.puzzleId ? null : record.puzzleId)
                  }
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function PuzzleCard({
  record,
  open,
  onToggle,
}: {
  record: PuzzleRecord;
  open: boolean;
  onToggle: () => void;
}) {
  const illegal = record.attempts.filter((a) => a.result === 'illegal_move').length;
  const notMate = record.attempts.filter((a) => a.result === 'legal_not_mate').length;

  return (
    <div className="panel p-4">
      <button onClick={onToggle} className="w-full text-left" aria-expanded={open}>
        <div className="flex items-center gap-2">
          <span className="font-extrabold">Задача #{record.puzzleId}</span>
          {record.solved ? (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-300">
              решена
            </span>
          ) : (
            <span className="rounded-full bg-ink-700 px-2 py-0.5 text-xs font-bold text-slate-400">
              в процессе
            </span>
          )}
          {record.solvedFirstTry && (
            <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-bold text-amber-200">
              с первой
            </span>
          )}
          <span className="ml-auto text-xs text-accent">{open ? 'скрыть' : 'разбор'}</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {formatMs(record.timeSpentMs)} · попыток: {record.attempts.length}
          {illegal > 0 ? ` · невозможных: ${illegal}` : ''}
          {notMate > 0 ? ` · без мата: ${notMate}` : ''}
        </p>
      </button>

      {open && (
        <div className="mt-3">
          <AttemptList attempts={record.attempts} />
        </div>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-line bg-ink-700/40 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-extrabold">{value}</p>
    </div>
  );
}
