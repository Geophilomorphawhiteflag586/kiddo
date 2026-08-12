'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import FlagImage from '@/components/FlagImage';
import Hud from '@/components/Hud';
import {
  ApiError,
  fetchFriends,
  fetchLeaderboard,
  fetchWorldStats,
  friendAction,
  registerAccount,
  searchUser,
  syncNow,
  type FriendsResponse,
} from '@/lib/competitive/api';
import { BREAKDOWN_LABELS, LEADERBOARD_PAGE_SIZE, leagueOf } from '@/lib/competitive/config';
import type {
  LeaderboardResponse,
  LeaderboardRow,
  PublicUser,
  SyncResponse,
  WorldStatsResponse,
} from '@/lib/competitive/types';
import { COUNTRIES, getCountry } from '@/lib/countries';
import { MODES } from '@/lib/modes';
import { SKILL_META } from '@/lib/skills';
import { useActiveData, useActiveProfile, useHydrated } from '@/lib/store';
import type { CountrySkill } from '@/lib/types';

type Tab = 'alltime' | 'friends' | 'records' | 'world' | 'battle';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'alltime', label: 'All-time' },
  { id: 'friends', label: 'Друзья' },
  { id: 'records', label: 'Рекорды' },
  { id: 'world', label: 'Статистика мира' },
  { id: 'battle', label: 'Battle Royale' },
];

const fmt = (n: number) => n.toLocaleString('ru-RU');
const pct = (x: number) => `${Math.round(x * 100)}%`;
const sec = (ms: number | null) => (ms === null ? '—' : `${(ms / 1000).toFixed(1)} сек`);

export default function LeaderboardPage() {
  const hydrated = useHydrated();
  const profile = useActiveProfile();
  const [tab, setTab] = useState<Tab>('alltime');
  const [sync, setSync] = useState<SyncResponse | null>(null);

  // При входе в раздел отправляем свежий прогресс на сервер.
  useEffect(() => {
    if (!hydrated || !profile.account) return;
    syncNow()
      .then(setSync)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- один раз на профиль
  }, [hydrated, profile.id]);

  return (
    <div className="min-h-dvh">
      <Hud />
      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-4 sm:px-6">
        <h1 className="text-2xl font-extrabold">Рейтинг</h1>
        <p className="mt-1 text-sm text-slate-400">
          Skill Score показывает знания, XP — активность, ELO — успех в соревнованиях.
        </p>

        <div className="mt-4 flex flex-wrap gap-1.5" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3.5 py-2 text-sm font-bold transition ${
                tab === t.id
                  ? 'bg-accent text-white'
                  : 'border border-line bg-ink-800 text-slate-400 hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {hydrated && !profile.account && <RegisterPanel />}

        <div className="mt-4">
          {tab === 'alltime' && <AllTimeTab sync={sync} hasAccount={!!profile.account} />}
          {tab === 'friends' && <FriendsTab hasAccount={!!profile.account} />}
          {tab === 'records' && <RecordsTab sync={sync} />}
          {tab === 'world' && <WorldTab />}
          {tab === 'battle' && <BattleTab />}
        </div>
      </main>
    </div>
  );
}

/* ------------------------------- Регистрация ------------------------------ */

function RegisterPanel() {
  const [nickname, setNickname] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await registerAccount(nickname.trim(), countryCode || null);
      await syncNow().catch(() => {});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Сервер недоступен');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="panel mt-4 p-4">
      <p className="font-extrabold">Придумайте уникальный никнейм</p>
      <p className="mt-1 text-sm text-slate-400">
        Он нужен для участия в глобальном рейтинге, добавления друзей и будущих дуэлей.
        Прогресс обучения останется на этом устройстве.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Никнейм (3–20 символов)"
          maxLength={20}
          className="w-56 rounded-lg border border-line bg-ink-950 px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
        <select
          value={countryCode}
          onChange={(e) => setCountryCode(e.target.value)}
          className="w-48 rounded-lg border border-line bg-ink-950 px-3 py-2 text-sm focus:border-accent focus:outline-none"
          aria-label="Флаг профиля"
        >
          <option value="">Без флага</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.emoji} {c.name}
            </option>
          ))}
        </select>
        <button type="submit" disabled={busy} className="btn-primary px-5 py-2 text-sm disabled:opacity-50">
          {busy ? 'Создаём…' : 'Создать'}
        </button>
      </div>
      {error && <p className="mt-2 text-sm font-bold text-rose-300">{error}</p>}
    </form>
  );
}

