/**
 * Чистый слой прогресса одного профиля: без React, без zustand, без window.
 * Store лишь вызывает эти функции — благодаря этому вся логика тестируется в node.
 */
import { COUNTRIES } from '../data/countries.ts';
import { LEVEL_META } from '../modules/mathematics/config.ts';
import { masteryPercent } from '../modules/mathematics/mastery.ts';
import { emptyMathProgress, totalCorrect } from '../modules/mathematics/progress.ts';
import type { MathProgress } from '../modules/mathematics/types.ts';
import { emptyEnglishProgress } from '../modules/english/progress.ts';
import { isLearned } from '../modules/english/mastery.ts';
import type { EnglishProgress } from '../modules/english/types.ts';
import { TOTAL_WORDS } from '../modules/english/words.ts';
import { CHARACTERS, TOTAL_CHARACTERS } from '../modules/chinese/characters.ts';
import { isLearned as isCharLearned } from '../modules/chinese/mastery.ts';
import { emptyChineseProgress } from '../modules/chinese/progress.ts';
import type { ChineseProgress } from '../modules/chinese/types.ts';
import { emptyChessProgress } from '../modules/chess/progress.ts';
import type { ChessProgress } from '../modules/chess/types.ts';
import { emptyAnatomyProgress } from '../modules/anatomy/progress.ts';
import { isLearned as isStructureLearned } from '../modules/anatomy/mastery.ts';
import { STRUCTURES, TOTAL_STRUCTURES } from '../modules/anatomy/structures.ts';
import type { AnatomyProgress } from '../modules/anatomy/types.ts';
import { emptyPeopleProgress } from '../modules/people/progress.ts';
import { isLearned as isPersonLearned } from '../modules/people/mastery.ts';
import { PEOPLE, TOTAL_PEOPLE } from '../modules/people/people.ts';
import type { PeopleProgress } from '../modules/people/types.ts';
import { emptyPlan, registerPlanActivity, type TrainingPlan } from './plan.ts';
import { cardKey, countryLevel, skillLevel } from './skills.ts';
import { newCard, review } from './srs.ts';
import type { AnswerOutcome, CountryProgress, CountrySkill, ReviewCard } from './types';

export interface ProfileData {
  /** Ключ — `${code}:${skill}`. */
  cards: Record<string, ReviewCard>;
  progress: Record<string, CountryProgress>;
  xp: number;
  coins: number;
  stars: number;
  hotStreak: number;
  bestHotStreak: number;
  dayStreak: number;
  lastPlayedDay: string | null;
  unlocked: string[];
  answersToday: number;
  xpToday: number;
  /** Ответов по дням (`YYYY-MM-DD` → счётчик) — для календаря активности. */
  history: Record<string, number>;
  /** Рекорд дневной серии (Daily Streak) — не путать с серией ответов. */
  bestDayStreak: number;
  /** Лучшая сессия по каждому режиму: slug → результат. */
  bestSessions: Record<string, SessionRecord>;
  /** Прогресс модуля математики. Другие модули добавляются такими же полями. */
  math: MathProgress;
  /** Прогресс модуля английского. */
  english: EnglishProgress;
  /** Прогресс модуля китайского. */
  chinese: ChineseProgress;
  /** Прогресс шахматного модуля. */
  chess: ChessProgress;
  /** Прогресс модуля анатомии. */
  anatomy: AnatomyProgress;
  people: PeopleProgress;
  /** Дневная норма по направлениям и прогресс за сегодня. */
  plan: TrainingPlan;
}

