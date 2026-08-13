'use client';

import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  GUEST_ID,
  STORE_VERSION,
  initialPersistedState,
  makeProfile,
  migrateStore,
  type PersistedState,
} from './migrate.ts';
import {
  applyAnatomyAnswer,
  markSeen as markStructureSeen,
  normalizeAnatomyProgress,
} from '../modules/anatomy/progress.ts';
import type { AnatomyAnswerRecord } from '../modules/anatomy/types.ts';
import {
  normalizeChessProgress,
  recordAttempt,
  startPuzzle,
} from '../modules/chess/progress.ts';
import type { ChessAttempt, MoveOutcome } from '../modules/chess/types.ts';
import {
  applyChineseAnswer,
  normalizeChineseProgress,
} from '../modules/chinese/progress.ts';
import type { ChineseAnswerRecord } from '../modules/chinese/types.ts';
import {
  applyEnglishAnswer,
  normalizeEnglishProgress,
} from '../modules/english/progress.ts';
import type { EnglishAnswerRecord } from '../modules/english/types.ts';
import {
  applyMathAnswer,
  normalizeMathProgress,
} from '../modules/mathematics/progress.ts';
import type { MathTask } from '../modules/mathematics/types.ts';
import {
  applyPeopleAnswer,
  markSeen as markPersonSeenIn,
  normalizePeopleProgress,
} from '../modules/people/progress.ts';
import type { PeopleAnswerRecord } from '../modules/people/types.ts';
import {
  type Achievement,
  type ProfileData,
  applyAnatomyResult,
  applyPeopleResult,
  applyAnswer,
  applyChessResult,
  applyChineseResult,
  applyEnglishResult,
  applyMathResult,
  applySession,
  cardsOfCountry,
  emptyCountryProgress,
  emptyProfileData,
} from './progress.ts';
import { countryLevel, skillLevel, type SkillLevel } from './skills.ts';
import { type MergeResult, type ProfileBackup, mergeBackup } from './transfer.ts';
import type { AgeMode, AnswerOutcome, CountrySkill, ServerAccount, UserProfile } from './types';

export type { Achievement } from './progress.ts';
export { ACHIEVEMENTS } from './progress.ts';

interface State extends PersistedState {
  answer: (outcome: AnswerOutcome) => { xpGained: number; unlocked: Achievement[] };
  discover: (code: string) => void;
  setAgeMode: (mode: AgeMode) => void;
  /** Итог сессии — для личных рекордов. */
  recordSession: (slug: string, session: { correct: number; total: number; avgMs: number }) => void;
  /** Ответ на математический пример. Правильность считается из операндов. */
  submitMathAnswer: (
    task: MathTask,
    userAnswer: number,
    responseTimeMs: number,
  ) => { isCorrect: boolean; correctAnswer: number; xpGained: number; unlocked: Achievement[] };
  /** Ответ на английский квиз. */
  submitEnglishAnswer: (
    answer: EnglishAnswerRecord,
  ) => { xpGained: number; unlocked: Achievement[] };
  /** Ответ на китайский квиз. */
  submitChineseAnswer: (
    answer: ChineseAnswerRecord,
  ) => { xpGained: number; unlocked: Achievement[] };
  /** Структуру показали на экране изучения. */
  markAnatomySeen: (structureId: string) => void;
  markPersonSeen: (personId: string) => void;
  submitPeopleAnswer: (
    answer: PeopleAnswerRecord,
  ) => { xpGained: number; unlocked: Achievement[] };
  /** Ответ на задание по анатомии. */
  submitAnatomyAnswer: (
    answer: AnatomyAnswerRecord,
  ) => { xpGained: number; unlocked: Achievement[] };
  /** Открытие шахматной задачи — с этого момента идёт отсчёт времени. */
  startChessPuzzle: (puzzleId: number) => void;
  /** Попытка хода. Задача не закрывается на ошибке. */
  submitChessAttempt: (
    puzzleId: number,
    from: string,
    to: string,
    outcome: MoveOutcome,
  ) => { attempt: ChessAttempt; xpGained: number; unlocked: Achievement[] };
  /** Привязка серверного аккаунта к активному профилю. */
  setAccount: (account: ServerAccount | undefined) => void;

  /** Вливает резервную копию, не затирая существующий прогресс. */
  importBackup: (backup: ProfileBackup) => MergeResult;

  createProfile: (name: string, ageMode?: AgeMode) => string;
  switchProfile: (id: string) => void;
  renameProfile: (id: string, name: string) => void;
  deleteProfile: (id: string) => void;
  resetActiveProfile: () => void;
}

function touch(profile: UserProfile, now: number): UserProfile {
  return { ...profile, lastActiveAt: new Date(now).toISOString() };
}

