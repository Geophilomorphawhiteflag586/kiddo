'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import Hud from '@/components/Hud';
import { syncMathSession } from '@/lib/competitive/api';
import { useGame, useHydrated } from '@/lib/store';
import { LEVEL_BY_SLUG, LEVEL_META, SESSION_LENGTH } from '../config.ts';
import { generateSession, tasksFromMistakes } from '../generator.ts';
import { masteryPercent } from '../mastery.ts';
import { normalizeMathProgress } from '../progress.ts';
import type { AdditionLevel, MathTask } from '../types.ts';

/** Задержка перед автопереходом, мс. */
const NEXT_AFTER_CORRECT = 700;
const NEXT_AFTER_WRONG = 3000;

type Phase = 'input' | 'right' | 'wrong';

interface Attempt {
  operandA: number;
  operandB: number;
  userAnswer: number;
  correctAnswer: number;
  isCorrect: boolean;
  responseTimeMs: number;
}

export default function MathSession({ slug }: { slug: string }) {
  const level = LEVEL_BY_SLUG.get(slug);
  const searchParams = useSearchParams();
  const hydrated = useHydrated();
  const profileId = useGame((s) => s.activeProfileId);
  const retryMistakes = searchParams.get('mistakes') === '1';

  if (!level) return null;

  if (!hydrated) {
    return (
      <div className="min-h-dvh">
        <Hud />
        <div className="grid place-items-center py-32 text-slate-400">Готовим примеры…</div>
      </div>
    );
  }

  return (
    <RunningSession
      key={`${profileId}:${slug}:${retryMistakes}`}
      level={level}
      retryMistakes={retryMistakes}
    />
  );
}

/** Собирает задачи: либо новые по текущему освоению, либо разбор ошибок. */
function makeTasks(level: AdditionLevel, retryMistakes: boolean): MathTask[] {
  const state = useGame.getState();
  const math = normalizeMathProgress(state.data[state.activeProfileId]?.math);
  const stats = math.addition[level];

  if (retryMistakes && stats.mistakes.length > 0) {
    return tasksFromMistakes(level, stats.mistakes);
  }
  return generateSession(level, masteryPercent(stats, level), SESSION_LENGTH);
}

