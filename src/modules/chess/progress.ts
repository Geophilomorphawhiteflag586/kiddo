/**
 * Чистый слой прогресса Chess.
 *
 * Главное отличие от других модулей: сохраняется не «решено / не решено», а
 * весь ход мысли — каждая попытка со временем и результатом. Именно по этим
 * данным потом видно, думал ребёнок или перебирал ходы наугад.
 */
import { CHESS_XP } from './config.ts';
import type {
  ChessAttempt,
  ChessProgress,
  ChessStats,
  MoveOutcome,
  PuzzleRecord,
} from './types.ts';

export function emptyChessProgress(): ChessProgress {
  return { puzzles: {}, streak: 0, bestStreak: 0 };
}

/** Дополняет частичные данные из более старой версии store. */
export function normalizeChessProgress(raw: Partial<ChessProgress> | undefined): ChessProgress {
  const base = emptyChessProgress();
  if (!raw) return base;
  for (const [id, record] of Object.entries(raw.puzzles ?? {})) {
    const puzzleId = Number(id);
    if (!Number.isFinite(puzzleId) || !record || typeof record !== 'object') continue;
    base.puzzles[puzzleId] = {
      puzzleId,
      solved: Boolean(record.solved),
      solvedFirstTry: Boolean(record.solvedFirstTry),
      attempts: Array.isArray(record.attempts) ? record.attempts : [],
      startedAt: typeof record.startedAt === 'string' ? record.startedAt : '',
      completedAt: typeof record.completedAt === 'string' ? record.completedAt : null,
      timeSpentMs: typeof record.timeSpentMs === 'number' ? record.timeSpentMs : 0,
    };
  }
  base.streak = typeof raw.streak === 'number' ? raw.streak : 0;
  base.bestStreak = typeof raw.bestStreak === 'number' ? raw.bestStreak : 0;
  return base;
}

export function startPuzzle(
  progress: ChessProgress,
  puzzleId: number,
  now = Date.now(),
): ChessProgress {
  // Повторное открытие решённой задачи историю не стирает.
  if (progress.puzzles[puzzleId]) return progress;
  const record: PuzzleRecord = {
    puzzleId,
    solved: false,
    solvedFirstTry: false,
    attempts: [],
    startedAt: new Date(now).toISOString(),
    completedAt: null,
    timeSpentMs: 0,
  };
  return { ...progress, puzzles: { ...progress.puzzles, [puzzleId]: record } };
}

export interface AttemptResultSummary {
  progress: ChessProgress;
  attempt: ChessAttempt;
  xpGained: number;
  justSolved: boolean;
}

/**
 * Записывает попытку. Задача не закрывается на ошибке: ребёнок продолжает
 * искать мат, а все промежуточные ходы остаются в истории.
 */
export function recordAttempt(
  progress: ChessProgress,
  puzzleId: number,
  from: string,
  to: string,
  outcome: MoveOutcome,
  now = Date.now(),
): AttemptResultSummary {
  const withPuzzle = startPuzzle(progress, puzzleId, now);
  const record = withPuzzle.puzzles[puzzleId];
  const startedMs = Date.parse(record.startedAt) || now;
  const previous = record.attempts[record.attempts.length - 1];
  const previousMs = previous ? Date.parse(previous.at) : startedMs;

  const attempt: ChessAttempt = {
    attemptNumber: record.attempts.length + 1,
    from,
    to,
    piece: outcome.piece,
    move: outcome.san,
    legality: outcome.legality,
    result: outcome.result,
    reason: outcome.reason,
    isCheck: outcome.isCheck,
    isCheckmate: outcome.isCheckmate,
    at: new Date(now).toISOString(),
    elapsedTimeMs: Math.max(0, now - startedMs),
    timeSincePreviousAttemptMs: Math.max(0, now - previousMs),
  };

  const solved = outcome.result === 'checkmate';
  // «С первой попытки» — ключевой показатель качества мышления.
  const solvedFirstTry = solved && attempt.attemptNumber === 1;
  const justSolved = solved && !record.solved;

  const nextRecord: PuzzleRecord = {
    ...record,
    attempts: [...record.attempts, attempt],
    solved: record.solved || solved,
    solvedFirstTry: record.solvedFirstTry || solvedFirstTry,
    completedAt: record.completedAt ?? (solved ? attempt.at : null),
    timeSpentMs: solved && !record.solved ? attempt.elapsedTimeMs : record.timeSpentMs,
  };

  const streak = justSolved ? (solvedFirstTry ? withPuzzle.streak + 1 : 0) : withPuzzle.streak;

  return {
    progress: {
      puzzles: { ...withPuzzle.puzzles, [puzzleId]: nextRecord },
      streak,
      bestStreak: Math.max(withPuzzle.bestStreak, streak),
    },
    attempt,
    xpGained: justSolved ? CHESS_XP.solved + (solvedFirstTry ? CHESS_XP.firstTryBonus : 0) : 0,
    justSolved,
  };
}

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[middle - 1] + sorted[middle]) / 2) : sorted[middle];
};

