/**
 * Освоение уровня. «Решил 100 задач» само по себе не означает, что человек
 * освоил сложение, поэтому в формуле участвуют точность, объём и скорость.
 */
import { LEVEL_META, MASTERY_STAGES, MASTERY_WEIGHTS, SPEED_MS } from './config.ts';
import type { AdditionLevel, MasteryInfo, MathLevelStats, MathProgress } from './types.ts';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function accuracyOf(stats: MathLevelStats): number {
  return stats.solved === 0 ? 0 : stats.correct / stats.solved;
}

export function avgMsOf(stats: MathLevelStats): number | null {
  return stats.solved === 0 ? null : Math.round(stats.totalMs / stats.solved);
}

export function coverageOf(stats: MathLevelStats, level: AdditionLevel): number {
  return clamp01(stats.correct / LEVEL_META[level].goal);
}

/**
 * Освоение = взвешенная сумма (точность, объём, скорость), умноженная на саму
 * точность. Точность работает воротами: решить тысячу примеров с половиной
 * ошибок — это не «освоил сложение», и объём со скоростью этого не компенсируют.
 */
export function masteryPercent(stats: MathLevelStats, level: AdditionLevel): number {
  if (stats.solved === 0) return 0;
  const accuracy = accuracyOf(stats);
  const avgMs = avgMsOf(stats) ?? SPEED_MS.slow;
  const speed = clamp01((SPEED_MS.slow - avgMs) / (SPEED_MS.slow - SPEED_MS.fast));
  const value =
    MASTERY_WEIGHTS.accuracy * accuracy +
    MASTERY_WEIGHTS.coverage * coverageOf(stats, level) +
    MASTERY_WEIGHTS.speed * speed;
  return Math.round(clamp01(value) * accuracy * 100);
}

export function stageOf(percent: number) {
  return [...MASTERY_STAGES].reverse().find((s) => percent >= s.minPercent) ?? MASTERY_STAGES[0];
}

export function masteryOf(stats: MathLevelStats, level: AdditionLevel): MasteryInfo {
  const percent = masteryPercent(stats, level);
  const stage = stageOf(percent);
  return { percent, stage: stage.stage, label: stage.label, color: stage.color };
}

/** Освоение сложения целиком — среднее по уровням, взвешенное на их цели. */
export function additionMastery(progress: MathProgress): number {
  let weighted = 0;
  let weights = 0;
  for (const level of Object.keys(LEVEL_META) as AdditionLevel[]) {
    const goal = LEVEL_META[level].goal;
    weighted += masteryPercent(progress.addition[level], level) * goal;
    weights += goal;
  }
  return weights === 0 ? 0 : Math.round(weighted / weights);
}
