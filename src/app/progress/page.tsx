'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import CountryInfo from '@/components/CountryInfo';
import FlagImage from '@/components/FlagImage';
import GlobeView from '@/components/GlobeView';
import Hud from '@/components/Hud';
import WorldMap from '@/components/WorldMap';
import { CONTINENTS, COUNTRIES, WITHOUT_POLYGON, countriesOf, getCountry } from '@/lib/countries';
import { achievementProgress, topConfusions } from '@/lib/progress';
import { LEVELS, SKILLS, SKILL_META, skillPercent } from '@/lib/skills';
import { isDue } from '@/lib/srs';
import { ACHIEVEMENTS, levelMap, useActiveData, useActiveProfile, useGame, useHydrated } from '@/lib/store';
import type { AgeMode, CountrySkill } from '@/lib/types';

const AGE_MODES: Array<{ id: AgeMode; label: string; hint: string }> = [
  { id: 'kid', label: 'Малышам 5+', hint: '3 варианта, подсказки, известные страны' },
  { id: 'school', label: 'Школьникам', hint: 'Столицы, континенты, языки' },
  { id: 'adult', label: 'Взрослым', hint: 'Валюты, регионы, соседи' },
];

type Tab = 'overall' | CountrySkill;

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overall', label: 'Общий' },
  { id: 'flagToCountry', label: 'Флаги' },
  { id: 'countryToCapital', label: 'Столицы' },
  { id: 'countryLocation', label: 'Карта' },
  { id: 'outlineToCountry', label: 'Контуры' },
  { id: 'countryToFlag', label: 'Страна → флаг' },
  { id: 'capitalToCountry', label: 'Столица → страна' },
];

const hasOutline = (code: string) => !WITHOUT_POLYGON.has(code);
const OUTLINE_TOTAL = COUNTRIES.filter((c) => hasOutline(c.code)).length;
const DAILY_GOAL = 15;

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const currentDate = () => new Date();

