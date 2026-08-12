'use client';

/**
 * Произношение через встроенный в браузер синтез речи.
 *
 * Наивный вызов `speechSynthesis.speak()` работает плохо, и почти все проблемы
 * со звуком — отсюда:
 *
 *  - список голосов заполняется асинхронно (событие `voiceschanged`), поэтому
 *    при первом клике его ещё нет и движок берёт голос по умолчанию;
 *  - если голос не задан явно, Chrome часто читает китайский текст русским или
 *    английским голосом — получается каша вместо тонов;
 *  - `cancel()` непосредственно перед `speak()` в Chrome «съедает» следующую
 *    реплику: звук просто не появляется;
 *  - облачные голоса (`localService: false`) отвечают с заметной задержкой;
 *  - до первого действия пользователя автозапуск речи блокируется.
 *
 * Здесь всё это обходится: голоса ждём, подходящий выбираем сами и кэшируем,
 * локальные предпочитаем облачным, после отмены даём движку такт на приход
 * в себя.
 */

/** Минимум, который нужен от SpeechSynthesisVoice — чтобы выбор был тестируемым. */
export interface VoiceLike {
  name: string;
  lang: string;
  localService: boolean;
  default?: boolean;
}

const normalize = (lang: string) => lang.toLowerCase().replace('_', '-');

/** Кантонский — не путунхуа: для zh-CN такой голос читает совсем иначе. */
const CANTONESE = /(^|-)(yue|hk)(-|$)/;

/**
 * Выбор голоса под язык. Точное совпадение важнее, локальный голос лучше
 * облачного (нет задержки), кантонский для zh-CN отбрасывается.
 */
export function pickVoice(voices: readonly VoiceLike[], lang: string): VoiceLike | null {
  const target = normalize(lang);
  const primary = target.split('-')[0];

  let best: VoiceLike | null = null;
  let bestScore = -Infinity;

  for (const voice of voices) {
    const voiceLang = normalize(voice.lang);
    let score: number;

    if (voiceLang === target) score = 100;
    else if (voiceLang.startsWith(`${primary}-`)) score = 60;
    else if (voiceLang === primary) score = 55;
    else continue;

    if (primary === 'zh' && CANTONESE.test(voiceLang)) score -= 70;
    if (voice.localService) score += 15;
    if (voice.default) score += 5;

    if (score > bestScore) {
      bestScore = score;
      best = voice;
    }
  }

  return best;
}

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/* ------------------------------ список голосов ---------------------------- */

let voices: SpeechSynthesisVoice[] = [];
const listeners = new Set<() => void>();

function refreshVoices() {
  if (!speechSupported()) return;
  const next = window.speechSynthesis.getVoices();
  if (next.length === 0) return;
  voices = next;
  for (const listener of listeners) listener();
}

let initialised = false;

/** Ленивая инициализация: подписка на `voiceschanged` + несколько попыток. */
function ensureVoices() {
  if (initialised || !speechSupported()) return;
  initialised = true;
  refreshVoices();
  window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
  // Safari и часть сборок Chrome событие не шлют — добираем опросом.
  let attempts = 0;
  const poll = setInterval(() => {
    refreshVoices();
    if (voices.length > 0 || ++attempts > 20) clearInterval(poll);
  }, 250);
}

/** Подписка для UI: список голосов может приехать уже после первого рендера. */
export function subscribeVoices(onChange: () => void): () => void {
  ensureVoices();
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function availableVoices(): SpeechSynthesisVoice[] {
  ensureVoices();
  return voices;
}

/* --------------------------- выбор голоса вручную ------------------------- */

const OVERRIDE_PREFIX = 'mapapp.voice.';

/**
 * Ручной выбор голоса. Автоподбор угадывает не всегда (в системе может быть
 * несколько китайских голосов разного качества), а настройка привязана к
 * устройству, а не к профилю, — поэтому живёт отдельно от прогресса.
 */
export function preferredVoiceName(lang: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(OVERRIDE_PREFIX + lang);
  } catch {
    return null;
  }
}

export function setPreferredVoice(lang: string, voiceName: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (voiceName) window.localStorage.setItem(OVERRIDE_PREFIX + lang, voiceName);
    else window.localStorage.removeItem(OVERRIDE_PREFIX + lang);
  } catch {
    /* приватный режим — просто игнорируем */
  }
  for (const listener of listeners) listener();
}

/** Голос, которым реально будет прочитан текст на этом языке. */
export function voiceFor(lang: string): SpeechSynthesisVoice | null {
  ensureVoices();
  const chosen = preferredVoiceName(lang);
  if (chosen) {
    const exact = voices.find((voice) => voice.name === chosen);
    if (exact) return exact;
  }
  return (pickVoice(voices, lang) as SpeechSynthesisVoice | null) ?? null;
}

export function hasVoiceFor(lang: string): boolean {
  return voiceFor(lang) !== null;
}

/* -------------------------------- озвучка --------------------------------- */

let primed = false;

/**
 * «Прогрев» на первом жесте пользователя: браузеры блокируют автозапуск речи,
 * а первый вызов после разблокировки идёт с заметной задержкой.
 */
export function primeSpeech() {
  if (primed || !speechSupported()) return;
  primed = true;
  ensureVoices();
  const utterance = new SpeechSynthesisUtterance(' ');
  utterance.volume = 0;
  window.speechSynthesis.speak(utterance);
}

export interface SpeakOptions {
  lang?: string;
  rate?: number;
  onEnd?: () => void;
  /** Конкретный голос — например, при прослушивании в настройках. */
  voice?: SpeechSynthesisVoice | null;
}

/**
 * Произносит текст. Прерывает предыдущую реплику безопасно: после `cancel()`
 * Chrome не проигрывает реплику, поставленную в очередь в том же такте.
 */
export function speak(
  text: string,
  { lang = 'ru-RU', rate = 0.9, onEnd, voice: explicitVoice }: SpeakOptions = {},
) {
  if (!speechSupported() || !text) {
    onEnd?.();
    return;
  }
  ensureVoices();
  primed = true;

  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = rate;
  // Явный голос — иначе китайский может быть прочитан русским голосом.
  const voice = explicitVoice ?? voiceFor(lang);
  if (voice) utterance.voice = voice;
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();

  const start = () => {
    // Chrome иногда оставляет синтез на паузе после отмены.
    if (synth.paused) synth.resume();
    synth.speak(utterance);
  };

  if (synth.speaking || synth.pending) {
    synth.cancel();
    setTimeout(start, 60);
  } else {
    start();
  }
}

/** Останавливает текущую реплику — например, при уходе со страницы. */
export function stopSpeaking() {
  if (speechSupported()) window.speechSynthesis.cancel();
}
