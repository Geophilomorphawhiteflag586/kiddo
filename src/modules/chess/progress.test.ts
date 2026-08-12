import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boardFromFen, pieceAt, sideToMove, tryMove } from './engine.ts';
import {
  emptyChessProgress,
  hardestPuzzles,
  nextPuzzleIds,
  normalizeChessProgress,
  recordAttempt,
  startPuzzle,
  summarize,
} from './progress.ts';
import type { ChessProgress } from './types.ts';

/** Классическая позиция мата на последней горизонтали: решение Ra8#. */
const BACK_RANK = '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1';
const NOW = Date.UTC(2026, 7, 11, 10);
const SEC = 1000;

/* -------------------------------- движок --------------------------------- */

test('движок различает три исхода хода', () => {
  const mate = tryMove(BACK_RANK, 'a1', 'a8');
  assert.equal(mate.result, 'checkmate');
  assert.equal(mate.legality, 'legal');
  assert.equal(mate.san, 'Ra8#');
  assert.equal(mate.isCheckmate, true);

  const legal = tryMove(BACK_RANK, 'a1', 'a7');
  assert.equal(legal.result, 'legal_not_mate');
  assert.equal(legal.legality, 'legal');
  assert.equal(legal.isCheckmate, false);

  const illegal = tryMove(BACK_RANK, 'a1', 'b8');
  assert.equal(illegal.result, 'illegal_move');
  assert.equal(illegal.legality, 'illegal');
  assert.equal(illegal.piece, 'r', 'фигуру всё равно определяем');
});

test('причина отказа называется честно, а не «так фигура не ходит»', () => {
  // Белый король g6 под шахом от пешки h7. Ферзь h4 геометрически достаёт
  // до d8, но ход запрещён, потому что не спасает короля.
  const inCheck = '6k1/2p4p/6K1/2B5/7Q/8/8/8 w - - 0 1';
  const outcome = tryMove(inCheck, 'h4', 'd8');
  assert.equal(outcome.result, 'illegal_move');
  assert.equal(outcome.reason, 'in_check', 'ферзь так ходит — дело в шахе');

  // А вот это действительно не ход ферзя.
  assert.equal(tryMove(inCheck, 'h4', 'g7').reason, 'not_a_move');
});

test('ход на своё же поле объясняется отдельно', () => {
  // Ладья a1 и король g1 — своя фигура на пути.
  const outcome = tryMove(BACK_RANK, 'a1', 'g1');
  assert.equal(outcome.reason, 'own_piece');
});

test('связанная фигура: ход возможен, но открывает короля', () => {
  // Белая ладья e2 связана чёрным ферзём e8 по вертикали.
  const pinned = '4q1k1/8/8/8/8/8/4R3/4K3 w - - 0 1';
  const outcome = tryMove(pinned, 'e2', 'a2');
  assert.equal(outcome.result, 'illegal_move');
  assert.equal(outcome.reason, 'exposes_king');
});

test('пешка: ход вперёд и взятие различаются', () => {
  const position = '6k1/8/8/8/8/3p4/4P3/4K3 w - - 0 1';
  assert.equal(tryMove(position, 'e2', 'e3').result, 'legal_not_mate', 'ход на одну');
  assert.equal(tryMove(position, 'e2', 'e4').result, 'legal_not_mate', 'ход на две');
  assert.equal(tryMove(position, 'e2', 'd3').result, 'legal_not_mate', 'взятие по диагонали');
  assert.equal(tryMove(position, 'e2', 'f3').reason, 'not_a_move', 'по диагонали без взятия');
});

test('шах без мата — это отдельный случай, а не победа', () => {
  // Ход королём под шах невозможен, а ладья на a7 шаха не даёт.
  const outcome = tryMove('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', 'a1', 'a7');
  assert.equal(outcome.isCheck, false);
  assert.equal(outcome.result, 'legal_not_mate');
});

test('ход чужой фигурой невозможен', () => {
  const outcome = tryMove(BACK_RANK, 'g8', 'g7');
  assert.equal(outcome.result, 'illegal_move');
});

test('доска и вспомогательные функции читают FEN', () => {
  const board = boardFromFen(BACK_RANK);
  assert.equal(board.length, 64);
  assert.equal(board[0].square, 'a8', 'первая клетка — верхний левый угол');
  assert.equal(sideToMove(BACK_RANK), 'w');
  assert.deepEqual(pieceAt(BACK_RANK, 'a1'), { piece: 'r', color: 'w' });
  assert.equal(pieceAt(BACK_RANK, 'd4'), null);
});

/* ------------------------------- попытки --------------------------------- */

test('верный ход с первой попытки закрывает задачу и даёт бонус', () => {
  const started = startPuzzle(emptyChessProgress(), 1, NOW);
  const result = recordAttempt(
    started,
    1,
    'a1',
    'a8',
    tryMove(BACK_RANK, 'a1', 'a8'),
    NOW + 8 * SEC,
  );

  const record = result.progress.puzzles[1];
  assert.equal(record.solved, true);
  assert.equal(record.solvedFirstTry, true);
  assert.equal(record.timeSpentMs, 8 * SEC);
  assert.equal(result.attempt.attemptNumber, 1);
  assert.ok(result.xpGained > 10, 'за первую попытку начисляется бонус');
});

