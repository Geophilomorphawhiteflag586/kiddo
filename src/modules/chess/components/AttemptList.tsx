'use client';

import { ILLEGAL_MESSAGES } from '../config.ts';
import type { ChessAttempt } from '../types.ts';

const seconds = (ms: number) => `${(ms / 1000).toFixed(0)} сек`;

/**
 * История попыток — главное, чем Chess отличается от обычного квиза:
 * видно не только «решил», но и как именно ребёнок искал мат.
 */
export default function AttemptList({
  attempts,
  showTimings = true,
}: {
  attempts: ChessAttempt[];
  showTimings?: boolean;
}) {
  if (attempts.length === 0) {
    return <p className="text-sm text-slate-400">Попыток пока не было.</p>;
  }

  return (
    <ol className="space-y-1.5">
      {attempts.map((attempt) => {
        const tone =
          attempt.result === 'checkmate'
            ? 'border-emerald-400/40 bg-emerald-500/10'
            : attempt.result === 'illegal_move'
              ? 'border-amber-400/40 bg-amber-400/10'
              : 'border-line bg-ink-900';

        return (
          <li
            key={attempt.attemptNumber}
            className={`flex items-center gap-3 rounded-lg border p-2.5 text-sm ${tone}`}
          >
            <span className="w-5 text-center font-bold text-slate-500">
              {attempt.attemptNumber}
            </span>
            <span className="w-24 font-extrabold tabular-nums">{attempt.move}</span>
            <span className="min-w-0 flex-1 text-xs">
              {attempt.result === 'checkmate' && (
                <span className="font-bold text-emerald-300">Мат</span>
              )}
              {attempt.result === 'illegal_move' && (
                <span className="font-bold text-amber-300">
                  {ILLEGAL_MESSAGES[attempt.reason ?? 'not_a_move'].title}
                </span>
              )}
              {attempt.result === 'legal_not_mate' && (
                <span className="text-slate-400">
                  Ход возможен, но мата нет{attempt.isCheck ? ' (шах)' : ''}
                </span>
              )}
            </span>
            {showTimings && (
              <span className="shrink-0 text-right text-xs text-slate-500">
                +{seconds(attempt.timeSincePreviousAttemptMs)}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
