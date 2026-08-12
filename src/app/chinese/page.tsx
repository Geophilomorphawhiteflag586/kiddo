'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import Hud from '@/components/Hud';
import { isDue } from '@/lib/srs';
import { useActiveData, useHydrated } from '@/lib/store';
import { CHARACTERS, TOTAL_CHARACTERS } from '@/modules/chinese/characters';
import { summarize } from '@/modules/chinese/mastery';
import { normalizeChineseProgress } from '@/modules/chinese/progress';
import VoiceWarning from '@/modules/chinese/components/VoiceWarning';

const ALL_IDS = CHARACTERS.map((c) => c.id);

/** Первый экран 中文: большая кнопка, прогресс и три быстрых входа. */
export default function ChinesePage() {
  const hydrated = useHydrated();
  const data = useActiveData();

  const { summary, dueCount, mistakeCount } = useMemo(() => {
    const progress = normalizeChineseProgress(data.chinese);
    const cards = Object.values(progress.cards);
    return {
      summary: summarize(progress, ALL_IDS),
      dueCount: cards.filter((card) => card.repetitions > 0 && isDue(card)).length,
      mistakeCount: cards.filter((card) => card.wrong > 0 && card.streak === 0).length,
    };
  }, [data.chinese]);

  const learned = hydrated ? summary.learned : 0;
  const percent = Math.round((learned / TOTAL_CHARACTERS) * 100);

  return (
    <div className="min-h-dvh">
      <Hud />

      <main className="mx-auto w-full max-w-3xl px-4 pb-20 pt-8 sm:px-6">
        <Link href="/learn" className="text-sm text-slate-500 hover:text-ink">
          ← Все направления
        </Link>

        <section className="mt-6 text-center">
          <span className="text-5xl" aria-hidden>
            🇨🇳
          </span>
          <h1 className="mt-3 text-5xl font-extrabold">中文</h1>
          <p className="mt-2 text-slate-500">
            Учим китайские иероглифы: знак → пиньинь → звук → значение.
          </p>

          <Link href="/chinese/play" className="btn-primary mt-6 inline-block px-10 py-4 text-lg">
            开始 · Начать
          </Link>
        </section>

        <section className="panel mt-8 p-5">
          <div className="flex items-baseline justify-between">
            <span className="font-extrabold">
              {learned} / {TOTAL_CHARACTERS} 汉字
            </span>
            <span className="text-sm font-bold text-emerald-600">{percent}%</span>
          </div>
          <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-ink-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-red-500 to-amber-400 transition-[width] duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Открыто для изучения: {hydrated ? summary.unlocked : 20} знаков — следующий набор
            появится, когда освоите текущий.
          </p>
        </section>

        <div className="mt-4">
          <VoiceWarning />
        </div>

        <section className="mt-4 grid gap-3 sm:grid-cols-3">
          <Card href="/chinese/play" emoji="▶️" title="Continue" hint="Новые знаки и повторение" />
          <Card
            href="/chinese/play?mode=mistakes"
            emoji="🔁"
            title="Practice mistakes"
            hint={mistakeCount > 0 ? `${mistakeCount} с ошибками` : 'Ошибок пока нет'}
            disabled={hydrated && mistakeCount === 0}
          />
          <Card
            href="/chinese/play?mode=review"
            emoji="🧠"
            title="Review"
            hint={dueCount > 0 ? `${dueCount} на повторение` : 'Пока нечего повторять'}
            disabled={hydrated && dueCount === 0}
          />
        </section>

        <div className="mt-6 text-center">
          <Link href="/chinese/progress" className="text-sm text-slate-500 hover:underline">
            Подробный прогресс →
          </Link>
        </div>
      </main>
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

  if (disabled) return <div className="panel p-4 text-center opacity-50">{body}</div>;

  return (
    <Link href={href} className="panel p-4 text-center transition hover:border-accent/50">
      {body}
    </Link>
  );
}
