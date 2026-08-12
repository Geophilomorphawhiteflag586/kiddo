/**
 * Миграция persisted-состояния между версиями store.
 *
 * v1 (до профилей): один плоский прогресс, карточки с ключом `${code}:${mode}`,
 * где mode ∈ flag-to-country | country-to-flag | find-on-globe | capital,
 * и общая матрица confusedWith без разреза по навыкам.
 *
 * v2: несколько профилей; карточки `${code}:${skill}`; путаница по навыкам.
 * Старый прогресс переезжает в профиль «Игрок» — ничего не теряется.
 */
import { normalizeAnatomyProgress } from '../modules/anatomy/progress.ts';
import { normalizeChessProgress } from '../modules/chess/progress.ts';
import { normalizeChineseProgress } from '../modules/chinese/progress.ts';
import { normalizeEnglishProgress } from '../modules/english/progress.ts';
import { normalizeMathProgress } from '../modules/mathematics/progress.ts';
import { emptyProfileData, type ProfileData } from './progress.ts';
import { newCard } from './srs.ts';
import type { AgeMode, CountrySkill, ReviewCard, UserProfile } from './types';

export interface PersistedState {
  profiles: Record<string, UserProfile>;
  activeProfileId: string;
  data: Record<string, ProfileData>;
}

export const STORE_VERSION = 9;
export const GUEST_ID = 'guest';
const MIGRATED_ID = 'player-1';

/** Старые режимы → навыки. Capital-режим v1 задавал только направление «страна → столица». */
const MODE_TO_SKILL: Record<string, CountrySkill> = {
  'flag-to-country': 'flagToCountry',
  'country-to-flag': 'countryToFlag',
  'find-on-globe': 'countryLocation',
  capital: 'countryToCapital',
};

const SKILLS_SET = new Set<CountrySkill>([
  'flagToCountry',
  'countryToFlag',
  'countryToCapital',
  'capitalToCountry',
  'countryLocation',
  'outlineToCountry',
]);

export function makeProfile(
  id: string,
  name: string,
  now: number,
  ageMode: AgeMode = 'school',
  guest = false,
): UserProfile {
  const iso = new Date(now).toISOString();
  return { id, name, createdAt: iso, lastActiveAt: iso, ageMode, guest };
}

export function initialPersistedState(now = Date.now()): PersistedState {
  return {
    profiles: { [GUEST_ID]: makeProfile(GUEST_ID, 'Гость', now, 'school', true) },
    activeProfileId: GUEST_ID,
    data: { [GUEST_ID]: emptyProfileData() },
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any -- persisted-данные приходят нетипизированными */

function num(value: any, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Восстанавливает карточку v1, отбрасывая мусор и добивая новые поля. */
function migrateCard(raw: any): ReviewCard | null {
  if (!raw || typeof raw !== 'object') return null;
  const code = typeof raw.countryCode === 'string' ? raw.countryCode : null;
  const skill = MODE_TO_SKILL[raw.mode] ?? (SKILLS_SET.has(raw.skill) ? raw.skill : null);
  if (!code || !skill) return null;
  return {
    ...newCard(code, skill),
    ease: num(raw.ease, 2.5),
    interval: num(raw.interval),
    streak: num(raw.streak),
    repetitions: num(raw.repetitions),
    lapses: num(raw.lapses),
    due: num(raw.due),
    lastReviewed: num(raw.lastReviewed),
    // v1 хранила correct/wrong на стране, не на карточке — начинаем с нуля.
    correct: num(raw.correct),
    wrong: num(raw.wrong),
    avgMs: typeof raw.avgMs === 'number' ? raw.avgMs : null,
  };
}

function migrateV1Data(old: any): ProfileData {
  const data = emptyProfileData();

  for (const raw of Object.values(old?.cards ?? {})) {
    const card = migrateCard(raw);
    if (card) data.cards[`${card.countryCode}:${card.skill}`] = card;
  }

  for (const [code, raw] of Object.entries<any>(old?.progress ?? {})) {
    if (!raw || typeof raw !== 'object') continue;
    // Старая путаница не знала навыка; почти вся она из флагового режима.
    const flat = raw.confusedWith && typeof raw.confusedWith === 'object' ? raw.confusedWith : {};
    const cleaned: Record<string, number> = {};
    for (const [other, count] of Object.entries(flat)) {
      if (typeof count === 'number' && count > 0) cleaned[other] = count;
    }
    data.progress[code] = {
      countryCode: code,
      confusedWith: Object.keys(cleaned).length ? { flagToCountry: cleaned } : {},
      discoveredAt: typeof raw.discoveredAt === 'number' ? raw.discoveredAt : null,
    };
  }

  data.xp = num(old?.xp);
  data.coins = num(old?.coins);
  data.stars = num(old?.stars);
  data.hotStreak = num(old?.hotStreak);
  data.bestHotStreak = num(old?.bestHotStreak);
  data.dayStreak = num(old?.dayStreak);
  data.lastPlayedDay = typeof old?.lastPlayedDay === 'string' ? old.lastPlayedDay : null;
  data.unlocked = Array.isArray(old?.unlocked)
    ? old.unlocked.filter((id: unknown) => typeof id === 'string')
    : [];
  data.answersToday = num(old?.answersToday);

  return data;
}

const V1_AGE: Record<string, AgeMode> = { kid: 'kid', school: 'school', adult: 'adult' };

/**
 * Точка входа для zustand `migrate`. Никогда не бросает: повреждённые данные
 * приводят к чистому состоянию, а не к падению приложения.
 */
export function migrateStore(persisted: unknown, version: number, now = Date.now()): PersistedState {
  try {
    if (version >= STORE_VERSION) return persisted as PersistedState;

    // v2 → v6: у данных профилей появлялись новые поля (xpToday, history,
    // bestDayStreak, bestSessions, math, english) — добиваем значениями
    // по умолчанию, ничего не теряя.
    if (version >= 2) {
      const state = persisted as PersistedState;
      for (const id of Object.keys(state.data)) {
        const merged = { ...emptyProfileData(), ...state.data[id] };
        merged.math = normalizeMathProgress(merged.math);
        merged.english = normalizeEnglishProgress(merged.english);
        merged.chinese = normalizeChineseProgress(merged.chinese);
        merged.chess = normalizeChessProgress(merged.chess);
        merged.anatomy = normalizeAnatomyProgress(merged.anatomy);
        state.data[id] = merged;
      }
      return state;
    }

    const old = persisted as any;
    const hasAnyProgress =
      old && typeof old === 'object' && (Object.keys(old.cards ?? {}).length > 0 || num(old.xp) > 0);

    if (!hasAnyProgress) return initialPersistedState(now);

    const profile = makeProfile(MIGRATED_ID, 'Игрок', now, V1_AGE[old.ageMode] ?? 'school');
    const state = initialPersistedState(now);
    state.profiles[profile.id] = profile;
    state.data[profile.id] = migrateV1Data(old);
    state.activeProfileId = profile.id;
    return state;
  } catch {
    return initialPersistedState(now);
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
