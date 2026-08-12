'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import Hud from '@/components/Hud';
import { useActiveData, useHydrated } from '@/lib/store';
import AnatomyFigure from '@/modules/anatomy/components/AnatomyFigure';
import ImageCredit from '@/modules/anatomy/components/ImageCredit';
import { SKILLS, SKILL_META, SYSTEMS } from '@/modules/anatomy/config';
import { masteryOf, summarize } from '@/modules/anatomy/mastery';
import {
  normalizeAnatomyProgress,
  topConfusions,
  weakStructures,
} from '@/modules/anatomy/progress';
import { STRUCTURES, TOTAL_STRUCTURES, getStructure, structuresOfSystem } from '@/modules/anatomy/structures';

const ALL_IDS = STRUCTURES.map((s) => s.id);

/**
 * Прогресс по анатомии. Главное здесь — не общий процент, а разбивка по трём
 * навыкам: «знает название, но не понимает, где находится» — это разные вещи.
 */
export default function AnatomyProgressPage() {
  const hydrated = useHydrated();
  const data = useActiveData();
  const progress = useMemo(() => normalizeAnatomyProgress(data.anatomy), [data.anatomy]);
  const summary = summarize(progress, ALL_IDS);

  const weak = hydrated ? weakStructures(progress, 6) : [];
  const pairs = hydrated ? topConfusions(progress, 6) : [];

  return (
    <div className="min-h-dvh">
      <Hud />

      <main className="mx-auto w-full max-w-4xl px-4 pb-20 pt-8 sm:px-6">
        <Link href="/anatomy" className="text-sm text-slate-500 hover:text-ink">
          ← Анатомия
        </Link>

        <h1 className="mt-3 text-3xl font-extrabold">Анатомия · прогресс</h1>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile
            label="Структур освоено"
            value={`${hydrated ? summary.learned : 0} / ${TOTAL_STRUCTURES}`}
          />
          <Tile label="Общее освоение" value={`${hydrated ? summary.mastery : 0}%`} />
          {SKILLS.slice(0, 2).map((skill) => (
            <Tile
              key={skill}
              label={SKILL_META[skill].label}
              value={`${hydrated ? summary.bySkill[skill] : 0}%`}
            />
          ))}
        </div>

        <section className="panel mt-4 space-y-4 p-5">
          <p className="panel-title">Три навыка</p>
          {SKILLS.map((skill) => (
            <div key={skill}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-extrabold">{SKILL_META[skill].label}</span>
                <span className="text-slate-500">{hydrated ? summary.bySkill[skill] : 0}%</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-ink-700">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${hydrated ? summary.bySkill[skill] : 0}%`,
                    background: SKILL_META[skill].color,
                  }}
                />
              </div>
            </div>
          ))}
          <p className="text-xs text-slate-500">
            Низкое «Расположение» при высоком «Название» значит, что ребёнок знает термин,
            но пока плохо представляет, где структура находится.
          </p>
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="panel p-5">
            <p className="panel-title mb-3">Слабые структуры</p>
            {weak.length === 0 ? (
              <p className="text-sm text-slate-500">Пока нет ошибок.</p>
            ) : (
              <ul className="space-y-1.5">
                {weak.map((id) => {
                  const structure = getStructure(id);
                  if (!structure) return null;
                  const mastery = masteryOf(progress, id);
                  return (
                    <li key={id} className="flex items-center gap-2.5 text-sm">
                      <AnatomyFigure
                        region={structure.region}
                        highlight={id}
                        className="h-8 w-8 shrink-0"
                      />
                      <span className="min-w-0 flex-1 truncate font-bold">{structure.nameRu}</span>
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
            <p className="panel-title mb-3">Что путается</p>
            {pairs.length === 0 ? (
              <p className="text-sm text-slate-500">Пока ничего не путается.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {pairs.map((pair) => (
                  <li key={`${pair.a}-${pair.b}`} className="flex items-center gap-2">
                    <span className="font-bold">{getStructure(pair.a)?.nameRu}</span>
                    <span className="text-slate-600">↔</span>
                    <span className="font-bold">{getStructure(pair.b)?.nameRu}</span>
                    <span className="ml-auto text-xs text-slate-500">{pair.count}×</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Подробно по каждой структуре: три навыка отдельно. */}
        {SYSTEMS.map((system) => (
          <section key={system.id} className="mt-6">
            <h2 className="mb-3 text-xl font-extrabold">{system.titleRu}</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {structuresOfSystem(system.id).map((structure) => {
                const mastery = masteryOf(progress, structure.id);
                return (
                  <div
                    key={structure.id}
                    className="flex items-center gap-3 rounded-xl border border-line bg-ink-800 p-3"
                  >
                    <AnatomyFigure
                      region={structure.region}
                      highlight={structure.id}
                      className="h-12 w-10 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold">{structure.nameRu}</p>
                      <div className="mt-1 flex gap-1">
                        {SKILLS.map((skill) => (
                          <span
                            key={skill}
                            title={`${SKILL_META[skill].label}: ${mastery.bySkill[skill]}%`}
                            className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700"
                          >
                            <span
                              className="block h-full rounded-full"
                              style={{
                                width: `${mastery.bySkill[skill]}%`,
                                background: SKILL_META[skill].color,
                              }}
                            />
                          </span>
                        ))}
                      </div>
                    </div>
                    <span
                      className="shrink-0 text-sm font-extrabold"
                      style={{ color: mastery.color }}
                    >
                      {mastery.percent}%
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        <ImageCredit className="mt-8" />
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