export default function ProgressPage() {
  const hydrated = useHydrated();
  const profile = useActiveProfile();
  const data = useActiveData();
  const setAgeMode = useGame((s) => s.setAgeMode);
  const reset = useGame((s) => s.resetActiveProfile);

  const [tab, setTab] = useState<Tab>('overall');
  /** Плоская карта, как в макете, или 3D-глобус. */
  const [view, setView] = useState<'map' | 'globe'>('map');
  const [focus, setFocus] = useState<{ lat: number; lng: number; altitude: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const levels = useMemo(() => levelMap(data, tab, hasOutline), [data, tab]);

  const colorFor = useMemo(
    () => (code: string) => {
      const level = levels[code];
      return level ? LEVELS[level].color : null;
    },
    [levels],
  );

  const tabTotal = tab === 'outlineToCountry' ? OUTLINE_TOTAL : COUNTRIES.length;
  const tabMastered = useMemo(
    () => COUNTRIES.filter((c) => (levels[c.code] ?? 0) >= 3).length,
    [levels],
  );

  const levelCounts = useMemo(() => {
    const acc = [0, 0, 0, 0, 0, 0];
    for (const country of COUNTRIES) {
      if (tab === 'outlineToCountry' && !hasOutline(country.code)) continue;
      acc[levels[country.code] ?? 0] += 1;
    }
    return acc;
  }, [levels, tab]);

  /** Средний процент по навыку (0 для незаведённых) — «слабые навыки» макета. */
  const weakestSkills = useMemo(() => {
    const sums = Object.fromEntries(SKILLS.map((s) => [s, 0])) as Record<CountrySkill, number>;
    for (const card of Object.values(data.cards)) sums[card.skill] += skillPercent(card);
    return SKILLS.map((skill) => ({
      skill,
      percent: Math.round(
        sums[skill] / (skill === 'outlineToCountry' ? OUTLINE_TOTAL : COUNTRIES.length),
      ),
    }))
      .sort((a, b) => a.percent - b.percent)
      .slice(0, 3);
  }, [data.cards]);

  const dueCards = useMemo(
    () =>
      Object.values(data.cards)
        .filter((card) => card.repetitions > 0 && isDue(card))
        .sort((a, b) => a.due - b.due),
    [data.cards],
  );

  const confusions = useMemo(() => topConfusions(data.progress), [data.progress]);
  const discovered = Object.keys(data.progress).length;

  return (
    <div className="min-h-dvh">
      <Hud />

      <main className="mx-auto w-full max-w-[1440px] px-4 pb-16 pt-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold">Общий прогресс</h1>
            <p className="text-sm text-slate-500">
              {hydrated
                ? `${profile.name} · открыто ${discovered} из ${COUNTRIES.length} стран · лучшая серия ${data.bestHotStreak}`
                : 'Загружаем прогресс…'}
            </p>
          </div>

          {/* Переключатель навыка */}
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Фильтр по навыку">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                  tab === t.id
                    ? 'bg-accent text-white'
                    : 'border border-line bg-ink-800 text-slate-500 hover:text-ink'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* Карта / глобус */}
          <div className="relative">
            <div className="panel relative h-[58vh] min-h-[400px] overflow-hidden">
              {view === 'map' ? (
                <WorldMap
                  colorFor={colorFor}
                  selected={selected}
                  onSelect={(code) => setSelected(code)}
                  className="h-full w-full p-3"
                />
              ) : (
                <GlobeView
                  colorFor={colorFor}
                  focus={focus}
                  autoRotate={!selected}
                  onSelect={(code) => {
                    setSelected(code);
                    const country = getCountry(code);
                    if (country) setFocus({ lat: country.lat, lng: country.lng, altitude: 1.6 });
                  }}
                />
              )}

              {/* Переключатель вида */}
              <div className="absolute right-3 top-3 z-10 flex gap-1 rounded-lg border border-line bg-ink-950/80 p-1">
                {(
                  [
                    { id: 'map', label: '🗺 Карта' },
                    { id: 'globe', label: '🌐 Глобус' },
                  ] as const
                ).map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setView(v.id)}
                    aria-pressed={view === v.id}
                    className={`rounded-md px-2.5 py-1 text-xs font-extrabold transition ${
                      view === v.id ? 'bg-accent text-white' : 'text-slate-500 hover:text-white'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            {selected && (
              <div className="absolute bottom-3 right-3 z-20 max-w-[92%]">
                <CountryInfo code={selected} onClose={() => setSelected(null)} />
              </div>
            )}
          </div>

          {/* Правая панель */}
          <div className="space-y-4">
            <section className="panel p-4">
              <p className="panel-title mb-1">
                {tab === 'overall' ? 'Все навыки' : SKILL_META[tab as CountrySkill].label}
              </p>
              <p className="text-3xl font-extrabold">
                {tabMastered}
                <span className="text-lg text-slate-500"> / {tabTotal}</span>
                <span className="ml-2 text-sm font-bold text-slate-500">освоено</span>
              </p>
              <ul className="mt-3 space-y-1.5">
                {[5, 4, 3, 2, 1, 0].map((level) => (
                  <li key={level} className="flex items-center gap-2.5 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: LEVELS[level].color }} />
                    <span className="flex-1 text-slate-500">{LEVELS[level].label}</span>
                    <span className="font-extrabold tabular-nums">{levelCounts[level]}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel p-4">
              <p className="panel-title mb-3">Слабые навыки</p>
              <ul className="space-y-2">
                {weakestSkills.map(({ skill, percent }, i) => (
                  <li key={skill} className="flex items-center gap-2.5 text-sm">
                    <span className="w-4 text-slate-600">{i + 1}</span>
                    <span
                      aria-hidden
                      className="grid h-6 w-6 place-items-center rounded-md text-xs"
                      style={{ background: `${SKILL_META[skill].color}26` }}
                    >
                      {SKILL_META[skill].emoji}
                    </span>
                    <span className="flex-1 font-bold">{SKILL_META[skill].short}</span>
                    <span className="font-extrabold text-slate-500">{percent}%</span>
                  </li>
                ))}
              </ul>
              {dueCards.length > 0 && (
                <Link href="/play/review" className="btn-primary mt-4 block w-full px-4 py-2.5 text-center text-sm">
                  Повторить сегодня · {dueCards.length}{' '}
                  {dueCards.length === 1 ? 'карточка' : 'карточек'}
                </Link>
              )}
            </section>

            <DailyGoal
              dayStreak={data.dayStreak}
              answersToday={data.answersToday}
              history={data.history ?? {}}
            />
          </div>
        </div>

        {/* Путаница */}
        {confusions.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-3 text-xl font-extrabold">Что ты путаешь</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {confusions.map(({ a, b, count, skill }) => (
                <Link
                  key={`${a}-${b}-${skill}`}
                  href={`/play/flag?pair=${a},${b}&skill=${skill}`}
                  className="panel flex items-center gap-3 p-4 transition hover:border-accent/50"
                >
                  <FlagImage code={a} size={34} />
                  <FlagImage code={b} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold">
                      {getCountry(a)?.name} / {getCountry(b)?.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {SKILL_META[skill].short} · перепутано {count} раз
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Достижения */}
        <section id="achievements" className="mt-8">
          <h2 className="mb-3 text-xl font-extrabold">Достижения</h2>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {ACHIEVEMENTS.map((achievement) => {
              const has = data.unlocked.includes(achievement.id);
              const progress = has ? null : achievementProgress(data, achievement.id);
              return (
                <div
                  key={achievement.id}
                  className={`panel flex items-center gap-3 p-3.5 ${has ? '' : 'opacity-80'}`}
                >
                  <span
                    aria-hidden
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-xl ${
                      has ? 'bg-amber-400/20' : 'bg-ink-700 grayscale'
                    }`}
                  >
                    {achievement.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold">{achievement.title}</p>
                    <p className="truncate text-xs text-slate-500">{achievement.description}</p>
                    {progress && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700">
                          <div
                            className="h-full rounded-full bg-accent"
                            style={{ width: `${(progress.current / progress.target) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-500">
                          {progress.current}/{progress.target}
                        </span>
                      </div>
                    )}
                  </div>
                  {has && (
                    <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-extrabold text-emerald-600">
                      Получено
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Все страны */}
        <section className="mt-8">
          <h2 className="mb-3 text-xl font-extrabold">Все страны по континентам</h2>
          <div className="space-y-6">
            {CONTINENTS.map((continent) => (
              <div key={continent.id}>
                <div className="mb-2 flex items-center gap-2">
                  <span aria-hidden>{continent.emoji}</span>
                  <h3 className="font-extrabold">{continent.name}</h3>
                  <button
                    onClick={() => {
                      setSelected(null);
                      setView('globe');
                      setFocus(continent.view);
                    }}
                    className="ml-1 rounded-full border border-line px-2.5 py-0.5 text-xs font-bold text-slate-500 transition hover:text-ink"
                  >
                    Показать
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  {countriesOf(continent.id).map((country) => {
                    const level = levels[country.code] ?? 0;
                    return (
                      <button
                        key={country.code}
                        onClick={() => {
                          setSelected(country.code);
                          setFocus({ lat: country.lat, lng: country.lng, altitude: 1.6 });
                        }}
                        className="flex items-center gap-2 rounded-xl border border-line bg-ink-800 p-2 text-left transition hover:border-accent/40"
                      >
                        <FlagImage code={country.code} size={22} />
                        <span className="min-w-0 flex-1 truncate text-sm font-bold">
                          {country.name}
                        </span>
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: LEVELS[level].color }}
                          title={LEVELS[level].label}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Настройки профиля */}
        <section className="mt-10 border-t border-line pt-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="panel-title mb-2">Возрастной режим</p>
              <div className="flex flex-wrap gap-2">
                {AGE_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setAgeMode(mode.id)}
                    title={mode.hint}
                    className={`rounded-lg px-3.5 py-2 text-sm font-bold transition ${
                      profile.ageMode === mode.id
                        ? 'bg-accent text-white'
                        : 'border border-line bg-ink-800 text-slate-500 hover:text-ink'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => {
                if (confirm(`Сбросить прогресс профиля «${profile.name}»? Это действие нельзя отменить.`))
                  reset();
              }}
              className="text-sm text-slate-600 underline-offset-4 transition hover:text-rose-600 hover:underline"
            >
              Сбросить прогресс этого профиля
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

/** «Ежедневная цель»: серия, прогресс за день и календарь активности месяца. */
function DailyGoal({
  dayStreak,
  answersToday,
  history,
}: {
  dayStreak: number;
  answersToday: number;
  history: Record<string, number>;
}) {
  // Дата берётся один раз на маунт — для календаря этого достаточно.
  const [today] = useState(currentDate);
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  /** Понедельник = 0. */
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const todayDate = today.getDate();

  const dayKey = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const goalPercent = Math.min(100, Math.round((answersToday / DAILY_GOAL) * 100));

  return (
    <section className="panel p-4">
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid h-11 w-11 place-items-center rounded-xl bg-orange-500/15 text-2xl">
          🔥
        </span>
        <div>
          <p className="text-2xl font-extrabold leading-tight">
            {dayStreak} {dayStreak === 1 ? 'день' : dayStreak < 5 ? 'дня' : 'дней'}
          </p>
          <p className="text-xs text-slate-500">Текущая серия</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="panel-title">Ежедневная цель</span>
          <span className="font-bold text-slate-500">
            {Math.min(answersToday, DAILY_GOAL)} / {DAILY_GOAL} повторений
          </span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-ink-700">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-400 transition-[width] duration-500"
            style={{ width: `${goalPercent}%` }}
          />
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-sm font-extrabold">
          {MONTHS[month]} {year}
        </p>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-600">
          {WEEKDAYS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: firstWeekday }).map((_, i) => (
            <span key={`pad-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const played = (history[dayKey(day)] ?? 0) > 0;
            const isToday = day === todayDate;
            return (
              <span
                key={day}
                className={`grid h-7 place-items-center rounded-md text-xs font-bold ${
                  played
                    ? 'bg-emerald-500/25 text-emerald-600'
                    : isToday
                      ? 'border border-accent/60 text-slate-500'
                      : 'text-slate-600'
                }`}
                title={played ? `${history[dayKey(day)]} повторений` : undefined}
              >
                {played ? '✓' : day}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
