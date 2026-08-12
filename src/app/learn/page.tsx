'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo } from 'react';
import Hud from '@/components/Hud';
import { MODULE_ICONS } from '@/lib/brandAssets';
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
  LEARNING_LOOP_RU,
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

      <main className="mx-auto w-full max-w-[1400px] px-4 pb-24 pt-4 sm:px-6">
        <section>
          <h1 className="text-balance text-4xl font-extrabold leading-[1.1] sm:text-5xl">
            Learn anything.
            <br />
            <span className="text-accent">One skill at a time.</span>
          </h1>
          <p className="mt-3 text-sm font-bold text-slate-400">
            {LEARNING_LOOP_RU.join(' • ')}
          </p>
        </section>

        <h2 className="mb-4 mt-9 text-xl font-extrabold">Что будем изучать?</h2>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
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
  const [from, to] = module.gradient;
  const icon = MODULE_ICONS[module.id];

  const body = (
    <>
      {icon ? (
        <>
          {/* Рисунок направления занимает левую часть карточки. */}
          <Image
            src={icon}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 460px"
            className="object-cover object-left"
          />
          {/* Растушёвка вправо: под текстом должен быть ровный цвет, а не рисунок. */}
          <span
            aria-hidden
            className="absolute inset-0"
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${to}66 34%, ${to}F2 52%, ${to} 66%)`,
            }}
          />
        </>
      ) : (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-4 -top-6 select-none text-[7rem] leading-none opacity-25"
        >
          {module.emoji}
        </span>
      )}

      <div className="relative ml-auto flex h-full w-[52%] flex-col justify-center p-5">
        <h3 className="text-2xl font-extrabold leading-tight">{module.title}</h3>
        <p className="mt-1 text-sm font-semibold text-white/75">{module.tagline}</p>
      </div>

      {/* Настоящий прогресс — поверх рисунка, во всю ширину карточки. */}
      <div className="absolute inset-x-5 bottom-4">
        <div className="mb-1.5 flex items-baseline justify-between text-xs font-extrabold">
          <span className="text-white/75">{module.note ?? ''}</span>
          <span>{soon ? 'Скоро' : `${percent}%`}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/35">
          <div
            className="h-full rounded-full bg-white transition-[width] duration-500"
            style={{ width: soon ? '0%' : `${percent}%` }}
          />
        </div>
      </div>
    </>
  );

  const style = { '--from': from, '--to': to } as React.CSSProperties;

  if (soon) {
    return (
      <div className="tile tile-soon relative h-52" style={style} aria-disabled>
        {body}
      </div>
    );
  }

  return (
    <Link
      href={module.href}
      style={style}
      className="tile relative block h-52 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      {body}
    </Link>
  );
}
