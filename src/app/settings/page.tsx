'use client';

import Link from 'next/link';
import Hud from '@/components/Hud';
import { levelOf } from '@/components/ProfileMenu';
import type { AgeMode } from '@/lib/types';
import { useActiveData, useActiveProfile, useGame, useHydrated } from '@/lib/store';
import VoicePicker from '@/modules/chinese/components/VoicePicker';

/**
 * Профиль и настройки.
 *
 * Сюда вынесено то, что раньше было доступно только из выпадающего меню в
 * шапке: возрастной режим и выбор голоса для озвучки. Управление профилями и
 * резервные копии остались в меню профиля — дублировать их здесь незачем.
 */

const AGE_MODES: Array<{ id: AgeMode; title: string; hint: string }> = [
  { id: 'kid', title: 'Малышам', hint: 'Минимум текста, больше картинок и подсказок' },
  { id: 'school', title: 'Школьникам', hint: 'Добавляются площадь и языки страны' },
  { id: 'adult', title: 'Взрослым', hint: 'Ещё валюта, регион и число соседей' },
];

export default function SettingsPage() {
  const hydrated = useHydrated();
  const profile = useActiveProfile();
  const data = useActiveData();
  const setAgeMode = useGame((s) => s.setAgeMode);

  return (
    <div className="min-h-dvh">
      <Hud />

      <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6 sm:px-6">
        <h1 className="text-3xl font-extrabold">Профиль и настройки</h1>

        <section className="panel mt-5 flex flex-wrap items-center gap-4 p-5">
          <span
            aria-hidden
            className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-accent to-brand-blue text-2xl font-extrabold text-white"
          >
            {hydrated ? (profile?.name ?? 'Г').slice(0, 1).toUpperCase() : '—'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-extrabold">{hydrated ? profile?.name : '—'}</p>
            <p className="text-sm text-slate-400">
              {hydrated
                ? `Уровень ${levelOf(data.xp)} · ${data.xp.toLocaleString('ru-RU')} XP · ${data.coins} монет`
                : ' '}
            </p>
          </div>
          <p className="w-full text-xs text-slate-400 sm:w-auto">
            Сменить профиль, переименовать или сохранить копию прогресса — в меню профиля
            справа сверху.
          </p>
        </section>

        <section className="panel mt-4 p-5">
          <p className="panel-title mb-1">Возрастной режим</p>
          <p className="mb-4 text-sm text-slate-400">
            Определяет, сколько подробностей показывать в карточке страны.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {AGE_MODES.map((mode) => {
              const active = hydrated && profile?.ageMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setAgeMode(mode.id)}
                  aria-pressed={active}
                  className={`rounded-2xl border-2 p-4 text-left transition ${
                    active
                      ? 'border-accent bg-accent/8'
                      : 'border-line bg-ink-900 hover:border-accent/40'
                  }`}
                >
                  <span className="block font-extrabold">{mode.title}</span>
                  <span className="mt-1 block text-xs text-slate-400">{mode.hint}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel mt-4 p-5">
          <p className="panel-title mb-1">Озвучка</p>
          <p className="mb-4 text-sm text-slate-400">
            Голоса берутся из операционной системы. Если нужного языка нет, установите его в
            параметрах системы — приложение подхватит голос после перезапуска браузера.
          </p>
          <VoicePicker />
        </section>

        <div className="mt-6 text-center">
          <Link href="/learn" className="btn-ghost inline-block px-6 py-3 text-sm">
            К направлениям
          </Link>
        </div>
      </main>
    </div>
  );
}
