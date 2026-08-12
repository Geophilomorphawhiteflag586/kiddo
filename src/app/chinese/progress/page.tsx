'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import Hud from '@/components/Hud';
import { useActiveData, useHydrated } from '@/lib/store';
import {
  CATEGORIES,
  CHARACTERS,
  TOTAL_CHARACTERS,
  charactersOfCategory,
  getCharacter,
} from '@/modules/chinese/characters';
import { CATEGORY_LABELS, SKILLS, SKILL_META } from '@/modules/chinese/config';
import { characterPercent, isLearned, masteryOf, summarize } from '@/modules/chinese/mastery';
import {
  normalizeChineseProgress,
  topCharConfusions,
  topPinyinConfusions,
  weakCharacters,
} from '@/modules/chinese/progress';
import type { CharCategory } from '@/modules/chinese/types';

const ALL_IDS = CHARACTERS.map((c) => c.id);

/** Подробная статистика 中文 — отдельно от детского игрового экрана. */
export default function ChineseProgressPage() {
  const hydrated = useHydrated();
  const data = useActiveData();
  const [category, setCategory] = useState<CharCategory | 'all'>('all');

  const progress = useMemo(() => normalizeChineseProgress(data.chinese), [data.chinese]);
  const summary = summarize(progress, ALL_IDS);

  const weak = hydrated ? weakCharacters(progress, 8) : [];
  const charPairs = hydrated ? topCharConfusions(progress, 6) : [];
  const pinyinPairs = hydrated ? topPinyinConfusions(progress, 6) : [];
  const shown = category === 'all' ? [] : charactersOfCategory(category);

  return (
    <div className="min-h-dvh">
      <Hud />

      <main className="mx-auto w-full max-w-4xl px-4 pb-20 pt-8 sm:px-6">
        <Link href="/chinese" className="text-sm text-slate-500 hover:text-white">
          ← 中文
        </Link>

        <h1 className="mt-3 text-3xl font-extrabold">中文 · прогресс</h1>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile
            label="Иероглифов освоено"
            value={`${hydrated ? summary.learned : 0} / ${TOTAL_CHARACTERS}`}
          />
          <Tile label="Общее освоение" value={`${hydrated ? summary.mastery : 0}%`} />
          <Tile label="Знаков в работе" value={hydrated ? summary.seen : 0} />
          <Tile label="Открыто" value={hydrated ? summary.unlocked : 20} />
        </div>

        {/* Четыре независимых навыка */}
        <section className="panel mt-4 space-y-4 p-5">
          <p className="panel-title">Навыки</p>
          {SKILLS.map((skill) => (
            <div key={skill}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-extrabold">{SKILL_META[skill].label}</span>
                <span className="text-slate-400">
                  {hydrated ? summary.bySkill[skill] : 0}%
                </span>
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
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <section className="panel p-5">
            <p className="panel-title mb-3">Слабые иероглифы</p>
            {weak.length === 0 ? (
              <p className="text-sm text-slate-500">Пока нет ошибок.</p>
            ) : (
              <ul className="space-y-1.5">
                {weak.map((id) => {
                  const char = getCharacter(id);
                  if (!char) return null;
                  const mastery = masteryOf(characterPercent(progress, id));
                  return (
                    <li key={id} className="flex items-center gap-2.5 text-sm">
                      <span className="text-2xl font-extrabold">{char.character}</span>
                      <span className="text-amber-300">{char.pinyin}</span>
                      <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
                        {char.meaningRu}
                      </span>
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
            <p className="panel-title mb-3">Путаница иероглифов</p>
            {charPairs.length === 0 ? (
              <p className="text-sm text-slate-500">Пока ничего не путается.</p>
            ) : (
              <ul className="space-y-1.5">
                {charPairs.map((pair) => (
                  <li key={`${pair.a}-${pair.b}`} className="flex items-center gap-2 text-sm">
                    <span className="text-2xl font-extrabold">{pair.a}</span>
                    <span className="text-slate-600">↔</span>
                    <span className="text-2xl font-extrabold">{pair.b}</span>
                    <span className="ml-auto text-xs text-slate-500">{pair.count}×</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel p-5">
            <p className="panel-title mb-3">Путаница произношений</p>
            {pinyinPairs.length === 0 ? (
              <p className="text-sm text-slate-500">Тоны пока не путаются.</p>
            ) : (
              <ul className="space-y-1.5">
                {pinyinPairs.map((pair) => (
                  <li key={`${pair.a}-${pair.b}`} className="flex items-center gap-2 text-sm">
                    <span className="font-extrabold text-amber-300">{pair.a}</span>
                    <span className="text-slate-600">↔</span>
                    <span className="font-extrabold text-amber-300">{pair.b}</span>
                    <span className="ml-auto text-xs text-slate-500">{pair.count}×</span>
                  </li>
                ))}
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
                  : 'border border-line bg-ink-800 text-slate-400 hover:text-white'
              }`}
            >
              Все
            </button>
            {CATEGORIES.map((id) => {
              const chars = charactersOfCategory(id);
              const learned = hydrated
                ? chars.filter((c) => isLearned(progress, c.id)).length
                : 0;
              return (
                <button
                  key={id}
                  onClick={() => setCategory(id)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-bold transition ${
                    category === id
                      ? 'bg-accent text-white'
                      : 'border border-line bg-ink-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {CATEGORY_LABELS[id]}{' '}
                  <span className="text-xs opacity-70">
                    {learned}/{chars.length}
                  </span>
                </button>
              );
            })}
          </div>

          {shown.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {shown.map((char) => {
                const mastery = masteryOf(characterPercent(progress, char.id));
                return (
                  <div
                    key={char.id}
                    className="flex items-center gap-2 rounded-xl border border-line bg-ink-800 p-2"
                  >
                    <span className="text-2xl font-extrabold">{char.character}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-amber-300">{char.pinyin}</p>
                      <p className="truncate text-[11px] text-slate-500">{char.meaningRu}</p>
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
