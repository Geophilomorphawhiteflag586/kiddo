import type { CountrySkill } from '../types';
import type { SkillScoreBreakdown } from './config';

/** Компактный срез одной SRS-карточки для синхронизации с сервером. */
export interface SyncCard {
  code: string;
  skill: CountrySkill;
  correct: number;
  wrong: number;
  avgMs: number | null;
  /** Интервал в днях. */
  interval: number;
  repetitions: number;
}

export interface SyncConfusion {
  a: string;
  b: string;
  skill: CountrySkill;
  count: number;
}

/** Что клиент отправляет на сервер после сессии. */
export interface SyncPayload {
  cards: SyncCard[];
  confusions: SyncConfusion[];
  /** Активность по дням для мировой статистики (обрезана до 60 дней). */
  history: Record<string, number>;
  xp: number;
  bestAnswerStreak: number;
  bestDayStreak: number;
}

export interface LeaderboardRow {
  position: number;
  userId: string;
  nickname: string;
  countryCode: string | null;
  isBot: boolean;
  skillScore: number;
  masteredSkills: number;
  totalSkills: number;
  accuracy: number;
  avgMs: number | null;
  bestAnswerStreak: number;
  elo: number | null;
}

export interface LeaderboardResponse {
  rows: LeaderboardRow[];
  total: number;
  page: number;
  pageSize: number;
  me: { position: number; percentile: number; row: LeaderboardRow } | null;
}

export type FriendshipStatus =
  | 'none'
  | 'pending_sent'
  | 'pending_received'
  | 'accepted'
  | 'blocked';

export interface PublicUser {
  userId: string;
  nickname: string;
  countryCode: string | null;
  isBot: boolean;
  skillScore: number;
  level: number;
  friendship: FriendshipStatus;
}

export interface SyncResponse {
  skillScore: SkillScoreBreakdown;
  position: number;
  totalPlayers: number;
  maxSkillScore: number;
}

export interface HardestEntry {
  code: string;
  skill: CountrySkill;
  accuracy: number;
  avgMs: number;
  answers: number;
}

export interface WorldStatsResponse {
  totalAnswers: number;
  answersToday: number;
  activeToday: number;
  avgAccuracy: number;
  avgMs: number;
  players: number;
  /** Включая демо-ботов — интерфейс помечает это явно. */
  hasDemoData: boolean;
  hardestBySkill: Partial<Record<CountrySkill, HardestEntry[]>>;
  hardestCountry: HardestEntry | null;
  topConfusion: { a: string; b: string; skill: CountrySkill; count: number } | null;
  longestStreak: number;
  duelsPlayed: number;
  battlesPlayed: number;
  masteredAllCountries: number;
  masteredAllSkills: number;
}
