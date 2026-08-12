import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { createDb } from './db.ts';
import { recordMathAnswers } from './math.ts';
import { RepoError, registerUser } from './repo.ts';

const dir = mkdtempSync(join(tmpdir(), 'mapapp-math-'));
const db = createDb(join(dir, 'math.db'));
const user = registerUser(db, 'MathTester', null);

after(() => {
  try {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* Windows держит WAL-файлы — для теста не важно */
  }
});

test('сервер сам определяет правильность и не верит клиенту', () => {
  const result = recordMathAnswers(db, user.userId, 'double_digit', [
    // Клиент мог бы объявить это верным — сервер считает 47 + 28 сам.
    { operandA: 47, operandB: 28, userAnswer: 73, responseTimeMs: 3000, isCorrect: true },
    { operandA: 47, operandB: 28, userAnswer: 75, responseTimeMs: 2000 },
  ] as never);

  assert.equal(result.accepted, 2);
  assert.equal(result.correct, 1);
  assert.equal(result.wrong, 1);

  const rows = db
    .prepare('SELECT user_answer, is_correct FROM math_answers ORDER BY id')
    .all() as unknown as Array<{ user_answer: number; is_correct: number }>;
  assert.equal(rows[0].is_correct, 0, 'подделанный вердикт клиента проигнорирован');
  assert.equal(rows[1].is_correct, 1);
});

test('операнды вне диапазона уровня отбрасываются', () => {
  const result = recordMathAnswers(db, user.userId, 'single_digit', [
    { operandA: 3, operandB: 5, userAnswer: 8, responseTimeMs: 1200 },
    { operandA: 47, operandB: 28, userAnswer: 75, responseTimeMs: 1200 }, // не однозначные
    { operandA: 1.5, operandB: 2, userAnswer: 3, responseTimeMs: 1000 },
    null,
  ] as never);

  assert.equal(result.accepted, 1);
  assert.equal(result.rejected, 3);
  assert.equal(result.correct, 1);
});

test('подозрительно быстрые ответы помечаются', () => {
  const result = recordMathAnswers(db, user.userId, 'triple_digit', [
    { operandA: 234, operandB: 157, userAnswer: 391, responseTimeMs: 20 },
  ]);
  assert.equal(result.suspicious, 1);

  const row = db
    .prepare("SELECT suspicious FROM math_answers WHERE level = 'triple_digit'")
    .get() as { suspicious: number };
  assert.equal(row.suspicious, 1);
});

test('статистика накапливается между сессиями', () => {
  const before = recordMathAnswers(db, user.userId, 'double_digit', [
    { operandA: 10, operandB: 20, userAnswer: 30, responseTimeMs: 1500 },
  ]);
  const after2 = recordMathAnswers(db, user.userId, 'double_digit', [
    { operandA: 11, operandB: 22, userAnswer: 33, responseTimeMs: 1500 },
  ]);
  assert.equal(after2.stats.solved, before.stats.solved + 1);
  assert.ok(after2.stats.avgMs !== null && after2.stats.avgMs > 0);
});

test('мусорный вход не проходит', () => {
  assert.throws(() => recordMathAnswers(db, user.userId, 'quadruple', []), RepoError);
  assert.throws(() => recordMathAnswers(db, user.userId, 'single_digit', 'нет' as never), RepoError);
  assert.throws(
    () => recordMathAnswers(db, user.userId, 'single_digit', new Array(500).fill({})),
    RepoError,
  );
});

test('время ответа клампится, серверный timestamp проставляется сам', () => {
  recordMathAnswers(db, user.userId, 'single_digit', [
    { operandA: 4, operandB: 4, userAnswer: 8, responseTimeMs: 10_000_000 },
  ]);
  const row = db
    .prepare('SELECT response_time_ms, answered_at FROM math_answers ORDER BY id DESC LIMIT 1')
    .get() as { response_time_ms: number; answered_at: string };
  assert.equal(row.response_time_ms, 300_000);
  assert.ok(row.answered_at.startsWith('20'), 'серверная дата записана');
});
