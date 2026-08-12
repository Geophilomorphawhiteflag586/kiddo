import { LEADERBOARD_PAGE_SIZE } from '@/lib/competitive/config';
import { errorResponse, getDb, json, optionalAuth } from '@/server/http';
import { leaderboard } from '@/server/repo';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const db = getDb();
    const me = optionalAuth(db, request);
    const url = new URL(request.url);
    const page = Math.max(0, Number(url.searchParams.get('page')) || 0);
    const size = Math.min(100, Number(url.searchParams.get('size')) || LEADERBOARD_PAGE_SIZE);
    return json(leaderboard(db, page, size, me));
  } catch (error) {
    return errorResponse(error);
  }
}