export interface SessionRecord {
  correct: number;
  total: number;
  avgMs: number;
  at: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  emoji: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-steps', title: 'Первые шаги', description: 'Первый правильный ответ', emoji: '👣' },
  { id: 'ten-countries', title: 'Путешественник', description: '10 открытых стран', emoji: '🧭' },
  { id: 'fifty-countries', title: 'Полсотни', description: '50 открытых стран', emoji: '🌍' },
  { id: 'all-countries', title: 'Весь мир', description: 'Все 194 страны открыты', emoji: '🏆' },
  { id: 'streak-5', title: 'Серия', description: '5 правильных ответов подряд', emoji: '🔥' },
  { id: 'streak-20', title: 'Без промаха', description: '20 правильных ответов подряд', emoji: '⚡' },
  { id: 'flag-master', title: 'Флагман', description: 'Освойте 50 флагов', emoji: '🚩' },
  { id: 'capital-expert', title: 'Эрудит', description: 'Освойте 100 столиц', emoji: '🎓' },
  { id: 'europe-done', title: 'Знаток Европы', description: 'Вся Европа изучена', emoji: '🏰' },
  { id: 'week-streak', title: 'Неделя в пути', description: '7 дней подряд', emoji: '📅' },
  { id: 'math-first', title: 'Первый пример', description: 'Решите первый пример', emoji: '➕' },
  { id: 'math-100', title: 'Сотня примеров', description: 'Решите 100 примеров верно', emoji: '🧮' },
  { id: 'math-streak-25', title: 'Счётная машина', description: '25 примеров подряд без ошибок', emoji: '⚙️' },
  { id: 'math-single', title: 'Однозначные освоены', description: 'Освоение однозначных 85%', emoji: '1️⃣' },
  { id: 'english-first', title: 'First word', description: 'Первое английское слово', emoji: '🔤' },
  { id: 'english-25', title: '25 words', description: 'Выучите 25 английских слов', emoji: '📗' },
  { id: 'english-100', title: '100 words', description: 'Выучите 100 английских слов', emoji: '📘' },
  { id: 'english-all', title: 'Vocabulary master', description: 'Выучите все 400 слов', emoji: '🎓' },
  { id: 'chinese-first', title: '第一个汉字', description: 'Первый иероглиф', emoji: '🀄' },
  { id: 'chinese-20', title: '二十', description: 'Освойте 20 иероглифов', emoji: '🧧' },
  { id: 'chinese-100', title: '一百', description: 'Освойте 100 иероглифов', emoji: '🐲' },
  { id: 'chinese-all', title: '汉字大师', description: 'Освойте все иероглифы', emoji: '🏮' },
  { id: 'chess-first', title: 'Первый мат', description: 'Решите первую задачу', emoji: '♟️' },
  { id: 'chess-25', title: 'Двадцать пять', description: 'Решите 25 задач', emoji: '♞' },
  { id: 'chess-100', title: 'Сотня матов', description: 'Решите 100 задач', emoji: '♛' },
  { id: 'chess-streak-10', title: 'Точный расчёт', description: '10 задач подряд с первой попытки', emoji: '🎯' },
  { id: 'people-first', title: 'Знакомство', description: 'Узнайте первого человека', emoji: '👤' },
  { id: 'people-ten', title: 'Десять лиц', description: 'Освойте десять человек', emoji: '🧑‍🤝‍🧑' },
  { id: 'people-all', title: 'Знаток', description: 'Освойте всех людей в базе', emoji: '🏛️' },
  { id: 'anatomy-first', title: 'Первый орган', description: 'Изучите первую структуру', emoji: '🫀' },
  { id: 'anatomy-organs', title: 'Внутри тела', description: 'Освойте все органы', emoji: '🧬' },
  { id: 'anatomy-bones', title: 'Скелет', description: 'Освойте все кости', emoji: '🦴' },
  { id: 'anatomy-all', title: 'Анатом', description: 'Освойте все структуры', emoji: '🩺' },
];

export function emptyProfileData(): ProfileData {
  return {
    cards: {},
    progress: {},
    xp: 0,
    coins: 0,
    stars: 0,
    hotStreak: 0,
    bestHotStreak: 0,
    dayStreak: 0,
    lastPlayedDay: null,
    unlocked: [],
    answersToday: 0,
    xpToday: 0,
    history: {},
    bestDayStreak: 0,
    bestSessions: {},
    math: emptyMathProgress(),
    english: emptyEnglishProgress(),
    chinese: emptyChineseProgress(),
    chess: emptyChessProgress(),
    anatomy: emptyAnatomyProgress(),
    people: emptyPeopleProgress(),
    plan: emptyPlan(),
  };
}

export function emptyCountryProgress(code: string, now: number): CountryProgress {
  return { countryCode: code, confusedWith: {}, discoveredAt: now };
}

