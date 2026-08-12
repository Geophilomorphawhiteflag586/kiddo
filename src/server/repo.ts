/**
 * Репозиторий этапа 1: аккаунты, синхронизация знаний, лидерборд, друзья,
 * мировая статистика. Все функции принимают db — в тестах это временный файл.
 */
import { createHash, randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { HARDEST_MIN_ANSWERS, NICKNAME_RE } from '../lib/competitive/config.ts';
import type {
  FriendshipStatus,
  HardestEntry,
  LeaderboardResponse,
  LeaderboardRow,
  SyncPayload,
  WorldStatsResponse,
} from '../lib/competitive/types.ts';
import type { CountrySkill } from '../lib/types.ts';
import { computeSkillScore, sanitizeCard, TOTAL_SKILLS } from './skillScore.ts';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const now = () => new Date().toISOString();

export class RepoError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/* -------------------------------- Аккаунты -------------------------------- */

export function registerUser(
  db: DatabaseSync,
  nickname: string,
  countryCode: string | null,
  isBot = false,
): { userId: string; secret: string } {
  if (!NICKNAME_RE.test(nickname)) {
    throw new RepoError(400, 'Никнейм: 3–20 символов, буквы, цифры, дефис и подчёркивание');
  }
  const exists = db.prepare('SELECT id FROM users WHERE nickname = ?').get(nickname);
  if (exists) throw new RepoError(409, 'Никнейм уже занят');

  const userId = randomUUID();
  const secret = randomUUID();
  db.prepare(
    'INSERT INTO users (id, nickname, secret_hash, country_code, is_bot, created_at, last_seen_at) VALUES (?,?,?,?,?,?,?)',
  ).run(userId, nickname, sha256(secret), countryCode, isBot ? 1 : 0, now(), now());
  db.prepare('INSERT INTO player_stats (user_id, updated_at) VALUES (?, ?)').run(userId, now());
  return { userId, secret };
}

export function verifyUser(db: DatabaseSync, userId: string, secret: string): boolean {
  const row = db.prepare('SELECT secret_hash FROM users WHERE id = ?').get(userId) as
    | { secret_hash: string }
    | undefined;
  return !!row && row.secret_hash === sha256(secret);
}

/* ------------------------------ Синхронизация ------------------------------ */

/** Не чаще раза в несколько секунд с одного аккаунта. */
const lastSync = new Map<string, number>();
const SYNC_MIN_INTERVAL_MS = 5000;

export function syncProgress(db: DatabaseSync, userId: string, payload: SyncPayload) {
  const last = lastSync.get(userId) ?? 0;
  if (Date.now() - last < SYNC_MIN_INTERVAL_MS) {
    throw new RepoError(429, 'Слишком часто — подождите пару секунд');
  }
  lastSync.set(userId, Date.now());

  const cards = (Array.isArray(payload.cards) ? payload.cards : [])
    .map(sanitizeCard)
    .filter((c) => c !== null);

  const bestStreak = clampInt(payload.bestAnswerStreak, 100_000);
  const score = computeSkillScore(cards, bestStreak);

  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM user_country_skill WHERE user_id = ?').run(userId);
    // OR REPLACE: дубликаты пары «страна × навык» в пейлоаде не роняют запись.
    const insCard = db.prepare(
      'INSERT OR REPLACE INTO user_country_skill (user_id, code, skill, correct, wrong, avg_ms, mastered) VALUES (?,?,?,?,?,?,?)',
    );
    for (const card of cards) {
      insCard.run(
        userId,
        card.code,
        card.skill,
        card.correct,
        card.wrong,
        card.avgMs,
        card.interval >= 1 && card.repetitions > 0 ? 1 : 0,
      );
    }

    db.prepare('DELETE FROM user_confusions WHERE user_id = ?').run(userId);
    const insConf = db.prepare(
      'INSERT OR REPLACE INTO user_confusions (user_id, a, b, skill, cnt) VALUES (?,?,?,?,?)',
    );
    for (const c of (payload.confusions ?? []).slice(0, 200)) {
      if (typeof c?.a !== 'string' || typeof c?.b !== 'string') continue;
      insConf.run(userId, c.a, c.b, String(c.skill), clampInt(c.count, 100_000));
    }

    const insDay = db.prepare(
      'INSERT OR REPLACE INTO user_daily (user_id, day, answers) VALUES (?,?,?)',
    );
    const days = Object.entries(payload.history ?? {})
      .filter(([d]) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort((x, y) => y[0].localeCompare(x[0]))
      .slice(0, 60);
    for (const [day, answers] of days) insDay.run(userId, day, clampInt(answers, 100_000));

    db.prepare(
      `UPDATE player_stats SET
        skill_score = ?, mastery_score = ?, accuracy_score = ?, speed_score = ?,
        retention_score = ?, streak_score = ?, difficulty_score = ?,
        max_skill_score = MAX(max_skill_score, ?),
        xp = ?, mastered_skills = ?, accuracy = ?, avg_ms = ?,
        best_answer_streak = ?, best_day_streak = ?, updated_at = ?
       WHERE user_id = ?`,
    ).run(
      score.totalScore,
      score.masteryScore,
      score.accuracyScore,
      score.speedScore,
      score.retentionScore,
      score.streakScore,
      score.difficultyScore,
      score.totalScore,
      clampInt(payload.xp, 100_000_000),
      score.masteredSkills,
      score.accuracy,
      score.avgMs,
      bestStreak,
      clampInt(payload.bestDayStreak, 100_000),
      now(),
      userId,
    );
    db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run(now(), userId);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  const { position, total } = rankOf(db, userId);
  const maxRow = db
    .prepare('SELECT max_skill_score FROM player_stats WHERE user_id = ?')
    .get(userId) as { max_skill_score: number };

  return {
    skillScore: {
      masteryScore: score.masteryScore,
      accuracyScore: score.accuracyScore,
      speedScore: score.speedScore,
      retentionScore: score.retentionScore,
      streakScore: score.streakScore,
      difficultyScore: score.difficultyScore,
      totalScore: score.totalScore,
    },
    position,
    totalPlayers: total,
    maxSkillScore: maxRow.max_skill_score,
  };
}

function clampInt(v: unknown, max: number): number {
  return typeof v === 'number' && Number.isFinite(v)
    ? Math.max(0, Math.min(max, Math.floor(v)))
    : 0;
}

/* -------------------------------- Лидерборд -------------------------------- */

interface DbRow {
  user_id: string;
  nickname: string;
  country_code: string | null;
  is_bot: number;
  skill_score: number;
  mastered_skills: number;
  accuracy: number;
  avg_ms: number | null;
  best_answer_streak: number;
  elo: number | null;
  position: number;
}

const ROW_SQL = `
  SELECT s.user_id, u.nickname, u.country_code, u.is_bot,
         s.skill_score, s.mastered_skills, s.accuracy, s.avg_ms,
         s.best_answer_streak, s.elo,
         RANK() OVER (ORDER BY s.skill_score DESC, s.user_id) AS position
  FROM player_stats s JOIN users u ON u.id = s.user_id
`;

function toRow(r: DbRow): LeaderboardRow {
  return {
    position: r.position,
    userId: r.user_id,
    nickname: r.nickname,
    countryCode: r.country_code,
    isBot: r.is_bot === 1,
    skillScore: r.skill_score,
    masteredSkills: r.mastered_skills,
    totalSkills: TOTAL_SKILLS,
    accuracy: r.accuracy,
    avgMs: r.avg_ms,
    bestAnswerStreak: r.best_answer_streak,
    elo: r.elo,
  };
}

export function rankOf(db: DatabaseSync, userId: string): { position: number; total: number } {
  const total = (db.prepare('SELECT COUNT(*) AS c FROM player_stats').get() as { c: number }).c;
  const row = db
    .prepare(`SELECT position FROM (${ROW_SQL}) WHERE user_id = ?`)
    .get(userId) as { position: number } | undefined;
  return { position: row?.position ?? total, total };
}

export function leaderboard(
  db: DatabaseSync,
  page: number,
  pageSize: number,
  meId: string | null,
): LeaderboardResponse {
  const total = (db.prepare('SELECT COUNT(*) AS c FROM player_stats').get() as { c: number }).c;
  const rows = db
    .prepare(`${ROW_SQL} ORDER BY position LIMIT ? OFFSET ?`)
    .all(pageSize, page * pageSize) as unknown as DbRow[];

  let me: LeaderboardResponse['me'] = null;
  if (meId) {
    const mine = db.prepare(`SELECT * FROM (${ROW_SQL}) WHERE user_id = ?`).get(meId) as
      | DbRow
      | undefined;
    if (mine) {
      me = {
        position: mine.position,
        percentile: total === 0 ? 100 : Math.max(1, Math.ceil((mine.position / total) * 100)),
        row: toRow(mine),
      };
    }
  }

  return { rows: rows.map(toRow), total, page, pageSize, me };
}

/* --------------------------------- Друзья --------------------------------- */

const pairOf = (x: string, y: string): [string, string] => (x < y ? [x, y] : [y, x]);

interface FriendshipRow {
  user_a: string;
  user_b: string;
  requested_by: string;
  status: string;
}

export function friendshipStatus(db: DatabaseSync, me: string, other: string): FriendshipStatus {
  if (me === other) return 'none';
  const [a, b] = pairOf(me, other);
  const row = db
    .prepare('SELECT * FROM friendships WHERE user_a = ? AND user_b = ?')
    .get(a, b) as FriendshipRow | undefined;
  if (!row) return 'none';
  if (row.status === 'accepted') return 'accepted';
  if (row.status === 'pending') return row.requested_by === me ? 'pending_sent' : 'pending_received';
  // blocked_by_a / blocked_by_b
  return 'blocked';
}

export function friendAction(
  db: DatabaseSync,
  me: string,
  otherId: string,
  action: 'request' | 'accept' | 'decline' | 'remove' | 'block',
): FriendshipStatus {
  if (me === otherId) throw new RepoError(400, 'Нельзя добавить самого себя');
  const other = db.prepare('SELECT id FROM users WHERE id = ?').get(otherId);
  if (!other) throw new RepoError(404, 'Пользователь не найден');

  const [a, b] = pairOf(me, otherId);
  const existing = db
    .prepare('SELECT * FROM friendships WHERE user_a = ? AND user_b = ?')
    .get(a, b) as FriendshipRow | undefined;
  const del = () => db.prepare('DELETE FROM friendships WHERE user_a = ? AND user_b = ?').run(a, b);
  const put = (status: string, requestedBy: string) => {
    del();
    db.prepare(
      'INSERT INTO friendships (user_a, user_b, requested_by, status, created_at) VALUES (?,?,?,?,?)',
    ).run(a, b, requestedBy, status, now());
  };

  switch (action) {
    case 'request': {
      if (existing?.status === 'accepted') throw new RepoError(409, 'Вы уже друзья');
      if (existing?.status === 'pending') {
        if (existing.requested_by === me) throw new RepoError(409, 'Заявка уже отправлена');
        put('accepted', existing.requested_by); // встречная заявка = принятие
        return 'accepted';
      }
      if (existing?.status.startsWith('blocked')) throw new RepoError(403, 'Недоступно');
      put('pending', me);
      return 'pending_sent';
    }
    case 'accept': {
      if (existing?.status !== 'pending' || existing.requested_by === me) {
        throw new RepoError(400, 'Нет входящей заявки');
      }
      put('accepted', existing.requested_by);
      return 'accepted';
    }
    case 'decline':
    case 'remove': {
      if (existing?.status.startsWith('blocked')) throw new RepoError(403, 'Недоступно');
      del();
      return 'none';
    }
    case 'block': {
      put(me === a ? 'blocked_by_a' : 'blocked_by_b', me);
      return 'blocked';
    }
  }
}

export function friendsOf(db: DatabaseSync, me: string): {
  friends: LeaderboardRow[];
  incoming: Array<{ userId: string; nickname: string }>;
  outgoing: Array<{ userId: string; nickname: string }>;
} {
  const rows = db
    .prepare('SELECT * FROM friendships WHERE user_a = ? OR user_b = ?')
    .all(me, me) as unknown as FriendshipRow[];

  const acceptedIds: string[] = [];
  const incoming: Array<{ userId: string; nickname: string }> = [];
  const outgoing: Array<{ userId: string; nickname: string }> = [];
  const nickOf = (id: string) =>
    (db.prepare('SELECT nickname FROM users WHERE id = ?').get(id) as { nickname: string })
      .nickname;

  for (const row of rows) {
    const other = row.user_a === me ? row.user_b : row.user_a;
    if (row.status === 'accepted') acceptedIds.push(other);
    else if (row.status === 'pending') {
      if (row.requested_by === me) outgoing.push({ userId: other, nickname: nickOf(other) });
      else incoming.push({ userId: other, nickname: nickOf(other) });
    }
  }

  const ids = [...acceptedIds, me];
  const placeholders = ids.map(() => '?').join(',');
  const friendRows = db
    .prepare(`SELECT * FROM (${ROW_SQL}) WHERE user_id IN (${placeholders}) ORDER BY skill_score DESC`)
    .all(...ids) as unknown as DbRow[];

  return { friends: friendRows.map(toRow), incoming, outgoing };
}

export function findByNickname(db: DatabaseSync, nickname: string, me: string | null) {
  const user = db
    .prepare('SELECT id, nickname, country_code, is_bot FROM users WHERE nickname = ?')
    .get(nickname) as
    | { id: string; nickname: string; country_code: string | null; is_bot: number }
    | undefined;
  if (!user) return null;
  const stats = db
    .prepare('SELECT skill_score, xp FROM player_stats WHERE user_id = ?')
    .get(user.id) as { skill_score: number; xp: number };
  return {
    userId: user.id,
    nickname: user.nickname,
    countryCode: user.country_code,
    isBot: user.is_bot === 1,
    skillScore: stats.skill_score,
    level: 1 + Math.floor(stats.xp / 250),
    friendship: me ? friendshipStatus(db, me, user.id) : ('none' as const),
  };
}

/* ---------------------------- Мировая статистика --------------------------- */

export function worldStats(db: DatabaseSync): WorldStatsResponse {
  const today = new Date().toISOString().slice(0, 10);
  const one = <T>(sql: string, ...args: Array<string | number>) =>
    db.prepare(sql).get(...args) as T;

  const totals = one<{ answers: number; correct: number; ms: number | null }>(
    `SELECT SUM(correct + wrong) AS answers, SUM(correct) AS correct,
            SUM(avg_ms * (correct + wrong)) / NULLIF(SUM(correct + wrong), 0) AS ms
     FROM user_country_skill`,
  );
  const todayRow = one<{ answers: number | null; players: number }>(
    'SELECT SUM(answers) AS answers, COUNT(*) AS players FROM user_daily WHERE day = ?',
    today,
  );
  const players = one<{ c: number }>('SELECT COUNT(*) AS c FROM users').c;
  const bots = one<{ c: number }>('SELECT COUNT(*) AS c FROM users WHERE is_bot = 1').c;

  const hardestRows = db
    .prepare(
      `SELECT code, skill, SUM(correct) AS c, SUM(wrong) AS w,
              SUM(avg_ms * (correct + wrong)) / NULLIF(SUM(correct + wrong), 0) AS ms
       FROM user_country_skill
       GROUP BY code, skill
       HAVING (SUM(correct) + SUM(wrong)) >= ?`,
      // Порог отсекает страны, по которым мало данных.
    )
    .all(HARDEST_MIN_ANSWERS) as unknown as Array<{
    code: string;
    skill: string;
    c: number;
    w: number;
    ms: number | null;
  }>;

  const entries: HardestEntry[] = hardestRows.map((r) => ({
    code: r.code,
    skill: r.skill as CountrySkill,
    accuracy: r.c / (r.c + r.w),
    avgMs: Math.round(r.ms ?? 0),
    answers: r.c + r.w,
  }));
  entries.sort((x, y) => x.accuracy - y.accuracy);

  const hardestBySkill: WorldStatsResponse['hardestBySkill'] = {};
  for (const entry of entries) {
    (hardestBySkill[entry.skill] ??= []).push(entry);
  }
  for (const skill of Object.keys(hardestBySkill) as CountrySkill[]) {
    hardestBySkill[skill] = hardestBySkill[skill]!.slice(0, 5);
  }

  const confusion = db
    .prepare(
      `SELECT a, b, skill, SUM(cnt) AS total FROM user_confusions
       GROUP BY a, b, skill ORDER BY total DESC LIMIT 1`,
    )
    .get() as { a: string; b: string; skill: string; total: number } | undefined;

  const longestStreak =
    one<{ m: number | null }>('SELECT MAX(best_answer_streak) AS m FROM player_stats').m ?? 0;

  const masteredAllSkills = one<{ c: number }>(
    'SELECT COUNT(*) AS c FROM player_stats WHERE mastered_skills >= ?',
    TOTAL_SKILLS,
  ).c;
  // «Все страны» — освоена хотя бы одна карточка каждой из 194 стран.
  const masteredAllCountries = one<{ c: number }>(
    `SELECT COUNT(*) AS c FROM (
       SELECT user_id FROM user_country_skill WHERE mastered = 1
       GROUP BY user_id HAVING COUNT(DISTINCT code) >= 194
     )`,
  ).c;

  const duels = one<{ c: number }>("SELECT COUNT(*) AS c FROM matches WHERE kind = 'duel'").c;
  const battles = one<{ c: number }>(
    "SELECT COUNT(*) AS c FROM matches WHERE kind = 'battle_royale'",
  ).c;

  return {
    totalAnswers: totals.answers ?? 0,
    answersToday: todayRow.answers ?? 0,
    activeToday: todayRow.players,
    avgAccuracy: totals.answers ? (totals.correct ?? 0) / totals.answers : 0,
    avgMs: Math.round(totals.ms ?? 0),
    players,
    hasDemoData: bots > 0,
    hardestBySkill,
    hardestCountry: entries[0] ?? null,
    topConfusion: confusion
      ? { a: confusion.a, b: confusion.b, skill: confusion.skill as CountrySkill, count: confusion.total }
      : null,
    longestStreak,
    duelsPlayed: duels,
    battlesPlayed: battles,
    masteredAllCountries,
    masteredAllSkills,
  };
}

export function personalServerStats(db: DatabaseSync, userId: string) {
  return db.prepare('SELECT * FROM player_stats WHERE user_id = ?').get(userId) as
    | Record<string, number | string | null>
    | undefined;
}
