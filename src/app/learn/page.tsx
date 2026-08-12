'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import Hud from '@/components/Hud';
import { COUNTRIES } from '@/lib/countries';
import { SKILLS, skillPercent } from '@/lib/skills';
import { useActiveData, useHydrated } from '@/lib/store';
import { summarize as anatomySummary } from '@/modules/anatomy/mastery';
import { normalizeAnatomyProgress } from '@/modules/anatomy/progress';
import { STRUCTURES, TOTAL_STRUCTURES } from '@/modules/anatomy/structures';
import { TOTAL_PUZZLES } from '@/modules/chess/config';
import { normalizeChessProgress } from '@/modules/chess/progress';
import { CHARACTERS, TOTAL_CHARACTERS } from '@/modules/chinese/characters';
import { summarize as chineseSummary } from '@/modules/chinese/mastery';
import { normalizeChineseProgress } from '@/modules/chinese/progress';
import { summarize } from '@/modules/english/mastery';
import { normalizeEnglishProgress } from '@/modules/english/progress';
import { TOTAL_WORDS } from '@/modules/english/words';
import { additionMastery } from '@/modules/mathematics/mastery';
import { normalizeMathProgress } from '@/modules/mathematics/progress';
import {
  LEARNING_LOOP,
  LEARNING_MODULES,
  type LearningModule,
  type ProgressKind,
} from '@/modules/registry';

/**
 * Learning Hub — точка входа во все направления обучения.
 * Существующий модуль географии остался на своих маршрутах, хаб только ведёт
 * в него. Флаги — не отдельное направление, а один из навыков страны.
 */
const CHAR_IDS = CHARACTERS.map((c) => c.id);
const STRUCTURE_IDS = STRUCTURES.map((s) => s.id);

const chessSolved = (raw: Parameters<typeof normalizeChessProgress>[0]) =>
  Object.values(normalizeChessProgress(raw).puzzles).filter((record) => record.solved).length;

export default function LearnPage() {
  const hydrated = useHydrated();
  const data = useActiveData();

  const progress = useMemo<Record<ProgressKind, number>>(() => {
    // Освоение географии — среднее по всем шести навыкам страны, включая
    // флаги: отдельного направления «Флаги» нет, это один из навыков.
    let skillSum = 0;
    for (const card of Object.values(data.cards)) skillSum += skillPercent(card);
    return {
      geography: Math.round(skillSum / (COUNTRIES.length * SKILLS.length)),
      math: additionMastery(normalizeMathProgress(data.math)),
      english: Math.round(
        (summarize(normalizeEnglishProgress(data.english), TOTAL_WORDS).learned / TOTAL_WORDS) *
          100,
      ),
      chinese: Math.round(
        (chineseSummary(normalizeChineseProgress(data.chinese), CHAR_IDS).learned /
          TOTAL_CHARACTERS) *
          100,
      ),
      chess: Math.round((chessSolved(data.chess) / TOTAL_PUZZLES) * 100),
      anatomy: Math.round(
        (anatomySummary(normalizeAnatomyProgress(data.anatomy), STRUCTURE_IDS).learned /
          TOTAL_STRUCTURES) *
          100,
      ),
      none: 0,
    };
  }, [data]);

  return (
    <div className="min-h-dvh">
      <Hud />

      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-10 sm:px-6">
        <section className="text-center">
          <p className="text-sm font-extrabold tracking-[0.3em] text-slate-500">MAPAPP</p>
          <h1 className="mt-3 text-balance text-4xl font-extrabold sm:text-5xl">
            Learn anything.
            <br />
            <span className="text-accent">One skill at a time.</span>
          </h1>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {LEARNING_LOOP.map((step) => (
              <span
                key={step}
                className="rounded-full border border-line bg-ink-800 px-3 py-1 text-xs font-bold text-slate-400"
              >
                {step}
              </span>
            ))}
          </div>
        </section>

        <h2 className="mb-4 mt-12 text-xl font-extrabold">Что будем изучать?</h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LEARNING_MODULES.map((module) => (
            <ModuleCard
              key={module.id}
              module={module}
              percent={hydrated ? progress[module.progress] : 0}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

function ModuleCard({ module, percent }: { module: LearningModule; percent: number }) {
  const soon = module.status === 'soon';

  const body = (
    <>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-2xl"
          style={{ background: `${module.accent}22` }}
        >
          {module.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-extrabold">{module.title}</h3>
          <p className="truncate text-xs text-slate-500">{module.subtitle}</p>
        </div>
        {soon && (
          <span className="shrink-0 rounded-full border border-line bg-ink-700 px-2.5 py-1 text-[10px] font-extrabold uppercase text-slate-400">
            Скоро
          </span>
        )}
      </div>

      <ul className="mt-4 space-y-1 text-sm text-slate-400">
        {module.topics.map((topic) => (
          <li key={topic} className="flex items-center gap-2">
            <span aria-hidden className="h-1 w-1 rounded-full" style={{ background: module.accent }} />
            {topic}
          </li>
        ))}
      </ul>

      {module.note && <p className="mt-3 text-xs font-bold text-slate-500">{module.note}</p>}

      {!soon && module.progress !== 'none' && (
        <div className="mt-4">
          <div className="mb-1 flex items-baseline justify-between text-xs">
            <span className="text-slate-500">Ваш прогресс</span>
            <span className="font-extrabold" style={{ color: module.accent }}>
              {percent}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${percent}%`, background: module.accent }}
            />
          </div>
        </div>
      )}

      <div className="mt-5">
        {soon ? (
          <span className="block rounded-xl border border-line bg-ink-700/50 px-4 py-2.5 text-center text-sm font-bold text-slate-500">
            Coming soon
          </span>
        ) : (
          <span className="btn-primary block px-4 py-2.5 text-center text-sm">{module.cta}</span>
        )}
      </div>
    </>
  );

  if (soon) {
    return (
      <div className="panel p-5 opacity-70" aria-disabled>
        {body}
      </div>
    );
  }

  return (
    <Link
      href={module.href}
      className="panel p-5 transition hover:-translate-y-0.5 hover:border-accent/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      {body}
    </Link>
  );
}
