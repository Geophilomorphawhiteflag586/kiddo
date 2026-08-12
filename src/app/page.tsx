'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import CompetitionsBlock from '@/components/CompetitionsBlock';
import CountryInfo from '@/components/CountryInfo';
import GlobeView from '@/components/GlobeView';
import Hud from '@/components/Hud';
import { CONTINENTS, CONTINENT_BY_ID, WITHOUT_POLYGON, countriesOf, getCountry } from '@/lib/countries';
import { MODES } from '@/lib/modes';
import { LEVELS, SKILL_META } from '@/lib/skills';
import { isDue } from '@/lib/srs';
import { levelMap, useActiveData, useGame, useHydrated } from '@/lib/store';
import FlagImage from '@/components/FlagImage';

const hasOutline = (code: string) => !WITHOUT_POLYGON.has(code);

const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const todayStr = () => dayOf(Date.now());

/** Диапазоны процентов для легенды — как в макете. */
const LEGEND = [5, 4, 3, 2, 1, 0].map((level) => ({
  level,
  ...LEVELS[level],
}));

export default function Home() {
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [focus, setFocus] = useState<{ lat: number; lng: number; altitude: number } | null>(null);
  const hydrated = useHydrated();
  const data = useActiveData();
  const discover = useGame((s) => s.discover);

  const levels = useMemo(() => levelMap(data, 'overall', hasOutline), [data]);

  const colorFor = useMemo(
    () => (code: string) => {
      if (code === selected) return '#f472b6';
      const level = levels[code];
      return level ? LEVELS[level].color : null;
    },
    [levels, selected],
  );

  const raised = useMemo(() => new Set(selected ? [selected] : []), [selected]);

  const dueCount = useMemo(
    () => Object.values(data.cards).filter((card) => card.repetitions > 0 && isDue(card)).length,
    [data.cards],
  );

  const newToday = useMemo(() => {
    const today = todayStr();
    return Object.values(data.progress).filter(
      (p) => p.discoveredAt && dayOf(p.discoveredAt) === today,
    ).length;
  }, [data.progress]);

  const handleSelect = (code: string) => {
    setSelected(code);
    setExpanded(false);
    discover(code);
    const country = getCountry(code);
    if (country) setFocus({ lat: country.lat, lng: country.lng, altitude: 1.6 });
  };

  const selectedCountry = selected ? getCountry(selected) : null;

  return (
    <div className="min-h-dvh">
      <Hud />

      <main className="mx-auto w-full max-w-[1440px] px-4 pb-12 pt-4 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_280px]">
          {/* Левая колонка: страна + режимы */}
          <div className="order-2 space-y-4 lg:order-1">
            {selectedCountry ? (
              <section className="panel p-4">
                <div className="flex items-start justify-between gap-2">
                  <FlagImage code={selectedCountry.code} size={40} />
                  <button
                    onClick={() => setSelected(null)}
                    aria-label="Закрыть"
                    className="rounded-full px-2 text-slate-400 transition hover:bg-white/10 hover:text-ink"
                  >
                    ✕
                  </button>
                </div>
                <h2 className="mt-2 text-lg font-extrabold">{selectedCountry.name}</h2>
                <dl className="mt-2 space-y-1.5 text-sm">
                  <Row label="Столица">{selectedCountry.capital}</Row>
                  <Row label="Континент">
                    {CONTINENT_BY_ID.get(selectedCountry.continent)?.name}
                  </Row>
                  <Row label="Языки">{selectedCountry.languages.slice(0, 2).join(', ') || '—'}</Row>
                  <Row label="Валюта">{selectedCountry.currency || '—'}</Row>
                </dl>
                <button onClick={() => setExpanded(true)} className="btn-primary mt-3 w-full px-4 py-2 text-sm">
                  Подробнее
                </button>
              </section>
            ) : (
              <section className="panel p-4">
                <p className="panel-title mb-2">Глобус</p>
                <p className="text-sm text-slate-400">
                  Нажми на страну, чтобы увидеть её карточку и уровень освоения каждого навыка.
                </p>
              </section>
            )}

            <section id="modes" className="panel p-4">
              <p className="panel-title mb-3">Режимы тренировки</p>
              <div className="space-y-1.5">
                {MODES.filter((m) => !m.hidden).map((mode) => (
                  <Link
                    key={mode.slug}
                    href={`/play/${mode.slug}`}
                    className="flex items-center gap-2.5 rounded-xl border border-line bg-ink-700/50 px-3 py-2.5 text-sm font-bold transition hover:border-accent/50 hover:bg-ink-700"
                  >
                    <span
                      aria-hidden
                      className="grid h-7 w-7 place-items-center rounded-lg text-sm"
                      style={{
                        background: `${SKILL_META[mode.skills[0]].color}26`,
                      }}
                    >
                      {mode.emoji}
                    </span>
                    {mode.title}
                    {mode.slug === 'outline' && (
                      <span className="ml-auto rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-extrabold uppercase text-violet-700">
                        новый
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          </div>

          {/* Центр: глобус */}
          <div className="order-1 lg:order-2">
            <div className="panel globe-stage relative h-[52vh] min-h-[380px] overflow-hidden lg:h-[calc(100dvh-8.5rem)]">
              <GlobeView
                colorFor={colorFor}
                raised={raised}
                onSelect={handleSelect}
                focus={focus}
                autoRotate={!selected}
              />
              <div className="pointer-events-none absolute inset-x-0 top-4 text-center">
                <h1 className="text-2xl font-extrabold sm:text-3xl">
                  Выучи <span className="text-accent">все флаги</span> и страны мира
                </h1>
              </div>
            </div>
          </div>

          {/* Правая колонка: легенда + сегодня */}
          <div className="order-3 space-y-4">
            <section className="panel p-4">
              <p className="panel-title mb-3">Уровни освоения</p>
              <ul className="space-y-2">
                {LEGEND.map((item) => (
                  <li key={item.level} className="flex items-center gap-2.5 text-sm">
                    <span className="h-3 w-3 rounded-full" style={{ background: item.color }} />
                    <span className="text-slate-400">{item.label}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel p-4">
              <p className="panel-title mb-3">Сегодня</p>
              {hydrated ? (
                <dl className="space-y-2 text-sm">
                  <Row label="Повторений">{data.answersToday}</Row>
                  <Row label="Новых стран">{newToday}</Row>
                  <Row label="XP заработано">{data.xpToday}</Row>
                  <Row label="Серия">
                    {data.dayStreak} {data.dayStreak === 1 ? 'день' : 'дней'} 🔥
                  </Row>
                  {dueCount > 0 && <Row label="Пора повторить">{dueCount} карточек</Row>}
                </dl>
              ) : (
                <div className="h-24 animate-pulse rounded-xl bg-ink-700" />
              )}
            </section>

            <Link
              href={dueCount > 0 ? '/play/review' : '/play/flag'}
              className="btn-primary block w-full px-4 py-3 text-center"
            >
              Продолжить обучение
            </Link>
            <Link href="/progress" className="btn-ghost block w-full px-4 py-3 text-center text-sm">
              Моя карта мира
            </Link>
          </div>
        </div>

        <CompetitionsBlock />

        {/* Прогресс по континентам */}
        <section className="mt-4">
          <div className="panel p-4">
            <p className="panel-title mb-3">Прогресс по континентам</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {CONTINENTS.map((continent) => {
                const list = countriesOf(continent.id);
                const known = hydrated
                  ? list.filter((c) => (levels[c.code] ?? 0) > 0).length
                  : 0;
                const percent = Math.round((known / list.length) * 100);
                return (
                  <div key={continent.id} className="rounded-xl border border-line bg-ink-700/50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-sm font-extrabold">
                        <span aria-hidden>{continent.emoji}</span>
                        {continent.name}
                      </span>
                      <span className="text-sm font-extrabold text-slate-400">{percent}%</span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent to-sky-400 transition-[width] duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                      <span>
                        {known}/{list.length}
                      </span>
                      <span className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelected(null);
                            setFocus(continent.view);
                          }}
                          className="font-bold transition hover:text-ink"
                        >
                          Показать
                        </button>
                        <Link
                          href={`/play/flag?continent=${continent.id}`}
                          className="font-bold text-accent transition hover:text-violet-800"
                        >
                          Играть
                        </Link>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* Полная карточка страны — модальным слоем */}
      {expanded && selected && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setExpanded(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <CountryInfo code={selected} onClose={() => setExpanded(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-bold">{children}</dd>
    </div>
  );
}
