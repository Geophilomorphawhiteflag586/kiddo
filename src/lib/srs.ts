import type { AnswerOutcome, CountrySkill, ReviewCard } from './types';

const MIN_EASE = 1.3;
const DEFAULT_EASE = 2.5;

/** Шаги первичного заучивания, в днях. 7 минут и час — внутри одной сессии. */
const LEARNING_STEPS = [7 / 1440, 1 / 24, 1];

const DAY = 24 * 60 * 60 * 1000;

/**
 * Состояние интервального повторения без привязки к предметной области.
 * На нём работают и страны, и английские слова — движок SM-2 в проекте один.
 */
export interface SrsState {
  ease: number;
  interval: number;
  streak: number;
  repetitions: number;
  lapses: number;
  due: number;
  lastReviewed: number;
  correct: number;
  wrong: number;
  avgMs: number | null;
}

export interface SrsOutcome {
  correct: boolean;
  elapsedMs: number;
  hintUsed?: boolean;
}

export function newSrsState(): SrsState {
  return {
    ease: DEFAULT_EASE,
    interval: 0,
    streak: 0,
    repetitions: 0,
    lapses: 0,
    due: 0,
    lastReviewed: 0,
    correct: 0,
    wrong: 0,
    avgMs: null,
  };
}

export function newCard(countryCode: string, skill: CountrySkill): ReviewCard {
  return { countryCode, skill, ...newSrsState() };
}

/**
 * Оценка ответа по шкале SM-2 (0–5). Скорость учитывается только для верных
 * ответов: угадал быстро — знает, тянул десять секунд — вспоминал с трудом.
 * Ответ с подсказкой не поднимается выше «вспомнил с трудом».
 */
export function gradeAnswer(outcome: SrsOutcome): number {
  if (!outcome.correct) return outcome.elapsedMs < 4000 ? 1 : 2;
  if (outcome.hintUsed) return 3;
  if (outcome.elapsedMs < 3000) return 5;
  if (outcome.elapsedMs < 7000) return 4;
  return 3;
}

/**
 * Шаг SM-2 с фазой заучивания над «голым» состоянием повторения.
 * Исходный объект не мутируется.
 */
export function reviewSrs(state: SrsState, outcome: SrsOutcome, now = Date.now()): SrsState {
  const quality = gradeAnswer(outcome);
  const ease = clampEase(state.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  const answers = state.correct + state.wrong;
  const avgMs =
    state.avgMs === null
      ? outcome.elapsedMs
      : Math.round((state.avgMs * answers + outcome.elapsedMs) / (answers + 1));
  const counted = {
    correct: state.correct + (outcome.correct ? 1 : 0),
    wrong: state.wrong + (outcome.correct ? 0 : 1),
    avgMs,
  };

  if (quality < 3) {
    // Ошибка сбрасывает прогресс: карточка вернётся в ближайшие минуты.
    return {
      ...state,
      ...counted,
      ease,
      interval: LEARNING_STEPS[0],
      streak: 0,
      repetitions: 0,
      lapses: state.lapses + 1,
      due: now + LEARNING_STEPS[0] * DAY,
      lastReviewed: now,
    };
  }

  const repetitions = state.repetitions + 1;
  const interval =
    repetitions <= LEARNING_STEPS.length
      ? LEARNING_STEPS[repetitions - 1]
      : state.interval * ease;

  return {
    ...state,
    ...counted,
    ease,
    interval,
    streak: state.streak + 1,
    repetitions,
    lapses: state.lapses,
    due: now + interval * DAY,
    lastReviewed: now,
  };
}

/** Шаг SM-2 для карточки страны. */
export function review(card: ReviewCard, outcome: AnswerOutcome, now = Date.now()): ReviewCard {
  return { ...card, ...reviewSrs(card, outcome, now) };
}

function clampEase(ease: number): number {
  return Math.max(MIN_EASE, Math.min(3.0, Number(ease.toFixed(3))));
}

export function isDue(card: Pick<SrsState, 'due'>, now = Date.now()): boolean {
  return card.due <= now;
}

/** Доля ошибок карточки — используется при подборе слабых мест. */
export function errorRate(card: Pick<SrsState, 'correct' | 'wrong'>): number {
  const total = card.correct + card.wrong;
  return total === 0 ? 0 : card.wrong / total;
}