function today(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function isYesterday(date: string, now: number): boolean {
  return date === today(now - 24 * 60 * 60 * 1000);
}

export interface AnswerResult {
  data: ProfileData;
  xpGained: number;
  unlocked: Achievement[];
}

type ActivityFields = Pick<
  ProfileData,
  | 'plan'
  | 'xp'
  | 'coins'
  | 'hotStreak'
  | 'bestHotStreak'
  | 'dayStreak'
  | 'lastPlayedDay'
  | 'answersToday'
  | 'xpToday'
  | 'history'
  | 'bestDayStreak'
>;

/**
 * Общий учёт активности: XP, монеты, серия ответов, дневная серия и календарь.
 * Одинаков для всех модулей — география и математика считаются вместе.
 */
/**
 * Общий учёт ответа: XP, монеты, серии и дневная норма плана.
 *
 * `moduleId` нужен только плану: остальные счётчики общие для всех
 * направлений. Модуль без идентификатора в норму не пишется — так ведут себя
 * служебные пересчёты, которые ответом ребёнка не являются.
 */
export function registerActivity(
  data: ProfileData,
  correct: boolean,
  xpGained: number,
  now: number,
  moduleId?: string,
): ActivityFields {
  const hotStreak = correct ? data.hotStreak + 1 : 0;
  const day = today(now);
  const dayStreak =
    data.lastPlayedDay === day
      ? data.dayStreak
      : isYesterday(data.lastPlayedDay ?? '', now)
        ? data.dayStreak + 1
        : 1;

  return {
    plan: moduleId ? registerPlanActivity(data.plan, moduleId, now) : data.plan,
    xp: data.xp + xpGained,
    coins: data.coins + (correct ? 2 : 0),
    hotStreak,
    bestHotStreak: Math.max(data.bestHotStreak, hotStreak),
    dayStreak,
    lastPlayedDay: day,
    answersToday: data.lastPlayedDay === day ? data.answersToday + 1 : 1,
    xpToday: (data.lastPlayedDay === day ? data.xpToday : 0) + xpGained,
    history: { ...data.history, [day]: (data.history[day] ?? 0) + 1 },
    bestDayStreak: Math.max(data.bestDayStreak ?? 0, dayStreak),
  };
}

/** Применяет ответ к данным профиля. Исходный объект не мутируется. */
export function applyAnswer(data: ProfileData, outcome: AnswerOutcome, now = Date.now()): AnswerResult {
  const key = cardKey(outcome.countryCode, outcome.skill);
  const card = data.cards[key] ?? newCard(outcome.countryCode, outcome.skill);

  const prev = data.progress[outcome.countryCode] ?? emptyCountryProgress(outcome.countryCode, now);

  // Путаница пишется в разрезе навыка: флаги путаются отдельно от контуров.
  let confusedWith = prev.confusedWith;
  if (!outcome.correct && outcome.chosenCode) {
    const forSkill = { ...(confusedWith[outcome.skill] ?? {}) };
    forSkill[outcome.chosenCode] = (forSkill[outcome.chosenCode] ?? 0) + 1;
    confusedWith = { ...confusedWith, [outcome.skill]: forSkill };
  }

  const fast = outcome.correct && outcome.elapsedMs < 3000 && !outcome.hintUsed;
  const xpGained = outcome.correct ? (fast ? 15 : 10) : 0;

  const next: ProfileData = {
    ...data,
    ...registerActivity(data, outcome.correct, xpGained, now, 'geography'),
    cards: { ...data.cards, [key]: review(card, outcome, now) },
    progress: {
      ...data.progress,
      [outcome.countryCode]: { ...prev, confusedWith, discoveredAt: prev.discoveredAt ?? now },
    },
  };

  const earned = checkAchievements(next).filter((a) => !data.unlocked.includes(a.id));
  return {
    data: { ...next, unlocked: [...data.unlocked, ...earned.map((a) => a.id)] },
    xpGained,
    unlocked: earned,
  };
}

/**
 * Итог сессии — обновляет личный рекорд режима, если сессия лучше:
 * больше верных, при равенстве — быстрее.
 */
export function applySession(
  data: ProfileData,
  slug: string,
  session: { correct: number; total: number; avgMs: number },
  now = Date.now(),
): ProfileData {
  if (session.total < 3) return data; // слишком короткая сессия — не рекорд
  const prev = data.bestSessions[slug];
  const better =
    !prev ||
    session.correct > prev.correct ||
    (session.correct === prev.correct && session.avgMs < prev.avgMs);
  if (!better) return data;
  return {
    ...data,
    bestSessions: {
      ...data.bestSessions,
      [slug]: { ...session, at: new Date(now).toISOString() },
    },
  };
}

/** Все карточки страны, разложенные по навыкам. */
export function cardsOfCountry(
  cards: Record<string, ReviewCard>,
  code: string,
): Partial<Record<CountrySkill, ReviewCard>> {
  const result: Partial<Record<CountrySkill, ReviewCard>> = {};
  for (const card of Object.values(cards)) {
    if (card.countryCode === code) result[card.skill] = card;
  }
  return result;
}

/** Суммарная путаница страны по всем навыкам — для карточки страны. */
export function totalConfusions(progress: CountryProgress): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const perSkill of Object.values(progress.confusedWith)) {
    for (const [code, count] of Object.entries(perSkill ?? {})) {
      acc[code] = (acc[code] ?? 0) + count;
    }
  }
  return acc;
}

