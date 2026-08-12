'use client';

import { useState, useSyncExternalStore } from 'react';
import {
  availableVoices,
  preferredVoiceName,
  setPreferredVoice,
  speak,
  speechSupported,
  subscribeVoices,
  voiceFor,
} from '@/lib/speech';
import { SPEECH_LANG } from '../config.ts';

/** Пробная фраза: «привет» — короткая, с ясными тонами (nǐ hǎo). */
const SAMPLE = '你好';

/** Список голосов приезжает асинхронно — читаем его как внешний источник. */
const voicesSnapshot = () => (speechSupported() ? availableVoices().length : -1);

/**
 * Ручной выбор голоса. Автоподбор ошибается, если в системе несколько
 * китайских голосов разного качества, а услышать их можно только вживую —
 * поэтому рядом с каждым есть кнопка прослушивания.
 */
export default function VoicePicker() {
  const count = useSyncExternalStore(subscribeVoices, voicesSnapshot, () => -1);
  const [open, setOpen] = useState(false);

  if (count <= 0) return null;

  const all = availableVoices();
  const active = voiceFor(SPEECH_LANG);
  const chosen = preferredVoiceName(SPEECH_LANG);
  // Показываем все китайские голоса; если их нет — весь список, чтобы было
  // видно, что именно установлено в системе.
  const chinese = all.filter((voice) => voice.lang.toLowerCase().startsWith('zh'));
  const shown = chinese.length > 0 ? chinese : all;

  return (
    <div className="rounded-xl border border-line bg-ink-900 p-3 text-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-slate-400">
          Голос: <span className="font-bold text-slate-500">{active?.name ?? 'не найден'}</span>
        </span>
        <span className="text-xs text-accent">{open ? 'Свернуть' : 'Выбрать другой'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-1.5">
          {chinese.length === 0 && (
            <p className="text-xs text-amber-300">
              Китайских голосов в системе нет. Ниже — всё, что доступно браузеру; чужой язык
              прочитает иероглифы неправильно.
            </p>
          )}

          <button
            onClick={() => setPreferredVoice(SPEECH_LANG, null)}
            className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition ${
              chosen === null ? 'border-accent bg-accent/15' : 'border-line hover:bg-ink-700'
            }`}
          >
            <span className="flex-1 font-bold">Автоматически</span>
            <span className="text-xs text-slate-400">по языку и качеству</span>
          </button>

          {shown.map((voice) => (
            <div
              key={voice.name}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition ${
                chosen === voice.name ? 'border-accent bg-accent/15' : 'border-line'
              }`}
            >
              <button
                onClick={() => setPreferredVoice(SPEECH_LANG, voice.name)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate font-bold">{voice.name}</span>
                <span className="block text-xs text-slate-400">
                  {voice.lang}
                  {voice.localService ? ' · офлайн' : ' · онлайн (может тормозить)'}
                </span>
              </button>
              <button
                onClick={() => speak(SAMPLE, { lang: SPEECH_LANG, rate: 0.75, voice })}
                aria-label={`Прослушать ${voice.name}`}
                className="btn-ghost shrink-0 px-3 py-1.5 text-xs"
              >
                ▶ 你好
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
