'use client';

import Link from 'next/link';
import Hud from '@/components/Hud';
import { additionMastery } from '@/modules/mathematics/mastery';
import { normalizeMathProgress } from '@/modules/mathematics/progress';
import { useActiveData, useHydrated } from '@/lib/store';

interface Operation {
  id: string;
  title: string;
  emoji: string;
  href: string | null;
  color: string;
  topics: string[];
}

const OPERATIONS: Operation[] = [
  {
    id: 'addition',
    title: 'Сложение',
    emoji: '➕',
    href: '/math/addition',
    color: '#22c55e',
    topics: ['Однозначные', 'Двузначные', 'Трёхзначные'],
  },
  {
    id: 'subtraction',
    title: 'Вычитание',
    emoji: '➖',
    href: null,
    color: '#38bdf8',
    topics: ['Однозначные', 'Двузначные', 'Трёхзначные'],
  },
  {
    id: 'multiplication',
    title: 'Умножение',
    emoji: '✖️',
    href: null,
    color: '#f59e0b',
    topics: ['Таблица умножения', 'Двузначные', 'Трёхзначные'],
  },
  {
    id: 'division',
    title: 'Деление',
    emoji: '➗',
    href: null,
    color: '#a855f7',
    topics: ['Простое', 'С остатком', 'Сложное'],
  },
];

export default function MathPage() {
  const hydrated = useHydrated();
  const data = useActiveData();
  const mastery = hydrated ? additionMastery(normalizeMathProgress(data.math)) : 0;

  return (
    <div className="min-h-dvh">
      <Hud />

      <main className="mx-auto w-full max-w-4xl px-4 pb-20 pt-8 sm:px-6">
        <Link href="/learn" className="text-sm text-slate-500 hover:text-white">
          ← Все направления
        </Link>

        <h1 className="mt-3 text-3xl font-extrabold">Математика</h1>
        <p className="mt-1 text-slate-400">Что будем изучать?</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {OPERATIONS.map((op) => {
            const soon = op.href === null;
            const content = (
              <>
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="grid h-11 w-11 place-items-center rounded-xl text-2xl"
                    style={{ background: `${op.color}22` }}
                  >
                    {op.emoji}
                  </span>
                  <span className="flex-1 text-lg font-extrabold">{op.title}</span>
                  {soon ? (
                    <span className="rounded-full border border-line bg-ink-700 px-2.5 py-1 text-[10px] font-extrabold uppercase text-slate-400">
                      Скоро
                    </span>
                  ) : (
                    <span className="text-sm font-extrabold" style={{ color: op.color }}>
                      {mastery}%
                    </span>
                  )}
                </div>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {op.topics.map((topic) => (
                    <li
                      key={topic}
                      className="rounded-lg border border-line bg-ink-700/50 px-2 py-1 text-xs text-slate-400"
                    >
                      {topic}
                    </li>
                  ))}
                </ul>
              </>
            );

            return soon ? (
              <div key={op.id} className="panel p-4 opacity-60">
                {content}
              </div>
            ) : (
              <Link
                key={op.id}
                href={op.href!}
                className="panel p-4 transition hover:-translate-y-0.5 hover:border-accent/50"
              >
                {content}
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
