'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useActiveData, useActiveProfile, useHydrated } from '@/lib/store';
import KiddoLogo from './KiddoLogo';
import { levelOf } from './ProfileMenu';

/**
 * Постоянная боковая панель — каркас интерфейса.
 *
 * Панель зафиксирована слева, а содержимое страниц сдвигается отступом у body
 * (см. globals.css). Благодаря этому разметку самих страниц менять не пришлось.
 * На узких экранах панель скрыта, навигация уезжает в верхнюю полосу.
 */

type IconName = 'learn' | 'globe' | 'chart' | 'trophy' | 'medal' | 'user' | 'gear';

const NAV: Array<{ href: string; label: string; icon: IconName }> = [
  { href: '/learn', label: 'Учиться', icon: 'learn' },
  { href: '/', label: 'География', icon: 'globe' },
  { href: '/progress', label: 'Прогресс', icon: 'chart' },
  { href: '/leaderboard', label: 'Рейтинг', icon: 'trophy' },
  { href: '/progress#achievements', label: 'Достижения', icon: 'medal' },
];

const SECONDARY: Array<{ href: string; label: string; icon: IconName }> = [
  { href: '/settings', label: 'Настройки', icon: 'gear' },
];

/** Линейные иконки одним набором: сторонняя библиотека ради семи штук не нужна. */
function Icon({ name }: { name: IconName }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (name) {
    case 'learn':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="4" />
          <path d="M8 10v4M16 10v4" />
        </svg>
      );
    case 'globe':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" />
        </svg>
      );
    case 'chart':
      return (
        <svg {...common}>
          <path d="M4 19h16" />
          <path d="M6 15l4-5 3.5 3L19 6" />
        </svg>
      );
    case 'trophy':
      return (
        <svg {...common}>
          <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
          <path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" />
          <path d="M12 14v4M9 20h6" />
        </svg>
      );
    case 'medal':
      return (
        <svg {...common}>
          <circle cx="12" cy="15" r="5" />
          <path d="M8.5 10.5 6 3h12l-2.5 7.5" />
        </svg>
      );
    case 'user':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>
      );
    case 'gear':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
        </svg>
      );
  }
}

function NavLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: IconName;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
        active
          ? 'bg-accent text-white shadow-[0_8px_20px_-10px_rgba(108,79,216,0.9)]'
          : 'text-slate-400 hover:bg-shell-soft hover:text-white'
      }`}
    >
      <Icon name={icon} />
      {label}
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const profile = useActiveProfile();
  const data = useActiveData();

  const isActive = (href: string) => !href.includes('#') && href === pathname;

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[15.5rem] flex-col bg-shell p-4 lg:flex">
      <Link href="/learn" className="mb-7 mt-2 flex items-center gap-2.5 px-2">
        <KiddoLogo className="text-[28px]" sparkles={false} />
        <span className="sr-only">Kiddo — на главную</span>
      </Link>

      <nav className="flex flex-col gap-1" aria-label="Основная навигация">
        {NAV.map((item) => (
          <NavLink key={item.label} {...item} active={isActive(item.href)} />
        ))}
      </nav>

      <div className="my-4 h-px bg-white/10" />

      <nav className="flex flex-col gap-1" aria-label="Дополнительно">
        {SECONDARY.map((item) => (
          <NavLink key={item.label} {...item} active={isActive(item.href)} />
        ))}
      </nav>

      {/* Карточка профиля внизу — как в макете: кто занимается и его уровень. */}
      <Link
        href="/settings"
        className="mt-auto flex items-center gap-3 rounded-2xl bg-shell-soft p-3 transition hover:bg-white/10"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-yellow text-shell">
          <Icon name="user" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-extrabold text-white">
            {hydrated ? (profile?.name ?? 'Гость') : '—'}
          </span>
          <span className="block text-xs text-slate-400">
            {hydrated ? `Уровень ${levelOf(data.xp)} · ${data.xp} XP` : ' '}
          </span>
        </span>
      </Link>
    </aside>
  );
}
