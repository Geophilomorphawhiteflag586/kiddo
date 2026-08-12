import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LEVEL_META, MISTAKES_KEPT } from './config.ts';
import { additionMastery, accuracyOf, avgMsOf, masteryOf, masteryPercent } from './mastery.ts';
import {
  applyMathAnswer,
  emptyLevelStats,
  emptyMathProgress,
  normalizeMathProgress,
  totalCorrect,
  totalMistakes,
  xpForAnswer,
} from './progress.ts';
import type { MathTask } from './types.ts';

const NOW = Date.UTC(2026, 7, 11, 10);

function task(operandA: number, operandB: number): MathTask {
  return {
    id: `t-${operandA}-${operandB}`,
    operation: 'addition',
    level: 'double_digit',
    operandA,
    operandB,
    difficulty: 'medium',
  };
}

test('верный ответ увеличивает счётчики и серию', () => {
  const result = applyMathAnswer(emptyMathProgress(), task(47, 28), 75, 2500, NOW);
  const stats = result.progress.addition.double_digit;

  assert.equal(result.isCorrect, true);
  assert.equal(result.correctAnswer, 75);
  assert.equal(stats.solved, 1);
  assert.equal(stats.correct, 1);
  assert.equal(stats.wrong, 0);
  assert.equal(stats.streak, 1);
  assert.equal(stats.bestStreak, 1);
  assert.ok(result.xpGained > 0);
});

test('неверный ответ обнуляет серию и попадает в список ошибок', () => {
  let progress = applyMathAnswer(emptyMathProgress(), task(47, 28), 75, 2000, NOW).progress;
  const result = applyMathAnswer(progress, task(63, 19), 72, 4000, NOW);
  progress = result.progress;
  const stats = progress.addition.double_digit;

  assert.equal(result.isCorrect, false);
  assert.equal(result.correctAnswer, 82);
  assert.equal(result.xpGained, 0, 'за ошибку XP не начисляется');
  assert.equal(stats.wrong, 1);
  assert.equal(stats.streak, 0);
  assert.equal(stats.bestStreak, 1, 'рекорд серии сохранён');
  assert.deepEqual(stats.mistakes[0], {
    operandA: 63,
    operandB: 19,
    userAnswer: 72,
    at: new Date(NOW).toISOString(),
  });
});

test('решённый пример уходит из очереди повторения ошибок', () => {
  let progress = applyMathAnswer(emptyMathProgress(), task(63, 19), 72, 3000, NOW).progress;
  assert.equal(progress.addition.double_digit.mistakes.length, 1);

  progress = applyMathAnswer(progress, task(63, 19), 82, 2000, NOW).progress;
  assert.equal(progress.addition.double_digit.mistakes.length, 0, 'ошибка не исправлена');
});

test('повторная ошибка не дублируется, список ограничен по длине', () => {
  let progress = emptyMathProgress();
  progress = applyMathAnswer(progress, task(63, 19), 72, 3000, NOW).progress;
  progress = applyMathAnswer(progress, task(63, 19), 71, 3000, NOW).progress;
  assert.equal(progress.addition.double_digit.mistakes.length, 1);

  for (let i = 0; i < MISTAKES_KEPT + 10; i++) {
    progress = applyMathAnswer(progress, task(10 + i, 20), 0, 3000, NOW).progress;
  }
  assert.equal(progress.addition.double_digit.mistakes.length, MISTAKES_KEPT);
});

test('уровни независимы друг от друга', () => {
  const progress = applyMathAnswer(emptyMathProgress(), task(47, 28), 75, 2000, NOW).progress;
  assert.equal(progress.addition.double_digit.solved, 1);
  assert.equal(progress.addition.single_digit.solved, 0);
  assert.equal(progress.addition.triple_digit.solved, 0);
});

test('applyMathAnswer не мутирует исходный прогресс', () => {
  const before = emptyMathProgress();
  const snapshot = JSON.stringify(before);
  applyMathAnswer(before, task(47, 28), 73, 2000, NOW);
  assert.equal(JSON.stringify(before), snapshot);
});

test('XP больше за старшие уровни и быстрый ответ', () => {
  assert.ok(xpForAnswer('triple_digit', 2000) > xpForAnswer('single_digit', 2000));
  assert.ok(xpForAnswer('double_digit', 1000) > xpForAnswer('double_digit', 9000));
});

test('нетронутый уровень имеет нулевое освоение', () => {
  const stats = emptyLevelStats();
  assert.equal(masteryPercent(stats, 'single_digit'), 0);
  assert.equal(avgMsOf(stats), null);
  assert.equal(masteryOf(stats, 'single_digit').stage, 'learning');
});

test('сотня задач без точности не даёт освоения', () => {
  // Половина ответов неверна: объём есть, но навыка нет.
  const sloppy = {
    ...emptyLevelStats(),
    solved: 200,
    correct: 100,
    wrong: 100,
    totalMs: 200 * 3000,
  };
  const percent = masteryPercent(sloppy, 'single_digit');
  assert.ok(percent < 60, `слишком высокое освоение при точности 50%: ${percent}`);
  assert.equal(accuracyOf(sloppy), 0.5);
});

test('точность, объём и скорость вместе дают «Освоено»', () => {
  const goal = LEVEL_META.single_digit.goal;
  const strong = {
    ...emptyLevelStats(),
    solved: goal + 10,
    correct: goal + 8,
    wrong: 2,
    totalMs: (goal + 10) * 1500,
  };
  const info = masteryOf(strong, 'single_digit');
  assert.ok(info.percent >= 85, `ожидали освоение, получили ${info.percent}`);
  assert.equal(info.stage, 'mastered');
});

test('освоение сложения взвешено по целям уровней', () => {
  const progress = emptyMathProgress();
  progress.addition.single_digit = {
    ...emptyLevelStats(),
    solved: 100,
    correct: 100,
    wrong: 0,
    totalMs: 100 * 1500,
  };
  const overall = additionMastery(progress);
  assert.ok(overall > 0 && overall < 40, `однозначные — малая доля от всего: ${overall}`);
});

test('нормализация чинит частичные и пустые данные', () => {
  assert.deepEqual(normalizeMathProgress(undefined), emptyMathProgress());

  const partial = normalizeMathProgress({
    addition: {
      single_digit: { solved: 5, correct: 4 },
    },
  } as never);
  assert.equal(partial.addition.single_digit.solved, 5);
  assert.equal(partial.addition.single_digit.wrong, 0, 'недостающие поля добиты');
  assert.deepEqual(partial.addition.single_digit.mistakes, []);
  assert.equal(partial.addition.triple_digit.solved, 0);
});

test('счётчики по всем уровням суммируются', () => {
  let progress = applyMathAnswer(emptyMathProgress(), task(47, 28), 75, 2000, NOW).progress;
  progress = applyMathAnswer(progress, task(63, 19), 0, 2000, NOW).progress;
  assert.equal(totalCorrect(progress), 1);
  assert.equal(totalMistakes(progress), 1);
});
