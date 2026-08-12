import { errorResponse, getDb, json, optionalAuth } from '@/server/http';
import { findByNickname } from '@/server/repo';

export const dynamic = 'force-dynamic';

/** Поиск пользователя по точному никнейму (без учёта регистра). */
export async function GET(request: Request) {
  try {
    const db = getDb();
    const me = optionalAuth(db, request);
    const nickname = new URL(request.url).searchParams.get('nickname')?.trim() ?? '';
    if (!nickname) return json({ user: null });
    return json({ user: findByNickname(db, nickname, me) });
  } catch (error) {
    return errorResponse(error);
  }
}