/** Пары, которые пользователь путает чаще всего (по всем навыкам). */
export function topConfusions(
  progress: Record<string, CountryProgress>,
  limit = 5,
): Array<{ a: string; b: string; count: number; skill: CountrySkill }> {
  const pairs = new Map<string, { a: string; b: string; count: number; skill: CountrySkill }>();
  for (const entry of Object.values(progress)) {
    for (const [skill, perSkill] of Object.entries(entry.confusedWith)) {
      for (const [other, count] of Object.entries(perSkill ?? {})) {
        const [a, b] = [entry.countryCode, other].sort();
        const key = `${a}:${b}:${skill}`;
        const existing = pairs.get(key);
        if (existing) existing.count += count;
        else pairs.set(key, { a, b, count, skill: skill as CountrySkill });
      }
    }
  }
  return [...pairs.values()].sort((x, y) => y.count - x.count).slice(0, limit);
}

/** Сколько анатомических структур освоено. */
export function anatomyLearnedCount(data: ProfileData): number {
  const progress = data.anatomy;
  if (!progress) return 0;
  return STRUCTURES.filter((s) => isStructureLearned(progress, s.id)).length;
}

/** Сколько шахматных задач решено. */
export function chessSolvedCount(data: ProfileData): number {
  return Object.values(data.chess?.puzzles ?? {}).filter((record) => record.solved).length;
}

/** Сколько иероглифов освоено (минимум два навыка на уровне «узнаёт»). */
export function chineseLearned(data: ProfileData): number {
  const progress = data.chinese;
  if (!progress) return 0;
  return CHARACTERS.filter((char) => isCharLearned(progress, char.id)).length;
}

/** Сколько английских слов выучено (уровень «узнаёт» и выше). */
export function englishLearned(data: ProfileData): number {
  return Object.values(data.english?.cards ?? {}).filter(isLearned).length;
}

/** Освоенных карточек навыка (уровень ≥ 3 — «запоминается» и выше). */
export function masteredCount(data: ProfileData, skill: CountrySkill): number {
  return Object.values(data.cards).filter((c) => c.skill === skill && skillLevel(c) >= 3).length;
}

/**
 * Прогресс к ещё не полученному достижению: сколько из скольки.
 * null — достижение бинарное, полоска прогресса ему не нужна.
 */
export function achievementProgress(
  data: ProfileData,
  id: string,
): { current: number; target: number } | null {
  const discovered = Object.keys(data.progress).length;
  const clamp = (current: number, target: number) => ({
    current: Math.min(current, target),
    target,
  });
  switch (id) {
    case 'ten-countries':
      return clamp(discovered, 10);
    case 'fifty-countries':
      return clamp(discovered, 50);
    case 'all-countries':
      return clamp(discovered, COUNTRIES.length);
    case 'streak-5':
      return clamp(data.bestHotStreak, 5);
    case 'streak-20':
      return clamp(data.bestHotStreak, 20);
    case 'flag-master':
      return clamp(masteredCount(data, 'flagToCountry'), 50);
    case 'capital-expert':
      return clamp(masteredCount(data, 'countryToCapital'), 100);
    case 'week-streak':
      return clamp(data.dayStreak, 7);
    case 'math-100':
      return clamp(totalCorrect(data.math ?? emptyMathProgress()), 100);
    case 'math-streak-25':
      return clamp(
        Math.max(
          ...(Object.keys(LEVEL_META) as Array<keyof typeof LEVEL_META>).map(
            (level) => (data.math ?? emptyMathProgress()).addition[level].bestStreak,
          ),
        ),
        25,
      );
    case 'math-single':
      return clamp(
        masteryPercent((data.math ?? emptyMathProgress()).addition.single_digit, 'single_digit'),
        85,
      );
    case 'english-25':
      return clamp(englishLearned(data), 25);
    case 'english-100':
      return clamp(englishLearned(data), 100);
    case 'english-all':
      return clamp(englishLearned(data), TOTAL_WORDS);
    case 'chinese-20':
      return clamp(chineseLearned(data), 20);
    case 'chinese-100':
      return clamp(chineseLearned(data), 100);
    case 'chinese-all':
      return clamp(chineseLearned(data), TOTAL_CHARACTERS);
    case 'chess-25':
      return clamp(chessSolvedCount(data), 25);
    case 'chess-100':
      return clamp(chessSolvedCount(data), 100);
    case 'chess-streak-10':
      return clamp(data.chess?.bestStreak ?? 0, 10);
    case 'anatomy-all':
      return clamp(anatomyLearnedCount(data), TOTAL_STRUCTURES);
    default:
      return null;
  }
}

