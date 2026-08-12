import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { Chess } from 'chess.js';
import { countMateMoves, tryMove, validatePuzzle } from './engine.ts';
import type { ChessPuzzle } from './types.ts';

const { puzzles } = JSON.parse(
  readFileSync(join(process.cwd(), 'public/data/chess-puzzles.json'), 'utf8'),
) as { puzzles: ChessPuzzle[] };

test('в базе 1000 задач с уникальными id и позициями', () => {
  assert.equal(puzzles.length, 1000);
  assert.equal(new Set(puzzles.map((p) => p.id)).size, 1000, 'дубликаты id');
  assert.equal(new Set(puzzles.map((p) => p.fen)).size, 1000, 'повторяющиеся позиции');
});

test('каждая задача проходит проверку движком', () => {
  // Битая задача до ребёнка дойти не должна: FEN валиден, решение легально
  // и действительно ставит мат. Проверяем всю базу, а не выборку.
  const broken = puzzles.filter((puzzle) => !validatePuzzle(puzzle));
  assert.deepEqual(
    broken.map((p) => `#${p.id} ${p.fen}`),
    [],
  );
});

test('решение ровно одно — задача не допускает разночтений', () => {
  const ambiguous = puzzles.filter((puzzle) => countMateMoves(puzzle.fen) !== 1);
  assert.deepEqual(
    ambiguous.map((p) => `#${p.id}: ${countMateMoves(p.fen)} матов`),
    [],
  );
});

test('записанный SAN совпадает с тем, что выдаёт движок', () => {
  const mismatched = puzzles.filter((puzzle) => {
    const outcome = tryMove(puzzle.fen, puzzle.from, puzzle.to);
    return outcome.san !== puzzle.solutionSan;
  });
  assert.deepEqual(mismatched.map((p) => `#${p.id}`), []);
});

test('решающая сторона не стоит под шахом', () => {
  // Иначе почти любой ход ребёнка отклоняется из-за защиты короля, и он не
  // понимает, почему верный с виду ход не проходит.
  const inCheck = puzzles.filter((puzzle) => new Chess(puzzle.fen).isCheck());
  assert.deepEqual(inCheck.map((p) => `#${p.id} ${p.fen}`), []);
});

test('превращений пешки в базе нет — интерфейс их не спрашивает', () => {
  const promotions = puzzles.filter((puzzle) => puzzle.solutionSan.includes('='));
  assert.deepEqual(promotions.map((p) => `#${p.id}`), []);
});

test('на каждом уровне хватает задач для многих сессий', () => {
  const counts = puzzles.reduce<Record<number, number>>((acc, puzzle) => {
    acc[puzzle.difficulty] = (acc[puzzle.difficulty] ?? 0) + 1;
    return acc;
  }, {});
  for (const level of [1, 2, 3]) {
    assert.ok(counts[level] >= 250, `уровень ${level}: всего ${counts[level]} задач`);
  }
});

test('уровни различаются по существу, а не только по числу ходов', () => {
  const average = (level: number, get: (p: ChessPuzzle) => number) => {
    const subset = puzzles.filter((p) => p.difficulty === level);
    return subset.reduce((sum, p) => sum + get(p), 0) / subset.length;
  };

  // Густота доски — главное, что отличает трудную задачу от лёгкой. Раньше
  // фигур на всех уровнях было поровну, и «сложные» были такими лишь на бумаге.
  for (const metric of ['pieces', 'legalMoves', 'falseChecks'] as const) {
    assert.ok(
      average(1, (p) => p[metric]) < average(2, (p) => p[metric]),
      `${metric}: уровень 1 должен быть проще второго`,
    );
    assert.ok(
      average(2, (p) => p[metric]) < average(3, (p) => p[metric]),
      `${metric}: уровень 2 должен быть проще третьего`,
    );
  }

  assert.ok(average(3, (p) => p.pieces) >= 12, 'на сложном уровне доска должна быть густой');
  assert.ok(average(3, (p) => p.falseChecks) >= 3, 'нужны ложные шахи, иначе мат виден сразу');
});

test('поля густоты и ложных шахов заполнены у каждой задачи', () => {
  const broken = puzzles.filter(
    (p) => typeof p.pieces !== 'number' || typeof p.falseChecks !== 'number',
  );
  assert.deepEqual(broken.map((p) => `#${p.id}`), []);
});
