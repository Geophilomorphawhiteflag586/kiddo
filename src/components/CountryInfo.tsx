'use client';

import Link from 'next/link';
import { CONTINENT_BY_ID, WITHOUT_POLYGON, getCountry } from '@/lib/countries';
import { cardsOfCountry, totalConfusions } from '@/lib/progress';
import { SKILLS, SKILL_META, countryMastery, skillPercent } from '@/lib/skills';
import { useActiveData, useActiveProfile } from '@/lib/store';
import type { CountrySkill } from '@/lib/types';
import Donut from './Donut';
import FlagImage from './FlagImage';
import SpeakButton from './SpeakButton';

interface Props {
  code: string;
  onClose: () => void;
}

function formatDue(due: number): string {
  const now = Date.now();
  if (due <= now) return 'Сегодня';
  const days = Math.ceil((due - now) / (24 * 60 * 60 * 1000));
  if (days <= 1) return 'Завтра';
  return `Через ${days} дн.`;
}

function SkillIcon({ skill }: { skill: CountrySkill }) {
  return (
    <span
      aria-hidden
      className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-xs"
      style={{ background: `${SKILL_META[skill].color}26`, color: SKILL_META[skill].color }}
    >
      {SKILL_META[skill].emoji}
    </span>
  );
}

/** Карточка освоения страны: факты + независимый прогресс каждого навыка. */
export default function CountryInfo({ code, onClose }: Props) {
  const country = getCountry(code);
  const profile = useActiveProfile();
  const data = useActiveData();
  if (!country) return null;

  const cards = cardsOfCountry(data.cards, code);
  const hasOutline = !WITHOUT_POLYGON.has(code);
  const overall = countryMastery(cards, hasOutline);
  const continent = CONTINENT_BY_ID.get(country.continent);

  const visibleSkills = SKILLS.filter((s) => s !== 'outlineToCountry' || hasOutline);
  const weakest = visibleSkills.reduce<CountrySkill>(
    (weak, skill) => (skillPercent(cards[skill]) < skillPercent(cards[weak]) ? skill : weak),
    visibleSkills[0],
  );

  const upcoming = visibleSkills
    .map((skill) => ({ skill, card: cards[skill] }))
    .filter((x) => x.card && x.card.repetitions > 0)
    .sort((a, b) => (a.card!.due ?? 0) - (b.card!.due ?? 0))
    .slice(0, 3);

  const confusions = Object.entries(
    totalConfusions(data.progress[code] ?? { countryCode: code, confusedWith: {}, discoveredAt: null }),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <aside className="panel animate-pop max-h-[80vh] w-full max-w-md overflow-y-auto p-5 text-slate-100">
      {/* Шапка */}
      <div className="flex items-start gap-3">
        <FlagImage code={code} size={44} />
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 truncate text-xl font-extrabold">
            {country.name}
            <SpeakButton text={country.name} lang="ru-RU" />
          </h2>
          <p className="truncate text-xs text-slate-400">{country.nameEn}</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Закрыть"
          className="rounded-full px-2 py-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="mt-4 grid grid-cols-[auto_1fr] gap-4">
        {/* Факты + общий donut */}
        <div className="flex flex-col items-start gap-3">
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Столица</dt>
              <dd className="font-bold">{country.capital}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Континент</dt>
              <dd className="font-bold">{continent?.name ?? '—'}</dd>
            </div>
            {profile.ageMode !== 'kid' && (
              <div>
                <dt className="text-xs text-slate-500">Языки</dt>
                <dd className="max-w-36 text-sm font-bold">{country.languages.join(', ') || '—'}</dd>
              </div>
            )}
            {profile.ageMode === 'adult' && (
              <div>
                <dt className="text-xs text-slate-500">Валюта</dt>
                <dd className="font-bold">{country.currency || '—'}</dd>
              </div>
            )}
          </dl>

          <div className="text-center">
            <Donut percent={overall} size={92} color="#22c55e">
              <div>
                <div className="text-xl font-extrabold">{overall}%</div>
              </div>
            </Donut>
            <p className="panel-title mt-1">Общее освоение</p>
          </div>
        </div>

        {/* Навыки */}
        <ul className="space-y-2.5">
          {visibleSkills.map((skill) => {
            const card = cards[skill];
            const percent = skillPercent(card);
            return (
              <li key={skill} className="text-sm">
                <div className="flex items-center gap-2">
                  <SkillIcon skill={skill} />
                  <span className="min-w-0 flex-1 truncate text-slate-300">
                    {SKILL_META[skill].label}
                  </span>
                  <span
                    className="font-extrabold tabular-nums"
                    style={{ color: card ? SKILL_META[skill].color : '#64748b' }}
                  >
                    {card ? `${percent}%` : '—'}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${percent}%`, background: SKILL_META[skill].color }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Следующее повторение + путаница */}
      {(upcoming.length > 0 || confusions.length > 0) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {upcoming.length > 0 && (
            <div className="rounded-xl border border-line bg-ink-900 p-3">
              <p className="panel-title mb-2">Следующее повторение</p>
              <ul className="space-y-1 text-sm">
                {upcoming.map(({ skill, card }) => (
                  <li key={skill} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <SkillIcon skill={skill} />
                      {SKILL_META[skill].short}
                    </span>
                    <span className="font-bold">{formatDue(card!.due)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {confusions.length > 0 && (
            <div className="rounded-xl border border-line bg-ink-900 p-3">
              <p className="panel-title mb-2">Чаще всего путаете с</p>
              <div className="flex flex-wrap gap-2">
                {confusions.map(([other]) => (
                  <Link
                    key={other}
                    href={`/play/flag?pair=${code},${other}`}
                    title={`Тренировка: ${country.name} / ${getCountry(other)?.name}`}
                    className="flex flex-col items-center gap-1 rounded-lg border border-line bg-ink-800 p-2 transition hover:border-accent/50"
                  >
                    <FlagImage code={other} size={22} />
                    <span className="max-w-16 truncate text-[11px] font-bold">
                      {getCountry(other)?.name}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <Link href={`/play/train?country=${code}`} className="btn-primary flex-1 px-4 py-2.5 text-center">
          Тренировать страну
        </Link>
        {skillPercent(cards[weakest]) < 60 && (
          <Link
            href={`/play/train?country=${code}&skill=${weakest}`}
            className="btn-ghost px-4 py-2.5 text-sm"
          >
            Повторить: {SKILL_META[weakest].short.toLowerCase()}
          </Link>
        )}
      </div>
    </aside>
  );
}