/** Применяет ответ по анатомии: модуль + общий учёт активности. */
export function applyAnatomyResult(
  data: ProfileData,
  anatomy: AnatomyProgress,
  correct: boolean,
  xpGained: number,
  now = Date.now(),
): { data: ProfileData; unlocked: Achievement[] } {
  const next: ProfileData = {
    ...data,
    ...registerActivity(data, correct, xpGained, now, 'anatomy'),
    anatomy,
  };
  const earned = checkAchievements(next).filter((a) => !data.unlocked.includes(a.id));
  return {
    data: { ...next, unlocked: [...data.unlocked, ...earned.map((a) => a.id)] },
    unlocked: earned,
  };
}

/** Применяет ответ о человеке: модуль + общий учёт активности. */
export function applyPeopleResult(
  data: ProfileData,
  people: PeopleProgress,
  correct: boolean,
  xpGained: number,
  now = Date.now(),
): { data: ProfileData; unlocked: Achievement[] } {
  const next: ProfileData = {
    ...data,
    ...registerActivity(data, correct, xpGained, now, 'people'),
    people,
  };
  const earned = checkAchievements(next).filter((a) => !data.unlocked.includes(a.id));
  return {
    data: { ...next, unlocked: [...data.unlocked, ...earned.map((a) => a.id)] },
    unlocked: earned,
  };
}

/** Применяет результат шахматной попытки: модуль + общий учёт активности. */
export function applyChessResult(
  data: ProfileData,
  chess: ChessProgress,
  solved: boolean,
  xpGained: number,
  now = Date.now(),
): { data: ProfileData; unlocked: Achievement[] } {
  // Активность засчитывается только за решённую задачу: неверный ход — это
  // часть поиска, он не должен рвать серию верных ответов.
  const next: ProfileData = solved
    ? { ...data, ...registerActivity(data, true, xpGained, now, 'chess'), chess }
    : { ...data, chess };
  const earned = checkAchievements(next).filter((a) => !data.unlocked.includes(a.id));
  return {
    data: { ...next, unlocked: [...data.unlocked, ...earned.map((a) => a.id)] },
    unlocked: earned,
  };
}

/** Применяет ответ по китайскому: обновляет модуль и общий учёт активности. */
export function applyChineseResult(
  data: ProfileData,
  chinese: ChineseProgress,
  correct: boolean,
  xpGained: number,
  now = Date.now(),
): { data: ProfileData; unlocked: Achievement[] } {
  const next: ProfileData = {
    ...data,
    ...registerActivity(data, correct, xpGained, now, 'chinese'),
    chinese,
  };
  const earned = checkAchievements(next).filter((a) => !data.unlocked.includes(a.id));
  return {
    data: { ...next, unlocked: [...data.unlocked, ...earned.map((a) => a.id)] },
    unlocked: earned,
  };
}

/** Применяет ответ по английскому: обновляет модуль и общий учёт активности. */
export function applyEnglishResult(
  data: ProfileData,
  english: EnglishProgress,
  correct: boolean,
  xpGained: number,
  now = Date.now(),
): { data: ProfileData; unlocked: Achievement[] } {
  const next: ProfileData = {
    ...data,
    ...registerActivity(data, correct, xpGained, now, 'english'),
    english,
  };
  const earned = checkAchievements(next).filter((a) => !data.unlocked.includes(a.id));
  return {
    data: { ...next, unlocked: [...data.unlocked, ...earned.map((a) => a.id)] },
    unlocked: earned,
  };
}

