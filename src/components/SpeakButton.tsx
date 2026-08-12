'use client';

import { useState, useSyncExternalStore } from 'react';
import { speak, speechSupported } from '@/lib/speech';

interface Props {
  text: string;
  /** BCP-47: ru-RU, en-US, kk-KZ, es-ES, zh-CN. */
  lang?: string;
  className?: string;
}

/** Наличие синтеза речи не меняется по ходу жизни страницы — подписка пустая. */
const noSubscribe = () => () => {};

/**
 * Кнопка озвучки. Если голосов нет, кнопка просто не показывается.
 */
export default function SpeakButton({ text, lang = 'ru-RU', className = '' }: Props) {
  const supported = useSyncExternalStore(noSubscribe, speechSupported, () => false);
  const [speaking, setSpeaking] = useState(false);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={() => {
        setSpeaking(true);
        speak(text, { lang, onEnd: () => setSpeaking(false) });
      }}
      aria-label={`Произнести: ${text}`}
      className={`rounded-full px-1.5 py-0.5 text-base transition hover:bg-white/10 ${
        speaking ? 'animate-pulse' : ''
      } ${className}`}
    >
      🔊
    </button>
  );
}
