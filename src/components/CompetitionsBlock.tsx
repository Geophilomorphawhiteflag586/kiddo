'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { syncNow } from '@/lib/competitive/api';
import type { SyncResponse } from '@/lib/competitive/types';
import { useActiveProfile, useHydrated } from '@/lib/store';

const fmt = (n: number) => n.toLocaleString('ru-RU');

/** Блок «Соревнования» на главной: Skill Score, позиция, тизер Battle Royale. */
export default function CompetitionsBlock() {
  const hydrated = useHydrated();
  const profile = useActiveProfile();
  const [sync, setSync] = useState<SyncResponse | null>(null);

  useEffect(() => {
    if (!hydrated || !profile.account) return;
    syncNow()
      .then(setSync)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- один раз на профиль
  }, [hydrated, profile.id]);

  return (
    <section className="panel mt-4 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="panel-title">Соревнования</p>
        <Link href="/leaderboard" className="text-xs font-bold text-accent hover:text-violet-800">
          Открыть рейтинг →
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-ink-700/40 p-3.5">
          <p className="text-xs text-slate-400">Ваш Skill Score</p>
          {profile.account && sync ? (
            <>
              <p className="mt-1 text-2xl font-extrabold text-accent">
                {fmt(sync.skillScore.totalScore)}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                All-time позиция: {fmt(sync.position)} из {fmt(sync.totalPlayers)}
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-slate-400">
                Создайте никнейм, чтобы попасть в глобальный рейтинг.
              </p>
              <Link href="/leaderboard" className="btn-primary mt-2 inline-block px-4 py-1.5 text-xs">
                Создать никнейм
              </Link>
            </>
          )}
        </div>

        <div className="rounded-xl border border-line bg-ink-700/40 p-3.5">
          <p className="text-xs text-slate-400">Ваш PvP рейтинг</p>
          <p className="mt-1 text-2xl font-extrabold">Без ранга</p>
          <p className="mt-0.5 text-xs text-slate-400">Дуэли 1 на 1 с ELO — этап 2</p>
        </div>

        <div className="rounded-xl border border-line bg-ink-700/40 p-3.5">
          <p className="text-xs text-slate-400">Daily Battle Royale</p>
          <p className="mt-1 text-2xl font-extrabold">Скоро</p>
          <p className="mt-0.5 text-xs text-slate-400">
            100 игроков · 20 вопросов · этап 3.{' '}
            <Link href="/leaderboard" className="text-accent hover:underline">
              Подробнее
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
