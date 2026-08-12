/**
 * Чистый слой прогресса по математике: применение ответа, история ошибок,
 * XP за пример. Без React и без zustand — тестируется в node напрямую.
 */
import { LEVELS, MATH_XP, MISTAKES_KEPT } from './config.ts';
import { checkAnswer } from './generator.ts';
import type {
  AdditionLevel,
  MathLevelStats,
  MathProgress,
  MathTask,
} from './types.ts';

export function emptyLevelStats(): MathLevelStats {
  return { solved: 0, correct: 0, wrong: 0, totalMs: 0, streak: 0, bestStreak: 0, mistakes: [] };
}

export function emptyMathProgress(): MathProgress {
  return {
    addition: {
      single_digit: emptyLevelStats(),
      double_digit: emptyLevelStats(),
      triple_digit: emptyLevelStats(),
    },
  };
}

/** Дополняет частичный объект прогресса — на случай данных из старых версий. */
export function normalizeMathProgress(raw: Partial<MathProgress> | undefined): MathProgress {
  const base = emptyMathProgress();
  if (!raw?.addition) return base;
  for (const level of LEVELS) {
    const stats = raw.addition[level];
    if (stats) base.addition[level] = { ...emptyLevelStats(), ...stats };
  }
  return base;
}

export function xpForAnswer(level: AdditionLevel, responseTimeMs: number): number {
  const fast = responseTimeMs <= MATH_XP.fastMs ? MATH_XP.fastBonus : 0;
  return Math.round((MATH_XP.base + fast) * MATH_XP.levelMultiplier[level]);
}

export interface MathAnswerResult {
  progress: MathProgress;
  isCorrect: boolean;
  correctAnswer: number;
  xpGained: number;
}

/**
 * Применяет ответ к прогрессу. Исходный объект не мутируется.
 * Правильный ответ пересчитывается из операндов задачи.
 */
export function applyMathAnswer(
  progress: MathProgress,
  task: MathTask,
  userAnswer: number,
  responseTimeMs: number,
  now = Date.now(),
): MathAnswerResult {
  const level = task.level;
  const prev = progress.addition[level] ?? emptyLevelStats();
  const { correctAnswer, isCorrect } = checkAnswer(task, userAnswer);

  const streak = isCorrect ? prev.streak + 1 : 0;
  const mistakes = isCorrect
    ? // Решённый пример убираем из очереди повторения.
      prev.mistakes.filter((m) => !(m.operandA === task.operandA && m.operandB === task.operandB))
    : [
        {
          operandA: task.operandA,
          operandB: task.operandB,
          userAnswer,
          at: new Date(now).toISOString(),
        },
        ...prev.mistakes.filter(
          (m) => !(m.operandA === task.operandA && m.operandB === task.operandB),
        ),
      ].slice(0, MISTAKES_KEPT);

  const next: MathLevelStats = {
    solved: prev.solved + 1,
    correct: prev.correct + (isCorrect ? 1 : 0),
    wrong: prev.wrong + (isCorrect ? 0 : 1),
    totalMs: prev.totalMs + Math.max(0, Math.min(300_000, responseTimeMs)),
    streak,
    bestStreak: Math.max(prev.bestStreak, streak),
    mistakes,
  };

  return {
    progress: { ...progress, addition: { ...progress.addition, [level]: next } },
    isCorrect,
    correctAnswer,
    xpGained: isCorrect ? xpForAnswer(level, responseTimeMs) : 0,
  };
}

/** Сколько всего верных примеров решено по всем уровням. */
export function totalCorrect(progress: MathProgress): number {
  return LEVELS.reduce((sum, level) => sum + progress.addition[level].correct, 0);
}

export function totalMistakes(progress: MathProgress): number {
  return LEVELS.reduce((sum, level) => sum + progress.addition[level].mistakes.length, 0);
}
