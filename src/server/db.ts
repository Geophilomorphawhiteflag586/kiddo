/**
 * SQLite через встроенный node:sqlite — ноль внешних зависимостей, файл лежит
 * в data/mapapp.db. Схема написана переносимо: миграция на Postgres при
 * масштабировании — замена этого модуля, а не переписывание запросов.
 *
 * Таблицы дуэлей и Battle Royale создаются уже сейчас (этапы 2–3 пишут в них),
 * но в этапе 1 не используются.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  nickname      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  secret_hash   TEXT NOT NULL,
  country_code  TEXT,
  is_bot        INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  last_seen_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS player_stats (
  user_id            TEXT PRIMARY KEY REFERENCES users(id),
  skill_score        INTEGER NOT NULL DEFAULT 0,
  mastery_score      INTEGER NOT NULL DEFAULT 0,
  accuracy_score     INTEGER NOT NULL DEFAULT 0,
  speed_score        INTEGER NOT NULL DEFAULT 0,
  retention_score    INTEGER NOT NULL DEFAULT 0,
  streak_score       INTEGER NOT NULL DEFAULT 0,
  difficulty_score   INTEGER NOT NULL DEFAULT 0,
  max_skill_score    INTEGER NOT NULL DEFAULT 0,
  xp                 INTEGER NOT NULL DEFAULT 0,
  elo                INTEGER,
  elo_games          INTEGER NOT NULL DEFAULT 0,
  mastered_skills    INTEGER NOT NULL DEFAULT 0,
  accuracy           REAL NOT NULL DEFAULT 0,
  avg_ms             INTEGER,
  best_answer_streak INTEGER NOT NULL DEFAULT 0,
  best_day_streak    INTEGER NOT NULL DEFAULT 0,
  duel_wins          INTEGER NOT NULL DEFAULT 0,
  duel_losses        INTEGER NOT NULL DEFAULT 0,
  br_games           INTEGER NOT NULL DEFAULT 0,
  br_wins            INTEGER NOT NULL DEFAULT 0,
  br_top3            INTEGER NOT NULL DEFAULT 0,
  br_top10           INTEGER NOT NULL DEFAULT 0,
  br_best_place      INTEGER,
  br_place_sum       INTEGER NOT NULL DEFAULT 0,
  br_percentile_sum  REAL NOT NULL DEFAULT 0,
  updated_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stats_score ON player_stats(skill_score DESC);

CREATE TABLE IF NOT EXISTS friendships (
  user_a       TEXT NOT NULL REFERENCES users(id),
  user_b       TEXT NOT NULL REFERENCES users(id),
  requested_by TEXT NOT NULL,
  status       TEXT NOT NULL, -- pending | accepted | blocked_by_a | blocked_by_b
  created_at   TEXT NOT NULL,
  PRIMARY KEY (user_a, user_b),
  CHECK (user_a < user_b)
);

CREATE TABLE IF NOT EXISTS user_country_skill (
  user_id TEXT NOT NULL REFERENCES users(id),
  code    TEXT NOT NULL,
  skill   TEXT NOT NULL,
  correct INTEGER NOT NULL,
  wrong   INTEGER NOT NULL,
  avg_ms  INTEGER,
  mastered INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, code, skill)
);
CREATE INDEX IF NOT EXISTS idx_ucs_code ON user_country_skill(code, skill);

CREATE TABLE IF NOT EXISTS user_confusions (
  user_id TEXT NOT NULL REFERENCES users(id),
  a       TEXT NOT NULL,
  b       TEXT NOT NULL,
  skill   TEXT NOT NULL,
  cnt     INTEGER NOT NULL,
  PRIMARY KEY (user_id, a, b, skill)
);

CREATE TABLE IF NOT EXISTS user_daily (
  user_id TEXT NOT NULL REFERENCES users(id),
  day     TEXT NOT NULL,
  answers INTEGER NOT NULL,
  PRIMARY KEY (user_id, day)
);
CREATE INDEX IF NOT EXISTS idx_daily_day ON user_daily(day);

-- ---- Модуль математики ----

CREATE TABLE IF NOT EXISTS math_stats (
  user_id    TEXT NOT NULL REFERENCES users(id),
  operation  TEXT NOT NULL,
  level      TEXT NOT NULL,
  solved     INTEGER NOT NULL DEFAULT 0,
  correct    INTEGER NOT NULL DEFAULT 0,
  wrong      INTEGER NOT NULL DEFAULT 0,
  total_ms   INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, operation, level)
);

CREATE TABLE IF NOT EXISTS math_answers (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          TEXT NOT NULL REFERENCES users(id),
  operation        TEXT NOT NULL,
  level            TEXT NOT NULL,
  operand_a        INTEGER NOT NULL,
  operand_b        INTEGER NOT NULL,
  user_answer      INTEGER NOT NULL,
  is_correct       INTEGER NOT NULL,
  response_time_ms INTEGER NOT NULL,
  suspicious       INTEGER NOT NULL DEFAULT 0,
  answered_at      TEXT NOT NULL          -- серверный timestamp
);
CREATE INDEX IF NOT EXISTS idx_math_answers_user ON math_answers(user_id, level);

-- ---- Этапы 2–3: дуэли и Battle Royale (схема готова заранее) ----

CREATE TABLE IF NOT EXISTS matches (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,           -- duel | battle_royale
  category    TEXT NOT NULL,           -- mixed | flags | capitals | map | outline | континент
  status      TEXT NOT NULL,           -- lobby | running | finished | cancelled
  created_at  TEXT NOT NULL,
  started_at  TEXT,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS match_participants (
  match_id    TEXT NOT NULL REFERENCES matches(id),
  user_id     TEXT NOT NULL REFERENCES users(id),
  place       INTEGER,
  score       INTEGER NOT NULL DEFAULT 0,
  correct     INTEGER NOT NULL DEFAULT 0,
  answered    INTEGER NOT NULL DEFAULT 0,
  avg_ms      INTEGER,
  best_combo  INTEGER NOT NULL DEFAULT 0,
  elo_before  INTEGER,
  elo_after   INTEGER,
  xp_awarded  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (match_id, user_id)
);

CREATE TABLE IF NOT EXISTS match_questions (
  match_id   TEXT NOT NULL REFERENCES matches(id),
  idx        INTEGER NOT NULL,
  skill      TEXT NOT NULL,
  code       TEXT NOT NULL,
  options    TEXT NOT NULL,             -- JSON-массив кодов
  PRIMARY KEY (match_id, idx)
);

CREATE TABLE IF NOT EXISTS match_answers (
  match_id        TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  question_idx    INTEGER NOT NULL,
  selected        TEXT NOT NULL,
  is_correct      INTEGER NOT NULL,
  response_time_ms INTEGER NOT NULL,
  score_awarded   INTEGER NOT NULL,
  answered_at     TEXT NOT NULL,        -- серверный timestamp
  PRIMARY KEY (match_id, user_id, question_idx)
);

CREATE TABLE IF NOT EXISTS rating_history (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id),
  match_id   TEXT NOT NULL,
  elo_before INTEGER NOT NULL,
  elo_after  INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS xp_transactions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id),
  amount     INTEGER NOT NULL,
  reason     TEXT NOT NULL,
  match_id   TEXT,
  created_at TEXT NOT NULL
);
`;

export function createDb(path: string): DatabaseSync {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

/** Синглтон, переживающий hot-reload в dev-режиме Next. */
const globalRef = globalThis as unknown as { __mapappDb?: DatabaseSync };

/**
 * Схема применяется один раз на каждую загрузку модуля: соединение переживает
 * hot-reload, поэтому без этого новые таблицы не появились бы до перезапуска.
 */
let schemaApplied = false;

export function getDb(): DatabaseSync {
  if (!globalRef.__mapappDb) {
    globalRef.__mapappDb = createDb(join(process.cwd(), 'data', 'mapapp.db'));
    schemaApplied = true;
  } else if (!schemaApplied) {
    globalRef.__mapappDb.exec(SCHEMA);
    schemaApplied = true;
  }
  return globalRef.__mapappDb;
}
