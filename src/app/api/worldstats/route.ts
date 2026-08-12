import { errorResponse, getDb, json } from '@/server/http';
import { worldStats } from '@/server/repo';

export const dynamic = 'force-dynamic';

/** Обезличенная глобальная статистика Mapapp. */
export async function GET() {
  try {
    return json(worldStats(getDb()));
  } catch (error) {
    return errorResponse(error);
  }
}