test('ошибка не закрывает задачу и не отнимает XP', () => {
  let progress = startPuzzle(emptyChessProgress(), 1, NOW);
  const wrong = recordAttempt(
    progress,
    1,
    'a1',
    'a7',
    tryMove(BACK_RANK, 'a1', 'a7'),
    NOW + 5 * SEC,
  );
  progress = wrong.progress;

  assert.equal(wrong.xpGained, 0, 'за ошибку ничего не снимается и не даётся');
  assert.equal(progress.puzzles[1].solved, false, 'задача остаётся открытой');
  assert.equal(progress.puzzles[1].attempts.length, 1);

  const right = recordAttempt(
    progress,
    1,
    'a1',
    'a8',
    tryMove(BACK_RANK, 'a1', 'a8'),
    NOW + 20 * SEC,
  );
  assert.equal(right.progress.puzzles[1].solved, true);
  assert.equal(right.progress.puzzles[1].solvedFirstTry, false, 'уже не с первой попытки');
  assert.equal(right.xpGained, 10, 'без бонуса за первую попытку');
});

test('история сохраняет весь ход мысли с таймингами', () => {
  let progress = startPuzzle(emptyChessProgress(), 7, NOW);
  const steps: Array<[string, string, number]> = [
    ['a1', 'a7', 32],
    ['a1', 'b8', 51],
    ['a1', 'a8', 68],
  ];
  for (const [from, to, second] of steps) {
    progress = recordAttempt(
      progress,
      7,
      from,
      to,
      tryMove(BACK_RANK, from, to),
      NOW + second * SEC,
    ).progress;
  }

  const attempts = progress.puzzles[7].attempts;
  assert.equal(attempts.length, 3);
  assert.deepEqual(
    attempts.map((a) => a.result),
    ['legal_not_mate', 'illegal_move', 'checkmate'],
  );
  assert.deepEqual(
    attempts.map((a) => a.attemptNumber),
    [1, 2, 3],
  );
  assert.equal(attempts[0].elapsedTimeMs, 32 * SEC, 'время от начала задачи');
  assert.equal(attempts[1].timeSincePreviousAttemptMs, 19 * SEC, 'пауза между попытками');
  assert.equal(attempts[2].timeSincePreviousAttemptMs, 17 * SEC);
});

test('повторное открытие решённой задачи не стирает историю', () => {
  const solved = recordAttempt(
    startPuzzle(emptyChessProgress(), 1, NOW),
    1,
    'a1',
    'a8',
    tryMove(BACK_RANK, 'a1', 'a8'),
    NOW + SEC,
  ).progress;

  const reopened = startPuzzle(solved, 1, NOW + 60 * SEC);
  assert.equal(reopened.puzzles[1].attempts.length, 1);
  assert.equal(reopened.puzzles[1].solved, true);
});

test('серия считается только по решённым с первой попытки', () => {
  let progress: ChessProgress = emptyChessProgress();
  for (const id of [1, 2, 3]) {
    progress = recordAttempt(
      startPuzzle(progress, id, NOW),
      id,
      'a1',
      'a8',
      tryMove(BACK_RANK, 'a1', 'a8'),
      NOW + SEC,
    ).progress;
  }
  assert.equal(progress.streak, 3);
  assert.equal(progress.bestStreak, 3);

  // Четвёртая — со второй попытки: серия обнуляется, рекорд остаётся.
  let fourth = startPuzzle(progress, 4, NOW);
  fourth = recordAttempt(fourth, 4, 'a1', 'a7', tryMove(BACK_RANK, 'a1', 'a7'), NOW + SEC).progress;
  fourth = recordAttempt(fourth, 4, 'a1', 'a8', tryMove(BACK_RANK, 'a1', 'a8'), NOW + 2 * SEC)
    .progress;

  assert.equal(fourth.streak, 0);
  assert.equal(fourth.bestStreak, 3);
});

/* ------------------------------- аналитика -------------------------------- */

test('сводка считает точность, попытки и типы ходов', () => {
  let progress = emptyChessProgress();
  // Задача 1 — с первой попытки за 10 секунд.
  progress = recordAttempt(
    startPuzzle(progress, 1, NOW),
    1,
    'a1',
    'a8',
    tryMove(BACK_RANK, 'a1', 'a8'),
    NOW + 10 * SEC,
  ).progress;
  // Задача 2 — с третьей, была невозможная и легальная без мата.
  let second = startPuzzle(progress, 2, NOW);
  second = recordAttempt(second, 2, 'a1', 'b8', tryMove(BACK_RANK, 'a1', 'b8'), NOW + 5 * SEC)
    .progress;
  second = recordAttempt(second, 2, 'a1', 'a7', tryMove(BACK_RANK, 'a1', 'a7'), NOW + 20 * SEC)
    .progress;
  progress = recordAttempt(second, 2, 'a1', 'a8', tryMove(BACK_RANK, 'a1', 'a8'), NOW + 50 * SEC)
    .progress;

  const stats = summarize(progress);
  assert.equal(stats.solved, 2);
  assert.equal(stats.solvedFirstTry, 1);
  assert.equal(stats.firstTryAccuracy, 0.5);
  assert.equal(stats.averageAttempts, 2, '(1 + 3) / 2');
  assert.equal(stats.illegalMoves, 1);
  assert.equal(stats.legalNonMateMoves, 1);
  assert.equal(stats.checkmates, 2);
  assert.equal(stats.fastestMs, 10 * SEC);
  assert.equal(stats.slowestMs, 50 * SEC);
});

