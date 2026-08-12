'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { primeSpeech } from '@/lib/speech';
import { useActiveData, useHydrated } from '@/lib/store';
import KiddoLogo from './KiddoLogo';
import ProfileMenu from './ProfileMenu';
import Sidebar from './Sidebar';

/**
 * Оболочка интерфейса: боковая панель плюс верхняя полоса со счётчиками.
 *
 * Компонент по-прежнему называется Hud и вставляется в начало каждой страницы,
 * поэтому разметку двадцати экранов менять не пришлось. Сдвиг содержимого
 * вправо делает отступ у body (globals.css), а не обёртка вокруг страниц.
 */

const MOBILE_NAV = [
  { href: '/learn', label: 'Учиться' },
  { href: '/', label: 'География' },
  { href: '/progress', label: 'Прогресс' },
  { href: '/leaderboard', label: 'Рейтинг' },
];

function Chip({ emoji, value, title }: { emoji: string; value: string | number; title: string }) {
  return (
    <div
      title={title}
      className="flex items-center gap-1.5 rounded-full border border-line bg-ink-800 px-3.5 py-1.5 text-sm font-extrabold shadow-[0_2px_8px_-4px_rgba(27,33,64,0.25)]"
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
    <>
      <Sidebar />

      <header className="sticky top-0 z-30 bg-ink-950/85 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-[1400px] flex-wrap items-center gap-3 px-4 py-2.5 sm:px-6">
          {/* Логотип нужен только там, где боковой панели не видно. */}
          <Link href="/learn" className="lg:hidden">
            <KiddoLogo className="text-[24px]" sparkles={false} />
            <span className="sr-only">Kiddo — на главную</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex lg:hidden" aria-label="Навигация">
            {MOBILE_NAV.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-bold transition ${
                  item.href === pathname
                    ? 'bg-accent text-white'
                    : 'text-slate-500 hover:bg-ink-700 hover:text-ink'
                }`}
              >
                {item.label}
              </Link>
            ))}
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

      {/* Нижняя панель на телефоне: до неё дотягивается большой палец. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-line bg-ink-800 md:hidden"
        aria-label="Навигация"
      >
        {MOBILE_NAV.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={`flex-1 py-3 text-center text-xs font-extrabold transition ${
              item.href === pathname ? 'text-accent' : 'text-slate-500'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
