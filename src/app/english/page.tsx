'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import Hud from '@/components/Hud';
import { isDue } from '@/lib/srs';
import { useActiveData, useHydrated } from '@/lib/store';
import { summarize } from '@/modules/english/mastery';
import { normalizeEnglishProgress } from '@/modules/english/progress';
import { TOTAL_NOUNS, TOTAL_VERBS, TOTAL_WORDS } from '@/modules/english/words';

/**
 * Первый экран English. Для ребёнка тут только большая кнопка и понятный
 * прогресс — подробная статистика живёт на /english/progress.
 */
export default function EnglishPage() {
  const hydrated = useHydrated();
  const data = useActiveData();

  const { summary, dueCount, mistakeCount } = useMemo(() => {
    const progress = normalizeEnglishProgress(data.english);
    const cards = Object.values(progress.cards);
    return {
      summary: summarize(progress, TOTAL_WORDS),
      dueCount: cards.filter((card) => card.repetitions > 0 && isDue(card)).length,
      mistakeCount: cards.filter((card) => card.wrong > 0 && card.streak === 0).length,
    };
  }, [data.english]);

  const learned = hydrated ? summary.learned : 0;
  const percent = Math.round((learned / TOTAL_WORDS) * 100);

  return (
    <div className="min-h-dvh">
      <Hud />

      <main className="mx-auto w-full max-w-3xl px-4 pb-20 pt-8 sm:px-6">
        <Link href="/learn" className="text-sm text-slate-500 hover:text-ink">
          ← Все направления
        </Link>

        <section className="mt-6 text-center">
          <span className="text-5xl" aria-hidden>
            🇬🇧
          </span>
          <h1 className="mt-3 text-4xl font-extrabold">English</h1>
          <p className="mt-2 text-slate-500">Learn English through pictures.</p>

          <Link
            href="/english/play"
            className="btn-primary mt-6 inline-block px-10 py-4 text-lg"
          >
            Start learning
          </Link>
        </section>

        <section className="panel mt-8 p-5">
          <div className="flex items-baseline justify-between">
            <span className="font-extrabold">
              {learned} / {TOTAL_WORDS} words
            </span>
            <span className="text-sm font-bold text-emerald-600">{percent}%</span>
          </div>
          <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-ink-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500 transition-[width] duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label="Words" value={TOTAL_WORDS} />
            <Stat label="Nouns" value={TOTAL_NOUNS} />
            <Stat label="Verbs" value={TOTAL_VERBS} />
          </div>
        </section>

        <section className="mt-4 grid gap-3 sm:grid-cols-3">
          <Card
            href="/english/play"
            emoji="▶️"
            title="Continue"
            hint="Новые слова и повторение"
          />
          <Card
            href="/english/play?mode=mistakes"
            emoji="🔁"
            title="Practice mistakes"
            hint={mistakeCount > 0 ? `${mistakeCount} слов с ошибками` : 'Ошибок пока нет'}
            disabled={hydrated && mistakeCount === 0}
          />
          <Card
            href="/english/play?mode=review"
            emoji="🧠"
            title="Review words"
            hint={dueCount > 0 ? `${dueCount} слов на повторение` : 'Пока нечего повторять'}
            disabled={hydrated && dueCount === 0}
          />
        </section>

        <div className="mt-6 text-center">
          <Link href="/english/progress" className="text-sm text-slate-500 hover:underline">
            Подробный прогресс →
          </Link>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line bg-ink-700/40 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-extrabold">{value}</p>
    </div>
  );
}

function Card({
  href,
  emoji,
  title,
  hint,
  disabled,
}: {
  href: string;
  emoji: string;
  title: string;
  hint: string;
  disabled?: boolean;
}) {
  const body = (
    <>
      <span className="text-2xl" aria-hidden>
        {emoji}
      </span>
      <span className="mt-1 block font-extrabold">{title}</span>
      <span className="block text-xs text-slate-500">{hint}</span>
    </>
  );

  if (disabled) {
    return <div className="panel p-4 text-center opacity-50">{body}</div>;
  }

  return (
    <Link href={href} className="panel p-4 text-center transition hover:border-accent/50">
      {body}
    </Link>
  );
}
