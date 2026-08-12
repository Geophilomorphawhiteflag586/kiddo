/**
 * Заполняет соревновательную БД демо-ботами, чтобы лидерборд и мировая
 * статистика были живыми до появления реальных игроков.
 *
 *   npm run seed:demo
 *
 * Все аккаунты создаются с is_bot = 1 и в интерфейсе помечены как «бот» —
 * незаметных ботов в системе нет. Скрипт идемпотентен: повторный запуск
 * ничего не дублирует.
 */
import { join } from 'node:path';
import { COUNTRIES } from '../src/data/countries.ts';
import type { SyncCard } from '../src/lib/competitive/types.ts';
import type { CountrySkill } from '../src/lib/types.ts';
import { createDb } from '../src/server/db.ts';
import { registerUser, syncProgress } from '../src/server/repo.ts';

const db = createDb(join(process.cwd(), 'data', 'mapapp.db'));

const BOTS: Array<[string, string, number]> = [
  ['GeoBot-Max', 'DE', 0.97],
  ['GeoBot-Anna', 'PL', 0.93],
  ['GeoBot-Ali', 'TR', 0.9],
  ['GeoBot-Sofia', 'ES', 0.85],
  ['GeoBot-Leo', 'BR', 0.8],
  ['GeoBot-Mei', 'CN', 0.75],
  ['GeoBot-Omar', 'EG', 0.7],
  ['GeoBot-Nina', 'IT', 0.65],
  ['GeoBot-Jack', 'US', 0.6],
  ['GeoBot-Aiko', 'JP', 0.55],
  ['GeoBot-Ivan', 'RS', 0.5],
  ['GeoBot-Zara', 'IN', 0.45],
  ['GeoBot-Tom', 'GB', 0.4],
  ['GeoBot-Lena', 'AT', 0.35],
  ['GeoBot-Piotr', 'CZ', 0.3],
  ['GeoBot-Ida', 'SE', 0.26],
  ['GeoBot-Noah', 'CA', 0.22],
  ['GeoBot-Lucia', 'MX', 0.18],
  ['GeoBot-Karl', 'FI', 0.14],
  ['GeoBot-Rosa', 'PT', 0.1],
];

const SKILLS: CountrySkill[] = [
  'flagToCountry',
  'countryToFlag',
  'countryToCapital',
  'capitalToCountry',
  'countryLocation',
  'outlineToCountry',
];

function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let seeded = 0;
const exists = db.prepare('SELECT id FROM users WHERE nickname = ?');

for (const [nick, cc, strength] of BOTS) {
  if (exists.get(nick)) continue;
  const { userId } = registerUser(db, nick, cc, true);

  const rng = mulberry32(hash(nick));
  const cards: SyncCard[] = [];
  for (const country of COUNTRIES) {
    for (const skill of SKILLS) {
      // Сильный бот знает больше стран; редкие страны выучены реже.
      const tierFactor = country.tier === 1 ? 1 : country.tier === 2 ? 0.8 : 0.6;
      if (rng() >= strength * tierFactor) continue;
      const acc = 0.55 + strength * 0.42 * (0.7 + rng() * 0.3);
      const answers = 3 + Math.floor(rng() * 12);
      const correct = Math.round(answers * Math.min(0.99, acc));
      cards.push({
        code: country.code,
        skill,
        correct,
        wrong: answers - correct,
        avgMs: Math.round(1600 + (1 - strength) * 3500 + rng() * 800),
        interval: rng() < strength ? 21 + rng() * 40 : 1 + rng() * 15,
        repetitions: 3 + Math.floor(rng() * 6),
      });
    }
  }

  const history: Record<string, number> = {};
  for (let i = 0; i < 30; i++) {
    if (rng() > strength * 0.9) continue;
    const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    history[day] = 10 + Math.floor(rng() * 60);
  }

  const confusions =
    strength > 0.4
      ? [
          { a: 'RO', b: 'TD', skill: 'flagToCountry' as const, count: 1 + Math.floor(rng() * 6) },
          { a: 'AU', b: 'NZ', skill: 'flagToCountry' as const, count: 1 + Math.floor(rng() * 4) },
          { a: 'SI', b: 'SK', skill: 'flagToCountry' as const, count: 1 + Math.floor(rng() * 3) },
        ]
      : [];

  syncProgress(db, userId, {
    cards,
    confusions,
    history,
    xp: Math.round(3000 + strength * 25000 + rng() * 2000),
    bestAnswerStreak: Math.round(20 + strength * 800),
    bestDayStreak: Math.round(3 + strength * 45),
  });

  // Опытным ботам даём ELO, чтобы в рейтинге были видны лиги.
  if (strength > 0.5) {
    db.prepare('UPDATE player_stats SET elo = ?, elo_games = 20 WHERE user_id = ?').run(
      Math.round(1100 + strength * 1100),
      userId,
    );
  }
  seeded += 1;
}

console.log(`Добавлено демо-ботов: ${seeded}`);
