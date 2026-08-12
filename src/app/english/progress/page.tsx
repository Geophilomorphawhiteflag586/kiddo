'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import Hud from '@/components/Hud';
import { useActiveData, useHydrated } from '@/lib/store';
import { CATEGORY_LABELS } from '@/modules/english/config';
import { isLearned, masteryOf, summarize } from '@/modules/english/mastery';
import {
  normalizeEnglishProgress,
  topConfusionPairs,
  weakWords,
} from '@/modules/english/progress';
import type { WordCategory } from '@/modules/english/types';
import WordVisual from '@/modules/english/components/WordVisual';
import {
  CATEGORIES,
  NOUNS,
  TOTAL_NOUNS,
  TOTAL_VERBS,
  TOTAL_WORDS,
  VERBS,
  getWord,
  wordsOfCategory,
} from '@/modules/english/words';

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Подробная статистика English — отдельно от детского игрового экрана. */
export default function EnglishProgressPage() {
  const hydrated = useHydrated();
  const data = useActiveData();
  const [category, setCategory] = useState<WordCategory | 'all'>('all');

  const progress = useMemo(() => normalizeEnglishProgress(data.english), [data.english]);
  const summary = summarize(progress, TOTAL_WORDS);

  const learnedIn = (words: { id: string }[]) =>
    words.filter((w) => isLearned(progress.cards[w.id])).length;

  const nounsLearned = hydrated ? learnedIn(NOUNS) : 0;
  const verbsLearned = hydrated ? learnedIn(VERBS) : 0;
  const weak = hydrated ? weakWords(progress, 8) : [];
  const pairs = hydrated ? topConfusionPairs(progress, 6) : [];

  const shown = category === 'all' ? [] : wordsOfCategory(category);

  return (
    <div className="min-h-dvh">
      <Hud />

      <main className="mx-auto w-full max-w-4xl px-4 pb-20 pt-8 sm:px-6">
        <Link href="/english" className="text-sm text-slate-500 hover:text-ink">
          ← English
        </Link>

        <h1 className="mt-3 text-3xl font-extrabold">English · прогресс</h1>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Words learned" value={`${hydrated ? summary.learned : 0} / ${TOTAL_WORDS}`} />
          <Tile label="Mastery" value={`${hydrated ? summary.mastery : 0}%`} />
          <Tile label="Accuracy" value={hydrated && summary.seen ? pct(summary.accuracy) : '—'} />
          <Tile label="Seen words" value={hydrated ? summary.seen : 0} />
        </div>

        <section className="panel mt-4 space-y-4 p-5">
          <Bar label="Nouns" value={nounsLearned} total={TOTAL_NOUNS} color="#38bdf8" />
          <Bar label="Verbs" value={verbsLearned} total={TOTAL_VERBS} color="#a855f7" />
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="panel p-5">
            <p className="panel-title mb-3">Weak words</p>
            {weak.length === 0 ? (
              <p className="text-sm text-slate-500">Пока нет слов с ошибками.</p>
            ) : (
              <ul className="space-y-1.5">
                {weak.map((card) => {
                  const word = getWord(card.wordId);
                  if (!word) return null;
                  const mastery = masteryOf(card);
                  return (
                    <li key={card.wordId} className="flex items-center gap-2.5 text-sm">
                      <WordVisual word={word} size={22} />
                      <span className="flex-1 font-bold uppercase">{word.word}</span>
                      <span className="text-xs text-slate-500">{word.translationRu}</span>
                      <span className="font-extrabold" style={{ color: mastery.color }}>
                        {mastery.percent}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="panel p-5">
            <p className="panel-title mb-3">Confusing pairs</p>
            {pairs.length === 0 ? (
              <p className="text-sm text-slate-500">Пока ничего не путается.</p>
            ) : (
              <ul className="space-y-1.5">
                {pairs.map((pair) => {
                  const a = getWord(pair.a);
                  const b = getWord(pair.b);
                  if (!a || !b) return null;
                  return (
                    <li key={`${pair.a}-${pair.b}`} className="flex items-center gap-2 text-sm">
                      <WordVisual word={a} size={20} />
                      <span className="font-bold uppercase">{a.word}</span>
                      <span className="text-slate-600">↔</span>
                      <WordVisual word={b} size={20} />
                      <span className="font-bold uppercase">{b.word}</span>
                      <span className="ml-auto text-xs text-slate-500">{pair.count}×</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <section className="mt-6">
          <p className="panel-title mb-2">Категории</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setCategory('all')}
              className={`rounded-lg px-3 py-1.5 text-sm font-bold transition ${
                category === 'all'
                  ? 'bg-accent text-white'
                  : 'border border-line bg-ink-800 text-slate-500 hover:text-ink'
              }`}
            >
              Все
            </button>
            {CATEGORIES.map((id) => {
              const words = wordsOfCategory(id);
              const learned = hydrated ? learnedIn(words) : 0;
              return (
                <button
                  key={id}
                  onClick={() => setCategory(id)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-bold transition ${
                    category === id
                      ? 'bg-accent text-white'
                      : 'border border-line bg-ink-800 text-slate-500 hover:text-ink'
                  }`}
                >
                  {CATEGORY_LABELS[id]}{' '}
                  <span className="text-xs opacity-70">
                    {learned}/{words.length}
                  </span>
                </button>
              );
            })}
          </div>

          {shown.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {shown.map((word) => {
                const mastery = masteryOf(progress.cards[word.id]);
                return (
                  <div
                    key={word.id}
                    className="flex items-center gap-2 rounded-xl border border-line bg-ink-800 p-2"
                  >
                    <WordVisual word={word} size={24} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold uppercase">{word.word}</p>
                      <p className="truncate text-[11px] text-slate-500">{word.translationRu}</p>
                    </div>
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: mastery.color }}
                      title={mastery.label}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="panel p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-extrabold">{value}</p>
    </div>
  );
}

function Bar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const percent = Math.round((value / total) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-extrabold">{label}</span>
        <span className="text-slate-500">
          {value} / {total}
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-ink-700">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${percent}%`, background: color }}
        />
      </div>
    </div>
  );
}
