/**
 * Генератор примеров на сложение. Задачи создаются на лету — тысячи заранее
 * заготовленных примеров не хранятся нигде.
 *
 * Случайность управляемая: сложность задаётся числом переносов через разряд,
 * а не просто «любые два числа». Все функции принимают rng, поэтому в тестах
 * генерация детерминирована.
 */
import { DIFFICULTY_MIX, LEVEL_META, SESSION_LENGTH } from './config.ts';
import type { AdditionLevel, MathDifficulty, MathProblem, MathTask } from './types.ts';

export type Rng = () => number;

const randomInt = (rng: Rng, min: number, max: number) =>
  min + Math.floor(rng() * (max - min + 1));

/** Сколько переносов через разряд даёт сложение a + b. */
export function carryCount(a: number, b: number): number {
  let carries = 0;
  let carry = 0;
  let x = a;
  let y = b;
  while (x > 0 || y > 0) {
    const sum = (x % 10) + (y % 10) + carry;
    carry = sum >= 10 ? 1 : 0;
    if (carry) carries += 1;
    x = Math.floor(x / 10);
    y = Math.floor(y / 10);
  }
  return carries;
}

/** Целевое число переносов для уровня и сложности. */
function targetCarries(level: AdditionLevel, difficulty: MathDifficulty): number {
  if (difficulty === 'easy') return 0;
  if (difficulty === 'medium') return 1;
  return level === 'single_digit' ? 1 : level === 'double_digit' ? 2 : 2;
}

/**
 * Один пример заданной сложности. Однозначные числа переносов почти не дают,
 * поэтому там «сложное» — это большая сумма (оба слагаемых от 6).
 */
export function generateAdditionProblem(
  level: AdditionLevel,
  difficulty: MathDifficulty = 'medium',
  rng: Rng = Math.random,
): MathProblem {
  const { min, max } = LEVEL_META[level];
  const wanted = targetCarries(level, difficulty);

  let operandA = randomInt(rng, min, max);
  let operandB = randomInt(rng, min, max);

  // Подбираем пару с нужным числом переносов; ограничение попыток — страховка
  // от бесконечного цикла на узких диапазонах.
  for (let attempt = 0; attempt < 60; attempt++) {
    const carries = carryCount(operandA, operandB);
    const hardEnough =
      level === 'single_digit' && difficulty === 'hard'
        ? operandA >= 6 && operandB >= 6
        : carries === wanted;
    if (hardEnough) break;
    operandA = randomInt(rng, min, max);
    operandB = randomInt(rng, min, max);
  }

  return {
    id: `add-${level}-${operandA}-${operandB}-${Math.floor(rng() * 1e6)}`,
    operation: 'addition',
    level,
    operandA,
    operandB,
    answer: operandA + operandB,
    difficulty,
  };
}

/** Выбор сложности по текущему освоению уровня. */
export function pickDifficulty(mastery: number, rng: Rng = Math.random): MathDifficulty {
  const mix =
    DIFFICULTY_MIX.find((m) => mastery < m.upToMastery) ?? DIFFICULTY_MIX[DIFFICULTY_MIX.length - 1];
  const roll = rng();
  if (roll < mix.weights.easy) return 'easy';
  if (roll < mix.weights.easy + mix.weights.medium) return 'medium';
  return 'hard';
}

/** Убирает правильный ответ — в UI он не попадает. */
export function toTask(problem: MathProblem): MathTask {
  const { answer: _answer, ...task } = problem;
  void _answer;
  return task;
}

/**
 * Набор задач на сессию: сложность подстраивается под освоение, одинаковые
 * пары внутри сессии не повторяются.
 */
export function generateSession(
  level: AdditionLevel,
  mastery: number,
  count = SESSION_LENGTH,
  rng: Rng = Math.random,
): MathTask[] {
  const tasks: MathTask[] = [];
  const seen = new Set<string>();

  while (tasks.length < count) {
    const problem = generateAdditionProblem(level, pickDifficulty(mastery, rng), rng);
    const key = `${Math.min(problem.operandA, problem.operandB)}+${Math.max(problem.operandA, problem.operandB)}`;
    // На однозначных уникальных пар мало — после 45 пар разрешаем повторы.
    if (seen.has(key) && seen.size < 45) continue;
    seen.add(key);
    tasks.push(toTask(problem));
  }

  return tasks;
}

/** Задачи для режима «Повторить ошибки» — те самые примеры, где ошиблись. */
export function tasksFromMistakes(
  level: AdditionLevel,
  mistakes: Array<{ operandA: number; operandB: number }>,
  limit = SESSION_LENGTH,
): MathTask[] {
  return mistakes.slice(0, limit).map((m, i) => ({
    id: `retry-${level}-${m.operandA}-${m.operandB}-${i}`,
    operation: 'addition' as const,
    level,
    operandA: m.operandA,
    operandB: m.operandB,
    difficulty: 'medium' as MathDifficulty,
  }));
}

/** Проверка ответа. Правильный результат считается из операндов, а не берётся из состояния. */
export function checkAnswer(task: MathTask, userAnswer: number) {
  const correctAnswer = task.operandA + task.operandB;
  return { correctAnswer, isCorrect: userAnswer === correctAnswer };
}
