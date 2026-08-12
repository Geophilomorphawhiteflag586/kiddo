import { NextResponse } from 'next/server';
import type { DatabaseSync } from 'node:sqlite';
import { getDb } from './db.ts';
import { RepoError, verifyUser } from './repo.ts';

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(error: unknown) {
  if (error instanceof RepoError) return json({ error: error.message }, error.status);
  console.error(error);
  return json({ error: 'Внутренняя ошибка сервера' }, 500);
}

/** Аутентификация по заголовкам. Возвращает userId или бросает RepoError. */
export function requireAuth(db: DatabaseSync, request: Request): string {
  const userId = request.headers.get('x-user-id') ?? '';
  const secret = request.headers.get('x-user-secret') ?? '';
  if (!userId || !secret || !verifyUser(db, userId, secret)) {
    throw new RepoError(401, 'Требуется вход');
  }
  return userId;
}

/** Опциональная аутентификация — для публичных ручек с персонализацией. */
export function optionalAuth(db: DatabaseSync, request: Request): string | null {
  try {
    return requireAuth(db, request);
  } catch {
    return null;
  }
}

export { getDb };