export const useGame = create<State>()(
  persist(
    (set, get) => ({
      ...initialPersistedState(),

      answer: (outcome) => {
        const now = Date.now();
        const { activeProfileId: id, data, profiles } = get();
        const result = applyAnswer(data[id] ?? emptyProfileData(), outcome, now);
        set({
          data: { ...data, [id]: result.data },
          profiles: { ...profiles, [id]: touch(profiles[id], now) },
        });
        return { xpGained: result.xpGained, unlocked: result.unlocked };
      },

      discover: (code) => {
        const { activeProfileId: id, data } = get();
        const profileData = data[id] ?? emptyProfileData();
        if (profileData.progress[code]) return;
        set({
          data: {
            ...data,
            [id]: {
              ...profileData,
              progress: {
                ...profileData.progress,
                [code]: emptyCountryProgress(code, Date.now()),
              },
            },
          },
        });
      },

      setAgeMode: (ageMode) => {
        const { activeProfileId: id, profiles } = get();
        set({ profiles: { ...profiles, [id]: { ...profiles[id], ageMode } } });
      },

      submitMathAnswer: (task, userAnswer, responseTimeMs) => {
        const now = Date.now();
        const { activeProfileId: id, data, profiles } = get();
        const profileData = data[id] ?? emptyProfileData();
        const math = normalizeMathProgress(profileData.math);

        const result = applyMathAnswer(math, task, userAnswer, responseTimeMs, now);
        const applied = applyMathResult(
          profileData,
          result.progress,
          result.isCorrect,
          result.xpGained,
          now,
        );

        set({
          data: { ...data, [id]: applied.data },
          profiles: { ...profiles, [id]: touch(profiles[id], now) },
        });

        return {
          isCorrect: result.isCorrect,
          correctAnswer: result.correctAnswer,
          xpGained: result.xpGained,
          unlocked: applied.unlocked,
        };
      },

      submitEnglishAnswer: (answer) => {
        const now = Date.now();
        const { activeProfileId: id, data, profiles } = get();
        const profileData = data[id] ?? emptyProfileData();
        const english = normalizeEnglishProgress(profileData.english);

        const result = applyEnglishAnswer(english, answer, now);
        const applied = applyEnglishResult(
          profileData,
          result.progress,
          answer.isCorrect,
          result.xpGained,
          now,
        );

        set({
          data: { ...data, [id]: applied.data },
          profiles: { ...profiles, [id]: touch(profiles[id], now) },
        });

        return { xpGained: result.xpGained, unlocked: applied.unlocked };
      },

      submitChineseAnswer: (answer) => {
        const now = Date.now();
        const { activeProfileId: id, data, profiles } = get();
        const profileData = data[id] ?? emptyProfileData();
        const chinese = normalizeChineseProgress(profileData.chinese);

        const result = applyChineseAnswer(chinese, answer, now);
        const applied = applyChineseResult(
          profileData,
          result.progress,
          answer.isCorrect,
          result.xpGained,
          now,
        );

        set({
          data: { ...data, [id]: applied.data },
          profiles: { ...profiles, [id]: touch(profiles[id], now) },
        });

        return { xpGained: result.xpGained, unlocked: applied.unlocked };
      },

      markAnatomySeen: (structureId) => {
        const { activeProfileId: id, data } = get();
        const profileData = data[id] ?? emptyProfileData();
        const anatomy = normalizeAnatomyProgress(profileData.anatomy);
        const next = markStructureSeen(anatomy, structureId);
        if (next === anatomy) return;
        set({ data: { ...data, [id]: { ...profileData, anatomy: next } } });
      },

      submitAnatomyAnswer: (answer) => {
        const now = Date.now();
        const { activeProfileId: id, data, profiles } = get();
        const profileData = data[id] ?? emptyProfileData();
        const anatomy = normalizeAnatomyProgress(profileData.anatomy);

        const result = applyAnatomyAnswer(anatomy, answer, now);
        const applied = applyAnatomyResult(
          profileData,
          result.progress,
          answer.isCorrect,
          result.xpGained,
          now,
        );

        set({
          data: { ...data, [id]: applied.data },
          profiles: { ...profiles, [id]: touch(profiles[id], now) },
        });

        return { xpGained: result.xpGained, unlocked: applied.unlocked };
      },

      markPersonSeen: (personId) => {
        const { activeProfileId: id, data } = get();
        const profileData = data[id] ?? emptyProfileData();
        const people = normalizePeopleProgress(profileData.people);
        const next = markPersonSeenIn(people, personId);
        if (next === people) return;
        set({ data: { ...data, [id]: { ...profileData, people: next } } });
      },

      submitPeopleAnswer: (answer) => {
        const now = Date.now();
        const { activeProfileId: id, data, profiles } = get();
        const profileData = data[id] ?? emptyProfileData();
        const people = normalizePeopleProgress(profileData.people);

        const result = applyPeopleAnswer(people, answer, now);
        const applied = applyPeopleResult(
          profileData,
          result.progress,
          answer.isCorrect,
          result.xpGained,
          now,
        );

        set({
          data: { ...data, [id]: applied.data },
          profiles: { ...profiles, [id]: touch(profiles[id], now) },
        });

        return { xpGained: result.xpGained, unlocked: applied.unlocked };
      },

      startChessPuzzle: (puzzleId) => {
        const { activeProfileId: id, data } = get();
        const profileData = data[id] ?? emptyProfileData();
        const chess = normalizeChessProgress(profileData.chess);
        const next = startPuzzle(chess, puzzleId);
        if (next === chess) return; // задача уже открывалась — время не сбрасываем
        set({ data: { ...data, [id]: { ...profileData, chess: next } } });
      },

      submitChessAttempt: (puzzleId, from, to, outcome) => {
        const now = Date.now();
        const { activeProfileId: id, data, profiles } = get();
        const profileData = data[id] ?? emptyProfileData();
        const chess = normalizeChessProgress(profileData.chess);

        const result = recordAttempt(chess, puzzleId, from, to, outcome, now);
        const applied = applyChessResult(
          profileData,
          result.progress,
          result.justSolved,
          result.xpGained,
          now,
        );

        set({
          data: { ...data, [id]: applied.data },
          profiles: { ...profiles, [id]: touch(profiles[id], now) },
        });

        return {
          attempt: result.attempt,
          xpGained: result.xpGained,
          unlocked: applied.unlocked,
        };
      },

      recordSession: (slug, session) => {
        const { activeProfileId: id, data } = get();
        set({
          data: { ...data, [id]: applySession(data[id] ?? emptyProfileData(), slug, session) },
        });
      },

      setAccount: (account) => {
        const { activeProfileId: id, profiles } = get();
        set({ profiles: { ...profiles, [id]: { ...profiles[id], account } } });
      },

      importBackup: (backup) => {
        const { profiles, data, activeProfileId } = get();
        const result = mergeBackup({ profiles, data, activeProfileId }, backup);
        set(result.state);
        return result;
      },

      createProfile: (name, ageMode = 'school') => {
        const now = Date.now();
        const id = `p-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        const { profiles, data } = get();
        set({
          profiles: { ...profiles, [id]: makeProfile(id, name.trim() || 'Без имени', now, ageMode) },
          data: { ...data, [id]: emptyProfileData() },
          activeProfileId: id,
        });
        return id;
      },

      switchProfile: (id) => {
        const { profiles } = get();
        if (!profiles[id]) return;
        set({ activeProfileId: id, profiles: { ...profiles, [id]: touch(profiles[id], Date.now()) } });
      },

      renameProfile: (id, name) => {
        const { profiles } = get();
        if (!profiles[id] || !name.trim()) return;
        set({ profiles: { ...profiles, [id]: { ...profiles[id], name: name.trim() } } });
      },

      deleteProfile: (id) => {
        const { profiles, data, activeProfileId } = get();
        if (!profiles[id]) return;
        const restProfiles = { ...profiles };
        const restData = { ...data };
        delete restProfiles[id];
        delete restData[id];

        // Последний профиль удалять некуда — восстанавливаем гостя.
        if (Object.keys(restProfiles).length === 0) {
          const fresh = initialPersistedState();
          set(fresh);
          return;
        }
        const nextActive =
          activeProfileId === id ? Object.keys(restProfiles)[0] : activeProfileId;
        set({ profiles: restProfiles, data: restData, activeProfileId: nextActive });
      },

      resetActiveProfile: () => {
        const { activeProfileId: id, data } = get();
        set({ data: { ...data, [id]: emptyProfileData() } });
      },
    }),
    {
      name: 'geoquest-progress',
      version: STORE_VERSION,
      migrate: (persisted, version) => migrateStore(persisted, version) as State,
      partialize: (state) =>
        ({
          profiles: state.profiles,
          activeProfileId: state.activeProfileId,
          data: state.data,
        }) as State,
    },
  ),
);

/* ------------------------------- селекторы ------------------------------- */

export function useActiveProfile(): UserProfile {
  return useGame((s) => s.profiles[s.activeProfileId] ?? s.profiles[GUEST_ID]);
}

const EMPTY = emptyProfileData();

export function useActiveData(): ProfileData {
  return useGame((s) => s.data[s.activeProfileId] ?? EMPTY);
}

/** Уровень 0–5 каждой страны для выбранного навыка или общего прогресса. */
export function levelMap(
  data: ProfileData,
  skill: CountrySkill | 'overall',
  hasOutline: (code: string) => boolean,
): Record<string, SkillLevel> {
  const map: Record<string, SkillLevel> = {};
  if (skill === 'overall') {
    const seen = new Set<string>();
    for (const card of Object.values(data.cards)) seen.add(card.countryCode);
    for (const code of seen) {
      map[code] = countryLevel(cardsOfCountry(data.cards, code), hasOutline(code));
    }
    return map;
  }
  for (const card of Object.values(data.cards)) {
    if (card.skill === skill) map[card.countryCode] = skillLevel(card);
  }
  return map;
}

/** Persist оживает только на клиенте — до этого момента прогресс рисовать нельзя. */
const subscribeHydration = (onChange: () => void) =>
  useGame.persist?.onFinishHydration(onChange) ?? (() => {});
const getHydrated = () => useGame.persist?.hasHydrated() ?? true;

export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeHydration, getHydrated, () => false);
}
