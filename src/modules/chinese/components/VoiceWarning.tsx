'use client';

import { useSyncExternalStore } from 'react';
import { speechSupported, subscribeVoices, voiceFor } from '@/lib/speech';
import { SPEECH_LANG } from '../config.ts';
import VoicePicker from './VoicePicker.tsx';

/**
 * Честное предупреждение: если в системе нет китайского голоса, кодом это не
 * лечится — браузеру нечем читать 汉字, и он либо молчит, либо произносит
 * иероглифы чужим голосом. Показываем, что именно установить.
 *
 * Список голосов приезжает асинхронно, поэтому читаем его через внешний
 * источник: компонент перерисуется сам, когда голоса появятся.
 */
const getVoiceName = () => (speechSupported() ? (voiceFor(SPEECH_LANG)?.name ?? '') : null);

export default function VoiceWarning() {
  const voiceName = useSyncExternalStore(subscribeVoices, getVoiceName, () => null);

  // На сервере и до загрузки голосов ничего не показываем.
  if (voiceName === null && typeof window === 'undefined') return null;

  if (voiceName) return <VoicePicker />;

  return (
    <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm">
      <p className="font-extrabold text-amber-200">
        {voiceName === null
          ? 'Браузер не умеет произносить текст'
          : 'Нет китайского голоса — произношение работать не будет'}
      </p>
      {voiceName === '' && (
        <div className="mt-2 space-y-2 text-slate-400">
          <p>
            Синтез речи берёт голоса из системы. Без китайского голоса браузер молчит или
            читает иероглифы чужим языком — тоны при этом теряются.
          </p>
          <p className="text-slate-400">
            <span className="font-bold text-slate-500">Быстрое решение:</span> откройте
            приложение в Microsoft Edge — у него есть собственные китайские голоса
            (Xiaoxiao, Yunxi), ничего устанавливать не нужно.
          </p>
          <p className="text-slate-400">
            <span className="font-bold text-slate-500">Или поставьте системный голос:</span>{' '}
            Параметры → Время и язык → Язык и регион → «Китайский (упрощённое письмо)» → «…» →
            Параметры языка → «Преобразование текста в речь». После установки полностью
            закройте и снова откройте браузер.
          </p>
          <VoicePicker />
        </div>
      )}
    </div>
  );
}