/**
 * Сводка для экрана прогресса. Медиана считается наравне со средним: пара
 * задач, на которых ребёнок отвлёкся на десять минут, иначе искажает картину.
 */
export function summarize(progress: ChessProgress): ChessStats {
  const records = Object.values(progress.puzzles);
  const solvedRecords = records.filter((record) => record.solved);

  let illegalMoves = 0;
  let legalNonMateMoves = 0;
  let checkmates = 0;

  for (const record of records) {
    for (const attempt of record.attempts) {
      if (attempt.result === 'illegal_move') illegalMoves += 1;
      else if (attempt.result === 'legal_not_mate') legalNonMateMoves += 1;
      else checkmates += 1;
    }
  }

  const times = solvedRecords.map((record) => record.timeSpentMs).filter((ms) => ms > 0);
  const firstTry = solvedRecords.filter((record) => record.solvedFirstTry).length;

  return {
    solved: solvedRecords.length,
    attempted: records.length,
    solvedFirstTry: firstTry,
    firstTryAccuracy: solvedRecords.length === 0 ? 0 : firstTry / solvedRecords.length,
    averageAttempts:
      solvedRecords.length === 0
        ? 0
        : solvedRecords.reduce((sum, r) => sum + r.attempts.length, 0) / solvedRecords.length,
    averageTimeMs:
      times.length === 0 ? 0 : Math.round(times.reduce((a, b) => a + b, 0) / times.length),
    medianTimeMs: median(times),
    fastestMs: times.length === 0 ? null : Math.min(...times),
    slowestMs: times.length === 0 ? null : Math.max(...times),
    illegalMoves,
    legalNonMateMoves,
    checkmates,
    bestStreak: progress.bestStreak,
  };
}

/** Задачи, на которых ребёнок буксовал дольше всего — для родителя. */
export function hardestPuzzles(progress: ChessProgress, limit = 5): PuzzleRecord[] {
  return Object.values(progress.puzzles)
    .filter((record) => record.solved)
    .sort((a, b) => b.attempts.length - a.attempts.length || b.timeSpentMs - a.timeSpentMs)
    .slice(0, limit);
}

/**
 * Следующая порция задач: нерешённые по порядку внутри выбранного уровня.
 *
 * Уровень обязателен как явный список id — иначе сессия всегда выдаёт начало
 * базы, а это самые лёгкие позиции во всей тысяче.
 */
export function nextPuzzleIds(
  progress: ChessProgress,
  available: readonly number[],
  count: number,
): number[] {
  const unsolved = available.filter((id) => !progress.puzzles[id]?.solved);
  if (unsolved.length >= count) return unsolved.slice(0, count);
  // Всё решено — добираем уже пройденными для повторения.
  return [...unsolved, ...available.filter((id) => progress.puzzles[id]?.solved)].slice(0, count);
}
