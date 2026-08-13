'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import Hud from '@/components/Hud';
import { useActiveData, useHydrated } from '@/lib/store';
import { SKILLS, SKILL_META } from '@/modules/people/config';
import { masteryOf, summarize } from '@/modules/people/mastery';
import { PEOPLE, TOTAL_PEOPLE, getPerson } from '@/modules/people/people';
import { normalizePeopleProgress, topConfusions, weakPeople } from '@/modules/people/progress';
import PersonPhoto from '@/modules/people/components/PersonPhoto';
import { CREDIT_BY_ID } from '@/modules/people/data/credits';

const ALL_IDS = PEOPLE.map((person) => person.id);

/**
 * Прогресс по людям. Главное здесь не общий процент, а разбивка по четырём
 * навыкам: узнавать лицо и знать, чем человек занимался, — разные умения.
 */
export default function PeopleProgressPage() {
  const hydrated = useHydrated();
  const data = useActiveData();
  const progress = useMemo(() => normalizePeopleProgress(data.people), [data.people]);
  const summary = summarize(progress, ALL_IDS);

  const weak = hydrated ? weakPeople(progress, 6) : [];
  const pairs = hydrated ? topConfusions(progress, 6) : [];
  const best = hydrated
    ? [...PEOPLE]
        .map((person) => ({ person, mastery: masteryOf(progress, person.id) }))
        .filter((row) => row.mastery.percent > 0)
        .sort((a, b) => b.mastery.percent - a.mastery.percent)
        .slice(0, 6)
    : [];

  return (
    <div className="min-h-dvh">
      <Hud />

      <main className="mx-auto w-full max-w-4xl px-4 pb-24 pt-6 sm:px-6">
        <Link href="/people" className="text-sm text-slate-500 hover:text-ink">
          ← Известные люди
        </Link>

        <h1 className="mt-3 text-3xl font-extrabold">Известные люди Казахстана</h1>
        <p className="mt-2 text-2xl font-extrabold">
          {hydrated ? summary.learned : 0} / {TOTAL_PEOPLE}
        </p>
        <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-ink-700">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 to-violet-400 transition-[width] duration-500"
            style={{ width: `${((hydrated ? summary.learned : 0) / TOTAL_PEOPLE) * 100}%` }}
          />
        </div>

        <section className="panel mt-5 space-y-4 p-5">
          <p className="panel-title">Четыре навыка</p>
          {SKILLS.map((skill) => (
            <div key={skill}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-extrabold">{SKILL_META[skill].label}</span>
                <span className="text-slate-400">{hydrated ? summary.bySkill[skill] : 0}%</span>
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
            Высокое «Имя → роль» при низком «Фото → имя» значит, что ребёнок знает про человека,
            но не узнаёт его в лицо.
          </p>
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="panel p-5">
            <p className="panel-title mb-3">Лучше всего знаю</p>
            {best.length === 0 ? (
              <p className="text-sm text-slate-500">Пока никого не изучали.</p>
            ) : (
              <ul className="space-y-2">
                {best.map(({ person, mastery }) => (
                  <li key={person.id} className="flex items-center gap-3">
                    <PersonPhoto personId={person.id} className="h-9 w-9" sizes="36px" />
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">
                      {person.nameRu}
                    </span>
                    <span className="text-sm font-extrabold" style={{ color: mastery.color }}>
                      {mastery.percent}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel p-5">
            <p className="panel-title mb-3">Нужно повторить</p>
            {weak.length === 0 ? (
              <p className="text-sm text-slate-500">Пока нет ошибок.</p>
            ) : (
              <ul className="space-y-2">
                {weak.map((id) => {
                  const person = getPerson(id);
                  if (!person) return null;
                  return (
                    <li key={id} className="flex items-center gap-3">
                      <PersonPhoto personId={id} className="h-9 w-9" sizes="36px" />
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">
                        {person.nameRu}
                      </span>
                      <span className="text-xs text-slate-500">{person.role}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {pairs.length > 0 && (
          <section className="panel mt-4 p-5">
            <p className="panel-title mb-3">Кого путаю</p>
            <ul className="space-y-1.5 text-sm">
              {pairs.map((pair) => (
                <li key={`${pair.a}-${pair.b}`} className="flex items-center gap-2">
                  <span className="font-bold">{getPerson(pair.a)?.nameRu}</span>
                  <span className="text-slate-600">↔</span>
                  <span className="font-bold">{getPerson(pair.b)?.nameRu}</span>
                  <span className="ml-auto text-xs text-slate-500">{pair.count}×</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              Таких людей приложение чаще ставит в один вопрос — рядом разницу видно лучше.
            </p>
          </section>
        )}

        <p className="mt-8 text-center text-xs text-slate-500">
          Данные и фотографии — Wikidata и Wikimedia Commons, {CREDIT_BY_ID.size} файлов
          с указанием автора и лицензии.
        </p>
      </main>
    </div>
  );
}
