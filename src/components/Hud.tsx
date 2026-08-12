'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { primeSpeech } from '@/lib/speech';
import { useActiveData, useHydrated } from '@/lib/store';
import ProfileMenu from './ProfileMenu';

const NAV = [
  { href: '/learn', label: 'Учиться' },
  { href: '/', label: 'География' },
  { href: '/progress', label: 'Прогресс' },
  { href: '/leaderboard', label: 'Рейтинг' },
  { href: '/progress#achievements', label: 'Достижения' },
];

function Chip({ emoji, value, title }: { emoji: string; value: string | number; title: string }) {
  return (
    <div
      title={title}
      className="flex items-center gap-1.5 rounded-full border border-line bg-ink-800 px-3 py-1.5 text-sm font-extrabold"
    >
      <span aria-hidden>{emoji}</span>
      <span className="tabular-nums">{value}</span>
      <span className="sr-only">{title}</span>
    </div>
  );
}

export default function Hud() {
  const hydrated = useHydrated();
  const data = useActiveData();
  const pathname = usePathname();

  // Браузер блокирует речь до первого действия пользователя, а самый первый
  // вызов после разблокировки идёт с задержкой. «Прогреваем» синтез заранее,
  // чтобы озвучка в заданиях срабатывала мгновенно.
  useEffect(() => {
    const onFirstGesture = () => primeSpeech();
    window.addEventListener('pointerdown', onFirstGesture, { once: true });
    window.addEventListener('keydown', onFirstGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', onFirstGesture);
      window.removeEventListener('keydown', onFirstGesture);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink-950/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-6 px-4 sm:px-6">
        <Link href="/learn" className="flex items-center gap-2 text-base font-extrabold tracking-tight">
          <span
            aria-hidden
            className="grid h-7 w-7 place-items-center rounded-lg bg-accent/20 text-sm"
          >
            🌍
          </span>
          MAPAPP
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Основная навигация">
          {NAV.map((item) => {
            const active =
              item.href === pathname || (item.href.startsWith('/#') && pathname === '/');
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-bold transition ${
                  active && !item.href.includes('#')
                    ? 'bg-ink-700 text-white'
                    : 'text-slate-400 hover:bg-ink-800 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {hydrated ? (
            <>
              <div className="hidden items-center gap-2 sm:flex">
                <Chip emoji="⭐" value={`${data.xp} XP`} title="Очки опыта" />
                <Chip emoji="🪙" value={data.coins} title="Монеты" />
              </div>
              <ProfileMenu />
            </>
          ) : (
            <div className="h-9 w-56 animate-pulse rounded-full bg-ink-700" />
          )}
        </div>
      </div>
    </header>
  );
}