/* -------------------------------- All-time -------------------------------- */

function AllTimeTab({ sync, hasAccount }: { sync: SyncResponse | null; hasAccount: boolean }) {
  const [page, setPage] = useState(0);
  const [board, setBoard] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboard(page)
      .then(setBoard)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Сервер недоступен'));
  }, [page, sync]);

  if (error) return <p className="panel p-4 text-sm text-rose-300">{error}</p>;
  if (!board) return <div className="panel h-48 animate-pulse" />;

  const medal = ['🥇', '🥈', '🥉'];

  return (
    <div className="space-y-4">
      {hasAccount && sync && (
        <div className="panel flex flex-wrap items-center gap-x-8 gap-y-2 p-4">
          <div>
            <p className="panel-title">Ваш Skill Score</p>
            <p className="text-2xl font-extrabold text-accent">{fmt(sync.skillScore.totalScore)}</p>
          </div>
          <div>
            <p className="panel-title">Ваша позиция</p>
            <p className="text-2xl font-extrabold">
              {fmt(sync.position)}
              <span className="ml-2 text-sm font-bold text-slate-400">
                топ {Math.max(1, Math.ceil((sync.position / Math.max(1, sync.totalPlayers)) * 100))}%
              </span>
            </p>
          </div>
          <div className="min-w-48 flex-1 text-xs text-slate-400">
            {(Object.keys(BREAKDOWN_LABELS) as Array<keyof typeof BREAKDOWN_LABELS>).map((k) => (
              <div key={k} className="flex justify-between gap-4">
                <span>{BREAKDOWN_LABELS[k]}</span>
                <span className="font-bold tabular-nums text-slate-400">
                  {fmt(sync.skillScore[k])}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel divide-y divide-line">
        {board.rows.map((row) => (
          <PlayerRow key={row.userId} row={row} medal={medal[row.position - 1]} />
        ))}
        {board.rows.length === 0 && (
          <p className="p-4 text-sm text-slate-400">
            Пока пусто. Запустите <code>npm run seed:demo</code>, чтобы заполнить рейтинг
            демо-ботами, или сыграйте сессию.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between text-sm">
        <button
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
          className="btn-ghost px-4 py-2 disabled:opacity-40"
        >
          ← Назад
        </button>
        <span className="text-slate-400">
          Страница {page + 1} из {Math.max(1, Math.ceil(board.total / LEADERBOARD_PAGE_SIZE))}
        </span>
        <button
          disabled={(page + 1) * LEADERBOARD_PAGE_SIZE >= board.total}
          onClick={() => setPage((p) => p + 1)}
          className="btn-ghost px-4 py-2 disabled:opacity-40"
        >
          Вперёд →
        </button>
      </div>

      {board.me && board.me.position > (page + 1) * LEADERBOARD_PAGE_SIZE && (
        <div className="panel flex items-center justify-between p-4">
          <span className="font-bold">
            Ваша позиция: {fmt(board.me.position)} · вы входите в топ {board.me.percentile}%
          </span>
          <span className="font-extrabold text-accent">{fmt(board.me.row.skillScore)}</span>
        </div>
      )}
    </div>
  );
}

function PlayerRow({ row, medal }: { row: LeaderboardRow; medal?: string }) {
  const league = leagueOf(row.elo);
  const country = row.countryCode ? getCountry(row.countryCode) : null;
  const tone =
    row.position === 1
      ? 'bg-amber-400/10'
      : row.position === 2
        ? 'bg-slate-300/5'
        : row.position === 3
          ? 'bg-orange-700/10'
          : '';

  return (
    <div className={`flex items-center gap-3 p-3 ${tone}`}>
      <span className="w-10 shrink-0 text-center text-lg font-extrabold text-slate-400">
        {medal ?? row.position}
      </span>
      <span
        aria-hidden
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-indigo-600 font-extrabold text-white"
      >
        {row.nickname.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate font-extrabold">
          {row.nickname}
          {country && <span aria-hidden>{country.emoji}</span>}
          {row.isBot && (
            <span className="rounded bg-slate-700 px-1.5 text-[10px] font-bold text-slate-400">
              бот
            </span>
          )}
        </p>
        <p className="truncate text-xs text-slate-400">
          Освоено {fmt(row.masteredSkills)} / {fmt(row.totalSkills)} · точность {pct(row.accuracy)}
          {' · '}
          {sec(row.avgMs)} · серия {fmt(row.bestAnswerStreak)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-extrabold text-accent">{fmt(row.skillScore)}</p>
        <p className="text-xs text-slate-400">
          {league ? `${league.emoji} ${league.name}` : 'Без ранга'}
        </p>
      </div>
    </div>
  );
}

/* --------------------------------- Друзья --------------------------------- */

function FriendsTab({ hasAccount }: { hasAccount: boolean }) {
  const me = useActiveProfile();
  const [data, setData] = useState<FriendsResponse | null>(null);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<PublicUser | null | 'searching' | 'empty'>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!hasAccount) return;
    fetchFriends()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Сервер недоступен'));
  }, [hasAccount]);

  useEffect(reload, [reload]);

  if (!hasAccount) {
    return <p className="panel p-4 text-sm text-slate-400">Создайте никнейм, чтобы добавлять друзей.</p>;
  }

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setFound('searching');
    const res = await searchUser(query.trim()).catch(() => ({ user: null }));
    setFound(res.user ?? 'empty');
  };

  const act = async (action: 'request' | 'accept' | 'decline' | 'remove' | 'block', userId: string) => {
    try {
      await friendAction(action, userId);
      reload();
      if (found && typeof found === 'object' && found.userId === userId) {
        setFound({ ...found, friendship: action === 'request' ? 'pending_sent' : found.friendship });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка');
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={search} className="panel p-4">
        <p className="panel-title mb-2">Добавить друга</p>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Введите никнейм"
            className="w-64 rounded-lg border border-line bg-ink-950 px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
          <button type="submit" className="btn-primary px-5 py-2 text-sm">
            Найти
          </button>
        </div>

        {found === 'empty' && <p className="mt-2 text-sm text-slate-400">Никто не найден.</p>}
        {found && typeof found === 'object' && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-ink-700/50 p-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-accent to-indigo-600 font-extrabold text-white">
              {found.nickname.slice(0, 1).toUpperCase()}
            </span>
            <div className="flex-1">
              <p className="font-extrabold">
                {found.nickname}{' '}
                {found.isBot && <span className="rounded bg-slate-700 px-1.5 text-[10px]">бот</span>}
              </p>
              <p className="text-xs text-slate-400">
                Skill Score {fmt(found.skillScore)} · уровень {found.level}
              </p>
            </div>
            {found.friendship === 'none' && (
              <button onClick={() => act('request', found.userId)} className="btn-primary px-4 py-2 text-sm">
                Добавить
              </button>
            )}
            {found.friendship === 'pending_sent' && (
              <span className="text-sm text-slate-400">Заявка отправлена</span>
            )}
            {found.friendship === 'accepted' && <span className="text-sm text-emerald-300">Уже в друзьях</span>}
          </div>
        )}
      </form>

      {error && <p className="text-sm font-bold text-rose-300">{error}</p>}

      {data && data.incoming.length > 0 && (
        <div className="panel p-4">
          <p className="panel-title mb-2">Входящие заявки</p>
          {data.incoming.map((r) => (
            <div key={r.userId} className="flex items-center gap-3 py-1.5">
              <span className="flex-1 font-bold">{r.nickname}</span>
              <button onClick={() => act('accept', r.userId)} className="btn-primary px-3 py-1.5 text-xs">
                Принять
              </button>
              <button onClick={() => act('decline', r.userId)} className="btn-ghost px-3 py-1.5 text-xs">
                Отклонить
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="panel divide-y divide-line">
        <p className="panel-title p-4 pb-2">Рейтинг среди друзей</p>
        {(data?.friends ?? []).map((row, i) => {
          const isMe = row.nickname === me.account?.nickname;
          return (
            <div key={row.userId} className={`flex items-center gap-3 p-3 ${isMe ? 'bg-accent/10' : ''}`}>
              <span className="w-8 text-center font-extrabold text-slate-400">{i + 1}</span>
              <span className="flex-1 truncate font-bold">
                {isMe ? 'Вы' : row.nickname}
                {row.isBot && (
                  <span className="ml-1.5 rounded bg-slate-700 px-1.5 text-[10px]">бот</span>
                )}
              </span>
              <span className="font-extrabold text-accent">{fmt(row.skillScore)}</span>
              {!isMe && (
                <>
                  <button
                    title="Дуэли появятся на этапе 2"
                    disabled
                    className="btn-ghost cursor-not-allowed px-3 py-1.5 text-xs opacity-50"
                  >
                    ⚔ Вызвать на дуэль
                  </button>
                  <button
                    onClick={() => act('remove', row.userId)}
                    className="rounded px-2 py-1 text-xs text-slate-500 hover:text-rose-300"
                  >
                    удалить
                  </button>
                </>
              )}
            </div>
          );
        })}
        {data && data.friends.length <= 1 && (
          <p className="p-4 text-sm text-slate-400">Пока никого — найдите друга по никнейму выше.</p>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- Рекорды -------------------------------- */

function RecordsTab({ sync }: { sync: SyncResponse | null }) {
  const data = useActiveData();

  const rows: Array<[string, string | number]> = [
    ['Лучшая серия ответов', data.bestHotStreak],
    ['Текущая серия ответов', data.hotStreak],
    ['Лучшая серия дней', `${data.bestDayStreak ?? 0} дн.`],
    ['Текущая серия дней', `${data.dayStreak} дн.`],
    ['Максимальный Skill Score', sync ? fmt(sync.maxSkillScore) : '—'],
    ['Побед в дуэлях', '— (этап 2)'],
    ['Побед в Battle Royale', '— (этап 3)'],
    ['ELO', 'Без ранга (этап 2)'],
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map(([label, value]) => (
          <div key={label} className="panel p-4">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="mt-1 text-xl font-extrabold">{value}</p>
          </div>
        ))}
      </div>

      <div className="panel p-4">
        <p className="panel-title mb-3">Лучшие сессии по режимам</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MODES.filter((m) => !m.hidden).map((mode) => {
            const best = data.bestSessions?.[mode.slug];
            return (
              <div key={mode.slug} className="flex items-center gap-3 rounded-xl border border-line bg-ink-700/40 p-3">
                <span
                  aria-hidden
                  className="grid h-9 w-9 place-items-center rounded-lg text-lg"
                  style={{ background: `${SKILL_META[mode.skills[0]].color}26` }}
                >
                  {mode.emoji}
                </span>
                <div>
                  <p className="text-sm font-extrabold">{mode.title}</p>
                  <p className="text-xs text-slate-400">
                    {best
                      ? `${best.correct}/${best.total} · ${(best.avgMs / 1000).toFixed(1)} сек`
                      : 'Ещё не сыграно'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Статистика мира ---------------------------- */

const HARDEST_TITLES: Partial<Record<CountrySkill, string>> = {
  flagToCountry: 'Самые сложные флаги',
  countryToCapital: 'Самые сложные столицы',
  outlineToCountry: 'Самые сложные контуры',
  countryLocation: 'Самые сложные страны на карте',
};

function WorldTab() {
  const [stats, setStats] = useState<WorldStatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWorldStats()
      .then(setStats)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Сервер недоступен'));
  }, []);

  if (error) return <p className="panel p-4 text-sm text-rose-300">{error}</p>;
  if (!stats) return <div className="panel h-48 animate-pulse" />;

  const cells: Array<[string, string]> = [
    ['Вопросов всего', fmt(stats.totalAnswers)],
    ['Вопросов сегодня', fmt(stats.answersToday)],
    ['Активных игроков сегодня', fmt(stats.activeToday)],
    ['Игроков всего', fmt(stats.players)],
    ['Средняя точность', pct(stats.avgAccuracy)],
    ['Среднее время', sec(stats.avgMs || null)],
    ['Рекордная серия в мире', fmt(stats.longestStreak)],
    ['Дуэлей сыграно', fmt(stats.duelsPlayed)],
    ['Battle Royale сыграно', fmt(stats.battlesPlayed)],
    ['Освоили все страны', fmt(stats.masteredAllCountries)],
    ['Освоили все навыки', fmt(stats.masteredAllSkills)],
  ];

  return (
    <div className="space-y-4">
      {stats.hasDemoData && (
        <p className="rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-200">
          В статистике есть демо-данные ботов — они помечены и будут удалены после запуска.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {cells.map(([label, value]) => (
          <div key={label} className="panel p-4">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="mt-1 text-xl font-extrabold">{value}</p>
          </div>
        ))}
      </div>

      {stats.topConfusion && (
        <div className="panel flex items-center gap-3 p-4">
          <FlagImage code={stats.topConfusion.a} size={30} />
          <FlagImage code={stats.topConfusion.b} size={30} />
          <p className="font-bold">
            Самая частая путаница: {getCountry(stats.topConfusion.a)?.name} ↔{' '}
            {getCountry(stats.topConfusion.b)?.name}
            <span className="ml-2 text-sm font-semibold text-slate-400">
              {SKILL_META[stats.topConfusion.skill].short} · {fmt(stats.topConfusion.count)} раз
            </span>
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {(Object.keys(HARDEST_TITLES) as CountrySkill[]).map((skill) => {
          const list = stats.hardestBySkill[skill] ?? [];
          return (
            <div key={skill} className="panel p-4">
              <p className="panel-title mb-2">{HARDEST_TITLES[skill]}</p>
              {list.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Недостаточно данных (нужно ≥ 100 ответов на страну).
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {list.map((entry, i) => (
                    <li key={entry.code} className="flex items-center gap-2.5 text-sm">
                      <span className="w-4 text-slate-500">{i + 1}</span>
                      <FlagImage code={entry.code} size={20} />
                      <span className="flex-1 truncate font-bold">
                        {getCountry(entry.code)?.name}
                        {skill === 'countryToCapital' && (
                          <span className="ml-1 text-slate-400">
                            — {getCountry(entry.code)?.capital}
                          </span>
                        )}
                      </span>
                      <span className="font-extrabold text-rose-300">{pct(entry.accuracy)}</span>
                      <span className="w-16 text-right text-xs text-slate-400">
                        {sec(entry.avgMs)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ Battle Royale ----------------------------- */

function BattleTab() {
  return (
    <div className="panel p-6">
      <p className="text-3xl" aria-hidden>
        ⚔️
      </p>
      <h2 className="mt-2 text-xl font-extrabold">Battle Royale — этап 3</h2>
      <p className="mt-2 max-w-xl text-sm text-slate-400">
        До 100 игроков, 20 одинаковых вопросов, позиция меняется после каждого ответа, никто не
        выбывает до конца. XP и рейтинг — по итоговому месту. Дуэли 1 на 1 с ELO придут раньше —
        на этапе 2.
      </p>
      <div className="mt-4 grid max-w-md gap-2 text-sm">
        <div className="flex justify-between rounded-lg border border-line bg-ink-700/40 px-3 py-2">
          <span className="text-slate-400">Формат</span>
          <span className="font-bold">100 игроков · 20 вопросов · 8–10 минут</span>
        </div>
        <div className="flex justify-between rounded-lg border border-line bg-ink-700/40 px-3 py-2">
          <span className="text-slate-400">Ежедневные турниры</span>
          <span className="font-bold">12:00 · 18:00 · 21:00</span>
        </div>
        <div className="flex justify-between rounded-lg border border-line bg-ink-700/40 px-3 py-2">
          <span className="text-slate-400">Награда за 1 место</span>
          <span className="font-bold">1 000 XP</span>
        </div>
      </div>
      <Link href="/" className="btn-ghost mt-5 inline-block px-5 py-2.5 text-sm">
        Пока потренироваться
      </Link>
    </div>
  );
}
