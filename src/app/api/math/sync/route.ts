import { errorResponse, getDb, json, requireAuth } from '@/server/http';
import { recordMathAnswers } from '@/server/math';

export const dynamic = 'force-dynamic';

/**
 * Приём результатов математической сессии. Сервер сам пересчитывает каждый
 * пример из операндов — вердикт клиента не принимается на веру.
 */
export async function POST(request: Request) {
  try {
    const db = getDb();
    const userId = requireAuth(db, request);
    const body = (await request.json()) as { level?: unknown; answers?: unknown };
    return json(recordMathAnswers(db, userId, body.level, body.answers));
  } catch (error) {
    return errorResponse(error);
  }
}