test('медиана времени не искажается одной очень долгой задачей', () => {
  let progress = emptyChessProgress();
  for (const [id, seconds] of [
    [1, 10],
    [2, 12],
    [3, 600],
  ] as const) {
    progress = recordAttempt(
      startPuzzle(progress, id, NOW),
      id,
      'a1',
      'a8',
      tryMove(BACK_RANK, 'a1', 'a8'),
      NOW + seconds * SEC,
    ).progress;
  }

  const stats = summarize(progress);
  assert.equal(stats.medianTimeMs, 12 * SEC, 'медиана держится около обычного времени');
  assert.ok(stats.averageTimeMs > 200 * SEC, 'а среднее уезжает — потому и показываем оба');
});

test('самые трудные задачи — те, где было больше попыток', () => {
  let progress = emptyChessProgress();
  progress = recordAttempt(
    startPuzzle(progress, 1, NOW),
    1,
    'a1',
    'a8',
    tryMove(BACK_RANK, 'a1', 'a8'),
    NOW + SEC,
  ).progress;

  let hard = startPuzzle(progress, 2, NOW);
  for (let i = 0; i < 4; i++) {
    hard = recordAttempt(hard, 2, 'a1', 'a7', tryMove(BACK_RANK, 'a1', 'a7'), NOW + i * SEC)
      .progress;
  }
  progress = recordAttempt(hard, 2, 'a1', 'a8', tryMove(BACK_RANK, 'a1', 'a8'), NOW + 9 * SEC)
    .progress;

  assert.equal(hardestPuzzles(progress)[0].puzzleId, 2);
});

test('следующая порция — нерешённые задачи выбранного уровня', () => {
  const pool = [1, 2, 3, 4, 5];
  let progress = emptyChessProgress();
  progress = recordAttempt(
    startPuzzle(progress, 1, NOW),
    1,
    'a1',
    'a8',
    tryMove(BACK_RANK, 'a1', 'a8'),
    NOW + SEC,
  ).progress;

  assert.deepEqual(nextPuzzleIds(progress, pool, 3), [2, 3, 4]);
  // Открытая, но нерешённая задача остаётся в очереди.
  const opened = startPuzzle(progress, 2, NOW);
  assert.deepEqual(nextPuzzleIds(opened, pool, 2), [2, 3]);

  // Выборка не выходит за пределы уровня: чужие id не подмешиваются.
  assert.deepEqual(nextPuzzleIds(progress, [700, 701], 2), [700, 701]);
});

test('когда уровень пройден целиком, задачи идут на повторение', () => {
  let progress = emptyChessProgress();
  for (const id of [1, 2]) {
    progress = recordAttempt(
      startPuzzle(progress, id, NOW),
      id,
      'a1',
      'a8',
      tryMove(BACK_RANK, 'a1', 'a8'),
      NOW + SEC,
    ).progress;
  }
  assert.deepEqual(nextPuzzleIds(progress, [1, 2], 2), [1, 2]);
});

/* ------------------------------- сохранность ------------------------------ */

test('recordAttempt не мутирует исходный прогресс', () => {
  const before = startPuzzle(emptyChessProgress(), 1, NOW);
  const snapshot = JSON.stringify(before);
  recordAttempt(before, 1, 'a1', 'a7', tryMove(BACK_RANK, 'a1', 'a7'), NOW + SEC);
  assert.equal(JSON.stringify(before), snapshot);
});

test('нормализация чинит частичные данные и отбрасывает мусор', () => {
  assert.deepEqual(normalizeChessProgress(undefined), emptyChessProgress());

  const fixed = normalizeChessProgress({
    puzzles: {
      5: { solved: true },
      'не число': { solved: true },
    },
    bestStreak: 4,
  } as never);

  assert.equal(Object.keys(fixed.puzzles).length, 1);
  assert.equal(fixed.puzzles[5].puzzleId, 5);
  assert.deepEqual(fixed.puzzles[5].attempts, [], 'недостающие поля добиты');
  assert.equal(fixed.bestStreak, 4);
});

test('прогресс переживает JSON-сериализацию', () => {
  const progress = recordAttempt(
    startPuzzle(emptyChessProgress(), 1, NOW),
    1,
    'a1',
    'a8',
    tryMove(BACK_RANK, 'a1', 'a8'),
    NOW + SEC,
  ).progress;
  assert.deepEqual(JSON.parse(JSON.stringify(progress)), progress);
});
