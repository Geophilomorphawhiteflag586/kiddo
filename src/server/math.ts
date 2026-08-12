/**
 * Серверная валидация математических ответов.
 *
 * Клиент присылает только операнды, свой ответ и затраченное время. Сервер сам
 * вычисляет `a + b` и сам решает, верен ли ответ, — присланный клиентом вердикт
 * игнорируется. Время ответа клампится, слишком быстрые ответы помечаются
 * подозрительными; серверное время записи ставит сам сервер.
 */
import type { DatabaseSync } from 'node:sqlite';
import { LEVELS, LEVEL_META, SUSPICIOUS_MS } from '../modules/mathematics/config.ts';
import type { AdditionLevel } from '../modules/mathematics/types.ts';
import { RepoError } from './repo.ts';

export interface IncomingMathAnswer {
  operandA: number;
  operandB: number;
  userAnswer: number;
  responseTimeMs: number;
}

export interface MathSyncResult {
  accepted: number;
  rejected: number;
  correct: number;
  wrong: number;
  suspicious: number;
  stats: { solved: number; correct: number; wrong: number; avgMs: number | null };
}

const MAX_BATCH = 200;
const MAX_MS = 300_000;

const isLevel = (value: unknown): value is AdditionLevel =>
  typeof value === 'string' && (LEVELS as string[]).includes(value);

/** Операнд должен попадать в диапазон своего уровня — иначе ответ не засчитывается. */
function validOperand(value: unknown, level: AdditionLevel): value is number {
  const { min, max } = LEVEL_META[level];
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

export function recordMathAnswers(
  db: DatabaseSync,
  userId: string,
  level: unknown,
  answers: unknown,
): MathSyncResult {
  if (!isLevel(level)) throw new RepoError(400, 'Неизвестный уровень');
  if (!Array.isArray(answers)) throw new RepoError(400, 'Нужен массив ответов');
  if (answers.length > MAX_BATCH) throw new RepoError(400, 'Слишком много ответов за раз');

  const now = new Date().toISOString();
  let accepted = 0;
  let rejected = 0;
  let correct = 0;
  let wrong = 0;
  let suspicious = 0;
  let totalMs = 0;

  const insert = db.prepare(
    `INSERT INTO math_answers
       (user_id, operation, level, operand_a, operand_b, user_answer, is_correct,
        response_time_ms, suspicious, answered_at)
     VALUES (?, 'addition', ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  db.exec('BEGIN');
  try {
    for (const raw of answers as IncomingMathAnswer[]) {
      if (
        !raw ||
        typeof raw !== 'object' ||
        !validOperand(raw.operandA, level) ||
        !validOperand(raw.operandB, level) ||
        typeof raw.userAnswer !== 'number' ||
        !Number.isFinite(raw.userAnswer)
      ) {
        rejected += 1;
        continue;
      }

      // Правильный ответ считает сервер.
      const isCorrect = Math.trunc(raw.userAnswer) === raw.operandA + raw.operandB;
      const ms =
        typeof raw.responseTimeMs === 'number' && Number.isFinite(raw.responseTimeMs)
          ? Math.max(0, Math.min(MAX_MS, Math.round(raw.responseTimeMs)))
          : MAX_MS;
      const fishy = ms < SUSPICIOUS_MS;

      insert.run(
        userId,
        level,
        raw.operandA,
        raw.operandB,
        Math.trunc(raw.userAnswer),
        isCorrect ? 1 : 0,
        ms,
        fishy ? 1 : 0,
        now,
      );

      accepted += 1;
      totalMs += ms;
      if (isCorrect) correct += 1;
      else wrong += 1;
      if (fishy) suspicious += 1;
    }

    db.prepare(
      `INSERT INTO math_stats (user_id, operation, level, solved, correct, wrong, total_ms, updated_at)
       VALUES (?, 'addition', ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, operation, level) DO UPDATE SET
         solved = solved + excluded.solved,
         correct = correct + excluded.correct,
         wrong = wrong + excluded.wrong,
         total_ms = total_ms + excluded.total_ms,
         updated_at = excluded.updated_at`,
    ).run(userId, level, accepted, correct, wrong, totalMs, now);

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  const row = db
    .prepare(
      "SELECT solved, correct, wrong, total_ms FROM math_stats WHERE user_id = ? AND operation = 'addition' AND level = ?",
    )
    .get(userId, level) as
    | { solved: number; correct: number; wrong: number; total_ms: number }
    | undefined;

  return {
    accepted,
    rejected,
    correct,
    wrong,
    suspicious,
    stats: {
      solved: row?.solved ?? 0,
      correct: row?.correct ?? 0,
      wrong: row?.wrong ?? 0,
      avgMs: row && row.solved > 0 ? Math.round(row.total_ms / row.solved) : null,
    },
  };
}
