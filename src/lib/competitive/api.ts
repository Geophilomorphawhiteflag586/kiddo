'use client';

/** Клиентские обёртки над соревновательным API. */
import { useGame } from '../store';
import type { ServerAccount } from '../types';
import { buildSyncPayload } from './sync';
import type {
  FriendshipStatus,
  LeaderboardResponse,
  LeaderboardRow,
  PublicUser,
  SyncResponse,
  WorldStatsResponse,
} from './types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  account?: ServerAccount | null,
): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (account) {
    headers['x-user-id'] = account.userId;
    headers['x-user-secret'] = account.secret;
  }
  const res = await fetch(path, { ...options, headers });
  const body = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new ApiError(res.status, body.error ?? `Ошибка ${res.status}`);
  return body;
}

export function activeAccount(): ServerAccount | null {
  const s = useGame.getState();
  return s.profiles[s.activeProfileId]?.account ?? null;
}

export async function registerAccount(
  nickname: string,
  countryCode: string | null,
): Promise<ServerAccount> {
  const created = await request<{ userId: string; secret: string }>('/api/account', {
    method: 'POST',
    body: JSON.stringify({ nickname, countryCode }),
  });
  const account: ServerAccount = { ...created, nickname, countryCode };
  useGame.getState().setAccount(account);
  return account;
}

/** Отправка локального прогресса. Возвращает null, если аккаунта нет. */
export async function syncNow(): Promise<SyncResponse | null> {
  const account = activeAccount();
  if (!account) return null;
  const s = useGame.getState();
  const data = s.data[s.activeProfileId];
  if (!data) return null;
  return request<SyncResponse>(
    '/api/sync',
    { method: 'POST', body: JSON.stringify(buildSyncPayload(data)) },
    account,
  );
}

export interface MathSyncAnswer {
  operandA: number;
  operandB: number;
  userAnswer: number;
  responseTimeMs: number;
}

/**
 * Отправляет ответы математической сессии на серверную перепроверку.
 * Без аккаунта просто ничего не делает — локальный прогресс всё равно сохранён.
 */
export async function syncMathSession(
  level: string,
  answers: MathSyncAnswer[],
): Promise<void> {
  const account = activeAccount();
  if (!account || answers.length === 0) return;
  await request('/api/math/sync', {
    method: 'POST',
    body: JSON.stringify({ level, answers }),
  }, account);
}

export function fetchLeaderboard(page: number): Promise<LeaderboardResponse> {
  return request('/api/leaderboard?page=' + page, {}, activeAccount());
}

export function fetchWorldStats(): Promise<WorldStatsResponse> {
  return request('/api/worldstats');
}

export function searchUser(nickname: string): Promise<{ user: PublicUser | null }> {
  return request(
    '/api/users/search?nickname=' + encodeURIComponent(nickname),
    {},
    activeAccount(),
  );
}

export interface FriendsResponse {
  friends: LeaderboardRow[];
  incoming: Array<{ userId: string; nickname: string }>;
  outgoing: Array<{ userId: string; nickname: string }>;
}

export function fetchFriends(): Promise<FriendsResponse> {
  return request('/api/friends', {}, activeAccount());
}

export function friendAction(
  action: 'request' | 'accept' | 'decline' | 'remove' | 'block',
  userId: string,
): Promise<{ status: FriendshipStatus }> {
  return request(
    '/api/friends',
    { method: 'POST', body: JSON.stringify({ action, userId }) },
    activeAccount(),
  );
}