function RunningSession({
  level,
  retryMistakes,
}: {
  level: AdditionLevel;
  retryMistakes: boolean;
}) {
  const meta = LEVEL_META[level];
  const submitAnswer = useGame((s) => s.submitMathAnswer);
  const recordSession = useGame((s) => s.recordSession);

  const [tasks, setTasks] = useState<MathTask[]>(() => makeTasks(level, retryMistakes));
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [lastAttempt, setLastAttempt] = useState<Attempt | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [xpGained, setXpGained] = useState(0);
  const [finished, setFinished] = useState(false);

  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const task = tasks[index] ?? null;

  // Новый вопрос — заново отсчитываем время и возвращаем фокус в поле.
  useEffect(() => {
    startedAt.current = Date.now();
    inputRef.current?.focus();
  }, [index, tasks]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Итог сессии: личный рекорд + серверная перепроверка ответов.
  useEffect(() => {
    if (!finished || attempts.length === 0) return;
    const correct = attempts.filter((a) => a.isCorrect).length;
    const totalMs = attempts.reduce((sum, a) => sum + a.responseTimeMs, 0);
    recordSession(`math-addition-${meta.slug}`, {
      correct,
      total: attempts.length,
      avgMs: Math.round(totalMs / attempts.length),
    });
    void syncMathSession(
      level,
      attempts.map((a) => ({
        operandA: a.operandA,
        operandB: a.operandB,
        userAnswer: a.userAnswer,
        responseTimeMs: a.responseTimeMs,
      })),
    ).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ровно один раз по завершении
  }, [finished]);

  const advance = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setValue('');
    setPhase('input');
    setLastAttempt(null);
    if (index + 1 >= tasks.length) setFinished(true);
    else setIndex(index + 1);
  }, [index, tasks.length]);

  const submit = useCallback(() => {
    if (!task) return;
    const raw = value.trim();
    if (raw === '') return;
    const userAnswer = Number.parseInt(raw, 10);
    if (Number.isNaN(userAnswer)) return;

    const responseTimeMs = Date.now() - startedAt.current;
    const result = submitAnswer(task, userAnswer, responseTimeMs);
    const attempt: Attempt = {
      operandA: task.operandA,
      operandB: task.operandB,
      userAnswer,
      correctAnswer: result.correctAnswer,
      isCorrect: result.isCorrect,
      responseTimeMs,
    };

    setAttempts((list) => [...list, attempt]);
    setLastAttempt(attempt);
    setXpGained((xp) => xp + result.xpGained);
    setPhase(result.isCorrect ? 'right' : 'wrong');
    timer.current = setTimeout(
      advance,
      result.isCorrect ? NEXT_AFTER_CORRECT : NEXT_AFTER_WRONG,
    );
  }, [advance, submitAnswer, task, value]);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    // Enter работает и как «ответить», и как «дальше» после разбора ошибки.
    if (phase === 'input') submit();
    else advance();
  };

  const restart = (mode: 'new' | 'mistakes') => {
    if (timer.current) clearTimeout(timer.current);
    const next =
      mode === 'mistakes'
        ? tasksFromMistakes(
            level,
            attempts.filter((a) => !a.isCorrect),
          )
        : makeTasks(level, false);
    setTasks(next);
    setIndex(0);
    setValue('');
    setPhase('input');
    setLastAttempt(null);
    setAttempts([]);
    setXpGained(0);
    setFinished(false);
  };

  if (finished) {
    return (
      <Results
        levelTitle={meta.title}
        levelSlug={meta.slug}
        attempts={attempts}
        xpGained={xpGained}
        onRetryMistakes={() => restart('mistakes')}
        onRestart={() => restart('new')}
      />
    );
  }

  if (!task) {
    return (
      <div className="min-h-dvh">
        <Hud />
        <div className="grid place-items-center py-32 text-center text-slate-400">
          <p>Ошибок для повторения нет.</p>
          <Link href="/math/addition" className="btn-ghost mt-4 px-5 py-2.5 text-sm">
            К уровням
          </Link>
        </div>
      </div>
    );
  }

  const progress = ((index + (phase === 'input' ? 0 : 1)) / tasks.length) * 100;

  return (
    <div className="min-h-dvh">
      <Hud />

      <main className="mx-auto w-full max-w-lg px-4 pb-16 pt-10 sm:px-6">
        <div className="panel p-8 text-center">
          <p className="panel-title">
            Сложение · {meta.title}
            {retryMistakes ? ' · работа над ошибками' : ''}
          </p>

          <p className="mt-8 text-5xl font-extrabold tabular-nums sm:text-6xl">
            {task.operandA} + {task.operandB}
          </p>

          <form onSubmit={onSubmit} className="mt-8">
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, '').slice(0, 5))}
              readOnly={phase !== 'input'}
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              aria-label="Ваш ответ"
              className={`w-40 rounded-xl border-2 bg-ink-950 px-4 py-3 text-center text-3xl font-extrabold tabular-nums outline-none transition ${
                phase === 'right'
                  ? 'border-emerald-400 text-emerald-300'
                  : phase === 'wrong'
                    ? 'border-rose-400 text-rose-300'
                    : 'border-line focus:border-accent'
              }`}
            />
            <div className="mt-4">
              <button type="submit" className="btn-primary px-8 py-2.5">
                {phase === 'input' ? 'OK' : 'Дальше →'}
              </button>
            </div>
          </form>

          <div aria-live="polite" className="mt-6 min-h-20">
            {phase === 'right' && (
              <p className="text-lg font-extrabold text-emerald-400">✅ Верно</p>
            )}
            {phase === 'wrong' && lastAttempt && (
              <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-3">
                <p className="font-extrabold text-rose-300">❌ Неправильно</p>
                <p className="mt-1 text-sm">
                  {lastAttempt.operandA} + {lastAttempt.operandB} ={' '}
                  <span className="font-extrabold text-emerald-300">
                    {lastAttempt.correctAnswer}
                  </span>
                </p>
                <p className="text-sm text-slate-400">Ваш ответ: {lastAttempt.userAnswer}</p>
              </div>
            )}
          </div>

          <p className="mt-4 text-sm text-slate-500">
            Вопрос {index + 1} / {tasks.length}
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{ width: `${progress}%`, background: meta.color }}
            />
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link href="/math/addition" className="text-sm text-slate-500 hover:underline">
            Выйти
          </Link>
        </div>
      </main>
    </div>
  );
}

