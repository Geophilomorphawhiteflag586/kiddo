/** Домен модуля математики. Ничего не знает ни о React, ни о географии. */

export type MathOperation = 'addition' | 'subtraction' | 'multiplication' | 'division';

export type AdditionLevel = 'single_digit' | 'double_digit' | 'triple_digit';

/** Подсложность внутри уровня. Пользователь её не выбирает — регулирует алгоритм. */
export type MathDifficulty = 'easy' | 'medium' | 'hard';

export interface MathProblem {
  id: string;
  operation: 'addition';
  level: AdditionLevel;
  operandA: number;
  operandB: number;
  answer: number;
  difficulty: MathDifficulty;
}

/**
 * Задача в том виде, в каком она уходит в UI: без правильного ответа.
 * Ответ пересчитывается из операндов при проверке и на сервере при синхронизации.
 */
export type MathTask = Omit<MathProblem, 'answer'>;

export interface MathAnswer {
  problemId: string;
  userAnswer: number;
  correctAnswer: number;
  isCorrect: boolean;
  responseTimeMs: number;
  answeredAt: string;
}

/** Ошибка, сохранённая для режима «Повторить ошибки». */
export interface MathMistake {
  operandA: number;
  operandB: number;
  userAnswer: number;
  at: string;
}

export interface MathLevelStats {
  solved: number;
  correct: number;
  wrong: number;
  /** Суммарное время ответов, мс — из него считается среднее. */
  totalMs: number;
  streak: number;
  bestStreak: number;
  mistakes: MathMistake[];
}

export interface MathProgress {
  addition: Record<AdditionLevel, MathLevelStats>;
}

export type MasteryStage = 'learning' | 'practicing' | 'familiar' | 'mastered';

export interface MasteryInfo {
  percent: number;
  stage: MasteryStage;
  label: string;
  color: string;
}
