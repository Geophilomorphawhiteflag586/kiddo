'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hud from '@/components/Hud';
import { useGame, useHydrated } from '@/lib/store';
import { DIFFICULTY_LABELS, ILLEGAL_MESSAGES, SESSION_LENGTH } from '../config.ts';
import { pieceAt, tryMove } from '../engine.ts';
import { nextPuzzleIds, normalizeChessProgress } from '../progress.ts';
import { usePuzzles } from '../puzzles.ts';
import type { ChessAttempt, ChessPuzzle } from '../types.ts';
import AttemptList from './AttemptList.tsx';
import ChessBoard from './ChessBoard.tsx';

/** Ответ сессии на попытку: показываем разбор, но задачу не закрываем. */
type Feedback = { kind: 'illegal' | 'not-mate' | 'mate'; attempt: ChessAttempt } | null;

const formatTime = (ms: number) => {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

export default function ChessSession() {
  const hydrated = useHydrated();
  const profileId = useGame((s) => s.activeProfileId);
  const searchParams = useSearchParams();
  const puzzles = usePuzzles();

  const raw = Number(searchParams.get('level'));
  const level = ([1, 2, 3] as const).includes(raw as 1 | 2 | 3) ? (raw as 1 | 2 | 3) : null;

  if (!hydrated || !puzzles) {
    return (
      <div className="min-h-dvh">
        <Hud />
        <div className="grid place-items-center py-32 text-slate-500">Расставляем фигуры…</div>
      </div>
    );
  }

  return <RunningSession key={`${profileId}:${level ?? 'all'}`} allPuzzles={puzzles} level={level} />;
}

function RunningSession({
  allPuzzles,
  level,
}: {
  allPuzzles: ChessPuzzle[];
  level: 1 | 2 | 3 | null;
}) {
  const router = useRouter();
  const startPuzzle = useGame((s) => s.startChessPuzzle);
  const submitAttempt = useGame((s) => s.submitChessAttempt);

  const [ids] = useState<number[]>(() => {
    const state = useGame.getState();
    const progress = normalizeChessProgress(state.data[state.activeProfileId]?.chess);
    const pool = allPuzzles
      .filter((puzzle) => level === null || puzzle.difficulty === level)
      .map((puzzle) => puzzle.id);
    return nextPuzzleIds(progress, pool, SESSION_LENGTH);
  });

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [attempts, setAttempts] = useState<ChessAttempt[]>([]);
  const [solvedIds, setSolvedIds] = useState<number[]>([]);
  const [firstTryIds, setFirstTryIds] = useState<number[]>([]);
  const [xp, setXp] = useState(0);
  const [times, setTimes] = useState<Record<number, number>>({});
  const [finished, setFinished] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const puzzle = useMemo(
    () => allPuzzles.find((p) => p.id === ids[index]) ?? null,
    [allPuzzles, ids, index],
  );

  /* --------------------------------- таймер -------------------------------- */

  const startedAt = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const solved = puzzle ? solvedIds.includes(puzzle.id) : false;

  useEffect(() => {
    if (!puzzle) return;
    startedAt.current = Date.now();
    startPuzzle(puzzle.id);
  }, [puzzle, startPuzzle]);

  // Таймер тикает раз в полсекунды; на смене задачи он сам обнуляется,
  // потому что startedAt уже переставлен эффектом выше.
  useEffect(() => {
    if (!puzzle || solved) return;
    const tick = setInterval(() => setElapsed(Date.now() - startedAt.current), 500);
    return () => clearInterval(tick);
  }, [puzzle, solved]);

  /* -------------------------------- ходы ---------------------------------- */

  const onSquareClick = useCallback(
    (square: string) => {
      if (!puzzle || solved) return;

      const occupant = pieceAt(puzzle.fen, square);
      // Клик по своей фигуре — это выбор, а не ход.
      if (occupant && occupant.color === puzzle.sideToMove) {
        setSelected(square === selected ? null : square);
        setFeedback(null);
        return;
      }
      if (!selected) return;

      const outcome = tryMove(puzzle.fen, selected, square);
      const result = submitAttempt(puzzle.id, selected, square, outcome);

      setAttempts((list) => [...list, result.attempt]);
      setSelected(null);
      setFeedback({
        kind:
          outcome.result === 'checkmate'
            ? 'mate'
            : outcome.result === 'illegal_move'
              ? 'illegal'
              : 'not-mate',
        attempt: result.attempt,
      });

      if (outcome.result === 'checkmate') {
        setSolvedIds((list) => [...list, puzzle.id]);
        if (result.attempt.attemptNumber === 1) {
          setFirstTryIds((list) => [...list, puzzle.id]);
        }
        setXp((value) => value + result.xpGained);
        setTimes((map) => ({ ...map, [puzzle.id]: result.attempt.elapsedTimeMs }));
      }
      // Позиция на доске не меняется: после любой попытки ребёнок видит
      // исходную расстановку и продолжает искать мат.
    },
    [puzzle, selected, solved, submitAttempt],
  );

  const nextPuzzle = () => {
    setSelected(null);
    setFeedback(null);
    setAttempts([]);
    setReviewing(false);
    setElapsed(0);
    if (index + 1 >= ids.length) setFinished(true);
    else setIndex(index + 1);
  };

  if (finished) {
    return (
      <SessionResults
        total={ids.length}
        solved={solvedIds.length}
        firstTry={firstTryIds.length}
        xp={xp}
        times={times}
        onHome={() => router.push('/chess')}
      />
    );
  }

  if (!puzzle) {
    return (
      <div className="min-h-dvh">
        <Hud />
        <div className="grid place-items-center py-32 text-slate-500">Задача не найдена.</div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <Hud />

      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6">
        <div className="mb-4 flex items-center justify-between text-sm">
          <span className="font-bold text-slate-500">
            Задача {index + 1} / {ids.length}
            <span className="ml-2 text-xs text-slate-600">
              #{puzzle.id} · {DIFFICULTY_LABELS[puzzle.difficulty].toLowerCase()}
            </span>
          </span>
          <span className="tabular-nums text-slate-500">{formatTime(elapsed)}</span>
        </div>

        <div className="panel p-5">
          <p className="text-center text-lg font-extrabold">
            {puzzle.sideToMove === 'w' ? 'Ход белых' : 'Ход чёрных'} · мат в 1 ход
          </p>
          <p className="mt-1 text-center text-xs text-slate-500">
            Нажмите свою фигуру, затем клетку, куда пойти
          </p>

          <div className="mt-4 flex justify-center">
            <ChessBoard
              fen={puzzle.fen}
              selected={selected}
              onSquareClick={onSquareClick}
              orientation={puzzle.sideToMove}
              disabled={solved}
              lastFrom={feedback?.attempt.from ?? null}
              lastTo={feedback?.attempt.to ?? null}
              lastWasMate={feedback?.kind === 'mate'}
            />
          </div>

          {/* Разбор попытки. Ошибка не закрывает задачу и не отнимает XP. */}
          <div aria-live="polite" className="mt-4 min-h-20 text-center">
            {feedback?.kind === 'illegal' && (
              <div className="animate-pop rounded-xl border border-amber-400/40 bg-amber-400/10 p-3">
                <p className="font-extrabold text-amber-700">
                  {ILLEGAL_MESSAGES[feedback.attempt.reason ?? 'not_a_move'].title}
                </p>
                <p className="mt-0.5 text-sm text-slate-500">
                  {ILLEGAL_MESSAGES[feedback.attempt.reason ?? 'not_a_move'].hint}
                </p>
              </div>
            )}
            {feedback?.kind === 'not-mate' && (
              <div className="animate-pop rounded-xl border border-sky-400/40 bg-sky-400/10 p-3">
                <p className="font-extrabold text-sky-200">
                  {feedback.attempt.move} — ход есть, но мата нет
                </p>
                <p className="mt-0.5 text-sm text-slate-500">
                  {feedback.attempt.isCheck ? 'Это шах, но король уходит' : 'Ищите дальше'}
                </p>
              </div>
            )}
            {feedback?.kind === 'mate' && (
              <div className="animate-pop rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-4">
                <p className="text-xl font-extrabold text-emerald-600">
                  ✓ Мат! {feedback.attempt.move}
                </p>
                <div className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm text-slate-500">
                  <span>Время: {formatTime(feedback.attempt.elapsedTimeMs)}</span>
                  <span>Попыток: {feedback.attempt.attemptNumber}</span>
                  <span>
                    С первой: {feedback.attempt.attemptNumber === 1 ? 'да' : 'нет'}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button onClick={nextPuzzle} autoFocus className="btn-primary px-8 py-3">
                    Следующая →
                  </button>
                  <button
                    onClick={() => setReviewing((v) => !v)}
                    className="btn-ghost px-6 py-3 text-sm"
                  >
                    {reviewing ? 'Скрыть разбор' : 'Разбор попыток'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {reviewing && attempts.length > 0 && (
            <div className="mt-4">
              <AttemptList attempts={attempts} />
            </div>
          )}
        </div>

        {/* Счётчик попыток виден всегда: ошибки не скрываются, но и не пугают. */}
        {!solved && attempts.length > 0 && (
          <p className="mt-3 text-center text-sm text-slate-500">
            Попыток: {attempts.length} · продолжайте искать мат
          </p>
        )}

        <div className="mt-6 flex justify-center gap-4 text-sm">
          <button onClick={nextPuzzle} className="text-slate-500 hover:underline">
            Пропустить задачу
          </button>
          <Link href="/chess" className="text-slate-500 hover:underline">
            Выйти
          </Link>
        </div>
      </main>
    </div>
  );
}

function SessionResults({
  total,
  solved,
  firstTry,
  xp,
  times,
  onHome,
}: {
  total: number;
  solved: number;
  firstTry: number;
  xp: number;
  times: Record<number, number>;
  onHome: () => void;
}) {
  const values = Object.entries(times);
  const fastest = values.sort((a, b) => a[1] - b[1])[0];
  const slowest = values[values.length - 1];
  const average =
    values.length === 0 ? 0 : values.reduce((sum, [, ms]) => sum + ms, 0) / values.length;

  return (
    <div className="min-h-dvh">
      <Hud />
      <main className="mx-auto w-full max-w-lg px-4 pb-16 pt-10 sm:px-6">
        <div className="panel animate-pop p-7 text-center">
          <p className="text-5xl" aria-hidden>
            ♟️
          </p>
          <h1 className="mt-3 text-2xl font-extrabold">Сессия завершена</h1>
          <p className="mt-2 text-4xl font-extrabold">
            {solved} / {total}
          </p>

          <dl className="mt-6 grid grid-cols-2 gap-2 text-left text-sm">
            <Row label="С первой попытки" value={`${firstTry} из ${total}`} />
            <Row
              label="Точность с первой"
              value={`${solved === 0 ? 0 : Math.round((firstTry / solved) * 100)}%`}
            />
            <Row label="Среднее время" value={formatTime(average)} />
            <Row label="Заработано" value={`+${xp} XP`} />
            {fastest && (
              <Row label="Быстрее всего" value={`#${fastest[0]} · ${formatTime(fastest[1])}`} />
            )}
            {slowest && values.length > 1 && (
              <Row label="Дольше всего" value={`#${slowest[0]} · ${formatTime(slowest[1])}`} />
            )}
          </dl>

          <div className="mt-7 flex flex-wrap gap-2">
            <Link href="/chess/play" className="btn-primary flex-1 px-5 py-3 text-center text-sm">
              Ещё сессия
            </Link>
            <Link href="/chess/progress" className="btn-ghost flex-1 px-5 py-3 text-center text-sm">
              Прогресс
            </Link>
            <button onClick={onHome} className="btn-ghost px-5 py-3 text-sm">
              ♟ Шахматы
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-ink-700/40 p-2.5">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-extrabold">{value}</dd>
    </div>
  );
}
