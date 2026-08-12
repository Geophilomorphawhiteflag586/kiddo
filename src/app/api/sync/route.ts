import type { SyncPayload } from '@/lib/competitive/types';
import { errorResponse, getDb, json, requireAuth } from '@/server/http';
import { syncProgress } from '@/server/repo';

export const dynamic = 'force-dynamic';

/**
 * Синхронизация локального образовательного прогресса. Сервер получает только
 * сырые счётчики карточек и сам считает Skill Score — готовые очки от клиента
 * не принимаются.
 */
export async function POST(request: Request) {
  try {
    const db = getDb();
    const userId = requireAuth(db, request);
    const payload = (await request.json()) as SyncPayload;
    return json(syncProgress(db, userId, payload));
  } catch (error) {
    return errorResponse(error);
  }
}
