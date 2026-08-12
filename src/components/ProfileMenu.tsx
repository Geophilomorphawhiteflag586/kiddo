'use client';

import { useEffect, useRef, useState } from 'react';
import { useActiveData, useActiveProfile, useGame } from '@/lib/store';
import { BackupError, backupFileName, buildBackup, parseBackup } from '@/lib/transfer';

/** Уровень профиля растёт от опыта: каждые 250 XP — новый уровень. */
export function levelOf(xp: number): number {
  return 1 + Math.floor(xp / 250);
}

function Avatar({ name, size = 'h-8 w-8 text-sm' }: { name: string; size?: string }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-indigo-600 font-extrabold text-white ${size}`}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/**
 * Блок профиля в шапке: имя, уровень, повторения за сегодня.
 * По клику — панель «Профили»: переключение, создание, переименование, удаление.
 */
export default function ProfileMenu() {
  const profile = useActiveProfile();
  const data = useActiveData();
  const profiles = useGame((s) => s.profiles);
  const dataById = useGame((s) => s.data);
  const switchProfile = useGame((s) => s.switchProfile);
  const createProfile = useGame((s) => s.createProfile);
  const renameProfile = useGame((s) => s.renameProfile);
  const deleteProfile = useGame((s) => s.deleteProfile);

  const importBackup = useGame((s) => s.importBackup);

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /** Выгружает все профили в JSON — для переноса в другой браузер. */
  const exportProfiles = () => {
    const state = useGame.getState();
    const backup = buildBackup({
      profiles: state.profiles,
      data: state.data,
      activeProfileId: state.activeProfileId,
    });
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = backupFileName();
    link.click();
    URL.revokeObjectURL(url);
    setNotice({ ok: true, text: 'Файл сохранён — откройте его в другом браузере' });
  };

  const onFileChosen = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // чтобы тот же файл можно было выбрать повторно
    if (!file) return;
    try {
      const backup = parseBackup(JSON.parse(await file.text()));
      const result = importBackup(backup);
      const added = [...result.imported, ...result.replaced];
      setNotice(
        added.length > 0
          ? { ok: true, text: `Загружено: ${added.join(', ')}` }
          : { ok: false, text: 'В файле не оказалось новых профилей' },
      );
    } catch (error) {
      setNotice({
        ok: false,
        text: error instanceof BackupError ? error.message : 'Не удалось прочитать файл',
      });
    }
  };

  // Клик вне меню закрывает его.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);

  const list = Object.values(profiles).sort((a, b) =>
    a.id === profile.id ? -1 : b.id === profile.id ? 1 : b.lastActiveAt.localeCompare(a.lastActiveAt),
  );

  const submitCreate = () => {
    const name = draft.trim();
    if (name) createProfile(name);
    setDraft('');
    setCreating(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-line bg-ink-800 py-1 pl-1 pr-3 text-left transition hover:bg-ink-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Avatar name={profile.name} />
        <span className="hidden sm:block">
          <span className="block text-sm font-extrabold leading-tight">{profile.name}</span>
          <span className="block text-[11px] leading-tight text-slate-500">
            Уровень {levelOf(data.xp)} · сегодня: {data.answersToday}
          </span>
        </span>
      </button>

      {open && (
        <div role="menu" className="panel animate-pop absolute right-0 top-full z-50 mt-2 w-72 p-3">
          <p className="panel-title mb-2 px-1">Профили</p>

          <div className="space-y-1.5">
            {list.map((p) => {
              const active = p.id === profile.id;
              const xp = dataById[p.id]?.xp ?? 0;
              return (
                <button
                  key={p.id}
                  role="menuitem"
                  onClick={() => {
                    if (!active) switchProfile(p.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition ${
                    active
                      ? 'border-accent/60 bg-accent/15'
                      : 'border-transparent bg-ink-700/60 hover:bg-ink-700'
                  }`}
                >
                  <Avatar name={p.name} size="h-9 w-9 text-base" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-extrabold">
                      {p.name}
                      {p.guest && <span className="ml-1.5 text-xs font-semibold text-slate-500">гость</span>}
                    </span>
                    <span className="block text-xs text-slate-500">
                      Уровень {levelOf(xp)} · {xp.toLocaleString('ru-RU')} XP
                    </span>
                  </span>
                  {active && <span aria-hidden className="text-amber-600">★</span>}
                </button>
              );
            })}
          </div>

          {/* Перенос между браузерами: localStorage у Brave, Chrome и Edge свой,
              поэтому профили не «пропадают», а просто не видны другому браузеру. */}
          <div className="mt-2 border-t border-line pt-2">
            <button
              role="menuitem"
              onClick={exportProfiles}
              className="w-full rounded-lg px-3 py-2 text-left text-sm font-bold transition hover:bg-ink-700"
            >
              ⬇ Сохранить прогресс в файл
            </button>
            <button
              role="menuitem"
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-lg px-3 py-2 text-left text-sm font-bold transition hover:bg-ink-700"
            >
              ⬆ Загрузить из файла
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={onFileChosen}
            />
            {notice && (
              <p
                className={`px-3 pb-1 pt-0.5 text-xs ${
                  notice.ok ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {notice.text}
              </p>
            )}
          </div>

          <div className="mt-2 border-t border-line pt-2">
            {creating ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitCreate();
                }}
                className="flex gap-1.5 p-1"
              >
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Имя профиля"
                  maxLength={24}
                  className="w-full rounded-lg border border-line bg-ink-950 px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
                />
                <button type="submit" className="btn-primary px-3 text-sm">
                  ОК
                </button>
              </form>
            ) : (
              <button
                role="menuitem"
                onClick={() => setCreating(true)}
                className="w-full rounded-lg px-3 py-2 text-left text-sm font-bold transition hover:bg-ink-700"
              >
                ＋ Новый профиль
              </button>
            )}

            <button
              role="menuitem"
              onClick={() => {
                const name = prompt('Новое имя профиля', profile.name);
                if (name) renameProfile(profile.id, name);
              }}
              className="w-full rounded-lg px-3 py-2 text-left text-sm font-bold transition hover:bg-ink-700"
            >
              ✏️ Переименовать текущий
            </button>

            <button
              role="menuitem"
              onClick={() => {
                if (confirm(`Удалить профиль «${profile.name}» вместе со всем прогрессом?`)) {
                  deleteProfile(profile.id);
                  setOpen(false);
                }
              }}
              className="w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-rose-600 transition hover:bg-rose-500/15"
            >
              🗑 Удалить текущий
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
