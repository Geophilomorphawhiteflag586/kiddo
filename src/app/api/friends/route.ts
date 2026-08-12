import { errorResponse, getDb, json, requireAuth } from '@/server/http';
import { RepoError, friendAction, friendsOf } from '@/server/repo';

export const dynamic = 'force-dynamic';

/** Список друзей и заявок текущего пользователя. */
export async function GET(request: Request) {
  try {
    const db = getDb();
    const me = requireAuth(db, request);
    return json(friendsOf(db, me));
  } catch (error) {
    return errorResponse(error);
  }
}

const ACTIONS = new Set(['request', 'accept', 'decline', 'remove', 'block']);

/** Действие над дружбой: { action, userId }. */
export async function POST(request: Request) {
  try {
    const db = getDb();
    const me = requireAuth(db, request);
    const body = (await request.json()) as { action?: string; userId?: string };
    if (!ACTIONS.has(body.action ?? '') || typeof body.userId !== 'string') {
      throw new RepoError(400, 'Неверный запрос');
    }
    const status = friendAction(
      db,
      me,
      body.userId,
      body.action as 'request' | 'accept' | 'decline' | 'remove' | 'block',
    );
    return json({ status });
  } catch (error) {
    return errorResponse(error);
  }
}
