import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LEVELS, LEVEL_META, SESSION_LENGTH } from './config.ts';
import {
  carryCount,
  checkAnswer,
  generateAdditionProblem,
  generateSession,
  pickDifficulty,
  tasksFromMistakes,
  toTask,
} from './generator.ts';
import type { AdditionLevel } from './types.ts';

/** Детерминированный ГПСЧ, чтобы тесты не мигали. */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('переносы через разряд считаются верно', () => {
  assert.equal(carryCount(23, 41), 0);
  assert.equal(carryCount(47, 28), 1);
  assert.equal(carryCount(68, 57), 2);
  assert.equal(carryCount(3, 5), 0);
  assert.equal(carryCount(7, 8), 1);
});

test('операнды всегда попадают в диапазон своего уровня', () => {
  const rng = seeded(1);
  for (const level of LEVELS) {
    const { min, max } = LEVEL_META[level];
    for (let i = 0; i < 100; i++) {
      const problem = generateAdditionProblem(level, 'medium', rng);
      assert.ok(problem.operandA >= min && problem.operandA <= max, `${level}: A вне диапазона`);
      assert.ok(problem.operandB >= min && problem.operandB <= max, `${level}: B вне диапазона`);
      assert.equal(problem.answer, problem.operandA + problem.operandB);
      assert.equal(problem.level, level);
      assert.equal(problem.operation, 'addition');
    }
  }
});

test('сложность управляемая: лёгкие без переноса, сложные с переносами', () => {
  const rng = seeded(7);
  for (const level of ['double_digit', 'triple_digit'] as AdditionLevel[]) {
    for (let i = 0; i < 50; i++) {
      const easy = generateAdditionProblem(level, 'easy', rng);
      assert.equal(carryCount(easy.operandA, easy.operandB), 0, `${level}: лёгкий с переносом`);

      const hard = generateAdditionProblem(level, 'hard', rng);
      assert.ok(
        carryCount(hard.operandA, hard.operandB) >= 2,
        `${level}: сложный без двух переносов`,
      );
    }
  }
});

test('однозначные: лёгкие в пределах десятка, сложные — большие слагаемые', () => {
  const rng = seeded(11);
  for (let i = 0; i < 50; i++) {
    const easy = generateAdditionProblem('single_digit', 'easy', rng);
    assert.ok(easy.answer <= 9, `лёгкий однозначный дал перенос: ${easy.answer}`);

    const hard = generateAdditionProblem('single_digit', 'hard', rng);
    assert.ok(hard.operandA >= 6 && hard.operandB >= 6, 'сложный однозначный слишком простой');
  }
});

test('новичку достаются в основном лёгкие примеры, мастеру — сложные', () => {
  const rng = seeded(3);
  const count = (mastery: number, wanted: string) => {
    let n = 0;
    for (let i = 0; i < 400; i++) if (pickDifficulty(mastery, rng) === wanted) n += 1;
    return n;
  };
  assert.ok(count(0, 'easy') > 200, 'новичку мало лёгких');
  assert.ok(count(95, 'hard') > 100, 'мастеру мало сложных');
  assert.ok(count(95, 'easy') < count(0, 'easy'), 'доля лёгких должна падать');
});

test('в сессии нужное число задач и нет повторов пар', () => {
  const rng = seeded(5);
  const tasks = generateSession('double_digit', 40, SESSION_LENGTH, rng);
  assert.equal(tasks.length, SESSION_LENGTH);
  const keys = tasks.map(
    (t) => `${Math.min(t.operandA, t.operandB)}+${Math.max(t.operandA, t.operandB)}`,
  );
  assert.equal(new Set(keys).size, keys.length, 'в сессии есть одинаковые примеры');
});

test('однозначный уровень не зависает из-за нехватки уникальных пар', () => {
  const rng = seeded(9);
  const tasks = generateSession('single_digit', 50, 60, rng);
  assert.equal(tasks.length, 60);
});

test('задача, уходящая в UI, не содержит правильного ответа', () => {
  const problem = generateAdditionProblem('double_digit', 'medium', seeded(2));
  const task = toTask(problem);
  assert.ok(!('answer' in task), 'ответ утёк в UI-задачу');
  assert.equal(task.operandA, problem.operandA);
});

test('проверка ответа пересчитывает сумму из операндов', () => {
  const task = toTask(generateAdditionProblem('double_digit', 'medium', seeded(4)));
  const right = checkAnswer(task, task.operandA + task.operandB);
  assert.equal(right.isCorrect, true);
  assert.equal(right.correctAnswer, task.operandA + task.operandB);
  assert.equal(checkAnswer(task, task.operandA + task.operandB + 1).isCorrect, false);
});

test('режим работы над ошибками повторяет те же примеры', () => {
  const mistakes = [
    { operandA: 47, operandB: 28 },
    { operandA: 63, operandB: 19 },
  ];
  const tasks = tasksFromMistakes('double_digit', mistakes);
  assert.equal(tasks.length, 2);
  assert.deepEqual(
    tasks.map((t) => [t.operandA, t.operandB]),
    [
      [47, 28],
      [63, 19],
    ],
  );
});
