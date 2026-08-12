'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import Hud from '@/components/Hud';
import { useActiveData, useHydrated } from '@/lib/store';
import AnatomyFigure from '@/modules/anatomy/components/AnatomyFigure';
import ImageCredit from '@/modules/anatomy/components/ImageCredit';
import { SYSTEMS } from '@/modules/anatomy/config';
import { BASE_BY_REGION } from '@/modules/anatomy/data/bases';
import {
  isSkeletonUnlocked,
  isSystemUnlocked,
  learnedInRegion,
  learnedInSystem,
} from '@/modules/anatomy/mastery';
import { normalizeAnatomyProgress } from '@/modules/anatomy/progress';
import { structuresOfRegion, structuresOfSystem } from '@/modules/anatomy/structures';

/**
 * Путь обучения: органы → кости → мышцы. Следующая система открывается по мере
 * освоения предыдущей, чтобы ребёнок не хватался за всё сразу.
 */
export default function AnatomyPage() {
  const hydrated = useHydrated();
  const data = useActiveData();
  const progress = useMemo(() => normalizeAnatomyProgress(data.anatomy), [data.anatomy]);

  const skeletonOpen = hydrated && isSkeletonUnlocked(progress);

  return (
    <div className="min-h-dvh">
      <Hud />

      <main className="mx-auto w-full max-w-3xl px-4 pb-20 pt-8 sm:px-6">
        <Link href="/learn" className="text-sm text-slate-400 hover:text-ink">
          ← Все направления
        </Link>

        <section className="mt-6 text-center">
          <AnatomyFigure region="skeleton" className="mx-auto h-48" priority />
          <h1 className="mt-3 text-4xl font-extrabold">Анатомия</h1>
          <p className="mt-2 text-slate-400">Изучай человеческое тело шаг за шагом.</p>
        </section>

        <section className="mt-8 space-y-3">
          {SYSTEMS.map((system, index) => {
            const structures = structuresOfSystem(system.id);
            const learned = hydrated ? learnedInSystem(progress, system.id) : 0;
            const unlocked = hydrated ? isSystemUnlocked(progress, system.id) : index === 0;
            const percent = Math.round((learned / structures.length) * 100);

            return (
              <div key={system.id} className={`panel p-5 ${unlocked ? '' : 'opacity-60'}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    aria-hidden
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: system.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-extrabold">
                      {system.titleRu}
                      {!unlocked && <span className="ml-2 text-sm text-slate-400">закрыто</span>}
                    </h2>
                    <p className="text-xs text-slate-400">{system.subtitleRu}</p>
                  </div>
                  <span className="text-sm font-extrabold text-slate-400">
                    {learned} / {structures.length}
                  </span>
                </div>

                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink-700">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${percent}%`, background: system.color }}
                  />
                </div>

                {unlocked ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {system.regions.map((region) => {
                      const art = BASE_BY_REGION.get(region);
                      const total = structuresOfRegion(region).length;
                      const done = hydrated ? learnedInRegion(progress, region) : 0;
                      return (
                        <Link
                          key={region}
                          href={`/anatomy/play?region=${region}`}
                          className="flex items-center gap-3 rounded-xl border border-line bg-ink-700/50 p-3 transition hover:border-accent/50"
                        >
                          <AnatomyFigure region={region} className="h-14 w-12 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-extrabold">{art?.titleRu}</p>
                            <p className="text-xs text-slate-400">
                              {done} / {total} изучено
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-slate-400">
                    Откроется, когда будет освоено большинство структур раздела «
                    {SYSTEMS.find((s) => s.id === system.unlockAfter)?.titleRu}».
                  </p>
                )}
              </div>
            );
          })}
        </section>

        {/* Полный скелет — итоговая проверка, а не первый экран обучения. */}
        <section className={`panel mt-3 p-5 ${skeletonOpen ? '' : 'opacity-60'}`}>
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-extrabold">
                Полный скелет
                {!skeletonOpen && <span className="ml-2 text-sm text-slate-400">закрыто</span>}
              </h2>
              <p className="text-xs text-slate-400">
                Итоговая проверка: найди кость на всём скелете
              </p>
            </div>
            {skeletonOpen && (
              <Link href="/anatomy/play?region=skeleton" className="btn-primary px-5 py-2.5 text-sm">
                Проверить себя
              </Link>
            )}
          </div>
          {!skeletonOpen && (
            <p className="mt-2 text-xs text-slate-400">
              Откроется, когда будут изучены кости по регионам.
            </p>
          )}
        </section>

        <div className="mt-6 flex justify-center gap-4 text-sm">
          <Link href="/anatomy/play" className="btn-primary px-8 py-3">
            Продолжить обучение
          </Link>
          <Link href="/anatomy/progress" className="btn-ghost px-6 py-3">
            Прогресс
          </Link>
        </div>

        <ImageCredit className="mt-8" />
      </main>
    </div>
  );
}
