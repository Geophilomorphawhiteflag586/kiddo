import { errorResponse, getDb, json } from '@/server/http';
import { registerUser } from '@/server/repo';

export const dynamic = 'force-dynamic';

/** Регистрация анонимного серверного аккаунта с уникальным никнеймом. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { nickname?: string; countryCode?: string | null };
    const account = registerUser(
      getDb(),
      String(body.nickname ?? '').trim(),
      body.countryCode ? String(body.countryCode).slice(0, 2).toUpperCase() : null,
    );
    return json(account, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