function Results({
  levelTitle,
  levelSlug,
  attempts,
  xpGained,
  onRetryMistakes,
  onRestart,
}: {
  levelTitle: string;
  levelSlug: string;
  attempts: Attempt[];
  xpGained: number;
  onRetryMistakes: () => void;
  onRestart: () => void;
}) {
  const total = attempts.length;
  const correct = attempts.filter((a) => a.isCorrect).length;
  const mistakes = attempts.filter((a) => !a.isCorrect);
  const accuracy = total === 0 ? 0 : Math.round((correct / total) * 100);
  const avgMs =
    total === 0 ? 0 : attempts.reduce((sum, a) => sum + a.responseTimeMs, 0) / total;

  return (
    <div className="min-h-dvh">
      <Hud />
      <main className="mx-auto w-full max-w-lg px-4 pb-16 pt-10 sm:px-6">
        <div className="panel p-7">
          <p className="panel-title text-center">Сложение · {levelTitle}</p>
          <p className="mt-3 text-center text-4xl font-extrabold">
            {correct} / {total}
          </p>

          <dl className="mt-6 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-line bg-ink-700/40 p-3">
              <dt className="text-xs text-slate-500">Точность</dt>
              <dd className="text-lg font-extrabold">{accuracy}%</dd>
            </div>
            <div className="rounded-xl border border-line bg-ink-700/40 p-3">
              <dt className="text-xs text-slate-500">Среднее время</dt>
              <dd className="text-lg font-extrabold">{(avgMs / 1000).toFixed(1)} сек</dd>
            </div>
            <div className="rounded-xl border border-line bg-ink-700/40 p-3">
              <dt className="text-xs text-slate-500">Ошибки</dt>
              <dd className="text-lg font-extrabold">{mistakes.length}</dd>
            </div>
          </dl>

          <p className="mt-3 text-center text-sm font-bold text-emerald-300">+{xpGained} XP</p>

          {mistakes.length > 0 && (
            <div className="mt-6">
              <p className="panel-title mb-2">Ваши ошибки</p>
              <ul className="space-y-1.5">
                {mistakes.map((m, i) => (
                  <li
                    key={`${m.operandA}-${m.operandB}-${i}`}
                    className="flex items-center gap-3 rounded-lg border border-line bg-ink-900 px-3 py-2 text-sm"
                  >
                    <span className="font-extrabold tabular-nums">
                      {m.operandA} + {m.operandB}
                    </span>
                    <span className="ml-auto text-slate-500">
                      Ваш ответ: <span className="text-rose-300">{m.userAnswer}</span>
                    </span>
                    <span className="text-slate-500">
                      Правильный: <span className="text-emerald-300">{m.correctAnswer}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-7 flex flex-wrap gap-2">
            {mistakes.length > 0 && (
              <button onClick={onRetryMistakes} className="btn-primary flex-1 px-5 py-3 text-sm">
                Повторить ошибки
              </button>
            )}
            <button onClick={onRestart} className="btn-ghost flex-1 px-5 py-3 text-sm">
              Ещё раз
            </button>
            <Link
              href="/math/addition"
              className="btn-ghost px-5 py-3 text-center text-sm"
              aria-label={`К уровням сложения, текущий ${levelSlug}`}
            >
              К уровням
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