/** Применяет ответ по математике: обновляет модуль и общий учёт активности. */
export function applyMathResult(
  data: ProfileData,
  math: MathProgress,
  correct: boolean,
  xpGained: number,
  now = Date.now(),
): { data: ProfileData; unlocked: Achievement[] } {
  const next: ProfileData = {
    ...data,
    ...registerActivity(data, correct, xpGained, now, 'mathematics'),
    math,
  };
  const earned = checkAchievements(next).filter((a) => !data.unlocked.includes(a.id));
  return {
    data: { ...next, unlocked: [...data.unlocked, ...earned.map((a) => a.id)] },
    unlocked: earned,
  };
}

function checkAchievements(data: ProfileData): Achievement[] {
  const earned: Achievement[] = [];
  const give = (id: string) => {
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (a) earned.push(a);
  };

  const discovered = Object.keys(data.progress).length;
  const answered = Object.values(data.cards).some((c) => c.correct > 0);

  if (answered) give('first-steps');
  if (discovered >= 10) give('ten-countries');
  if (discovered >= 50) give('fifty-countries');
  if (discovered >= COUNTRIES.length) give('all-countries');
  if (data.bestHotStreak >= 5) give('streak-5');
  if (data.bestHotStreak >= 20) give('streak-20');
  if (data.dayStreak >= 7) give('week-streak');
  if (masteredCount(data, 'flagToCountry') >= 50) give('flag-master');
  if (masteredCount(data, 'countryToCapital') >= 100) give('capital-expert');

  const math = data.math ?? emptyMathProgress();
  const mathCorrect = totalCorrect(math);
  const mathStreak = Math.max(
    ...(Object.keys(LEVEL_META) as Array<keyof typeof LEVEL_META>).map(
      (level) => math.addition[level].bestStreak,
    ),
  );
  if (mathCorrect >= 1) give('math-first');
  if (mathCorrect >= 100) give('math-100');
  if (mathStreak >= 25) give('math-streak-25');
  if (masteryPercent(math.addition.single_digit, 'single_digit') >= 85) give('math-single');

  const learnedWords = englishLearned(data);
  if (Object.keys(data.english?.cards ?? {}).length >= 1) give('english-first');
  if (learnedWords >= 25) give('english-25');
  if (learnedWords >= 100) give('english-100');
  if (learnedWords >= TOTAL_WORDS) give('english-all');

  const learnedChars = chineseLearned(data);
  if (Object.keys(data.chinese?.cards ?? {}).length >= 1) give('chinese-first');
  if (learnedChars >= 20) give('chinese-20');
  if (learnedChars >= 100) give('chinese-100');
  if (learnedChars >= TOTAL_CHARACTERS) give('chinese-all');

  const chess = data.chess;
  const chessSolved = chessSolvedCount(data);
  if (Object.keys(chess?.puzzles ?? {}).length >= 1) give('chess-first');
  if (chessSolved >= 25) give('chess-25');
  if (chessSolved >= 100) give('chess-100');
  if ((chess?.bestStreak ?? 0) >= 10) give('chess-streak-10');

  const anatomy = data.anatomy;
  if (anatomy) {
    const learnedIn = (system: string) =>
      STRUCTURES.filter((s) => s.system === system && isStructureLearned(anatomy, s.id)).length;
    const totalIn = (system: string) => STRUCTURES.filter((s) => s.system === system).length;
    if (anatomy.seen.length >= 1) give('anatomy-first');
    if (learnedIn('organs') >= totalIn('organs')) give('anatomy-organs');
    if (learnedIn('bones') >= totalIn('bones')) give('anatomy-bones');
    if (anatomyLearnedCount(data) >= TOTAL_STRUCTURES) give('anatomy-all');
  }

  const people = data.people;
  if (people) {
    const learned = PEOPLE.filter((person) => isPersonLearned(people, person.id)).length;
    if (people.seen.length >= 1) give('people-first');
    if (learned >= 10) give('people-ten');
    if (learned >= TOTAL_PEOPLE) give('people-all');
  }

  const europe = COUNTRIES.filter((c) => c.continent === 'europe');
  if (europe.every((c) => countryLevel(cardsOfCountry(data.cards, c.code)) > 0)) {
    give('europe-done');
  }

  return earned;
}
