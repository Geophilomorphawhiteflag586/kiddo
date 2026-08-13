'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import Hud from '@/components/Hud';
import { useActiveData, useHydrated } from '@/lib/store';
import { CATEGORY_META, CATEGORY_ORDER } from '@/modules/people/config';
import { isLearned, summarize } from '@/modules/people/mastery';
import { PEOPLE, TOTAL_PEOPLE, peopleOfCategory } from '@/modules/people/people';
import { normalizePeopleProgress } from '@/modules/people/progress';
import PersonPhoto from '@/modules/people/components/PersonPhoto';

const ALL_IDS = PEOPLE.map((person) => person.id);

/**
 * Вход в модуль: общий прогресс, кнопка продолжить и разбивка по категориям.
 * Списком все 125 человек не показываем — ребёнок должен знакомиться порциями.
 */
export default function PeoplePage() {
  const hydrated = useHydrated();
  const data = useActiveData();
  const progress = useMemo(() => normalizePeopleProgress(data.people), [data.people]);
  const summary = summarize(progress, ALL_IDS);
  const learned = hydrated ? summary.learned : 0;

  return (
    <div className="min-h-dvh">
      <Hud />

      <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6 sm:px-6">
        <Link href="/learn" className="text-sm text-slate-500 hover:text-ink">
          ← Все направления
        </Link>

        <h1 className="mt-3 text-4xl font-extrabold">Известные люди</h1>
        <p className="mt-1 text-slate-400">Казахстан: лицо, имя и чем человек известен.</p>

        <section className="panel mt-5 p-5">
          <div className="flex items-baseline justify-between">
            <p className="panel-title">Освоено</p>
            <p className="text-sm font-extrabold">
              {learned} / {TOTAL_PEOPLE}
            </p>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-ink-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 to-violet-400 transition-[width] duration-500"
              style={{ width: `${(learned / TOTAL_PEOPLE) * 100}%` }}
            />
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/people/play" className="btn-primary px-8 py-3">
              {progress.seen.length === 0 ? 'Начать знакомство' : 'Продолжить'}
            </Link>
            <Link href="/people/progress" className="btn-ghost px-6 py-3">
              Прогресс
            </Link>
          </div>
        </section>

        <h2 className="mb-3 mt-8 text-xl font-extrabold">По темам</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {CATEGORY_ORDER.map((category) => {
            const list = peopleOfCategory(category);
            if (list.length === 0) return null;
            const done = hydrated
              ? list.filter((person) => isLearned(progress, person.id)).length
              : 0;
            const meta = CATEGORY_META[category];
            return (
              <Link
                key={category}
                href={`/people/play?category=${category}`}
                className="flex items-center gap-3 rounded-2xl border border-line bg-ink-800 p-3 transition hover:border-accent/50"
              >
                <span className="flex -space-x-3">
                  {list.slice(0, 3).map((person) => (
                    <PersonPhoto
                      key={person.id}
                      personId={person.id}
                      className="h-11 w-11 ring-2 ring-ink-800"
                      sizes="44px"
                    />
                  ))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-extrabold">{meta.titleRu}</span>
                  <span className="block text-xs text-slate-400">
                    {done} / {list.length} изучено
                  </span>
                </span>
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: meta.color }}
                />
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
