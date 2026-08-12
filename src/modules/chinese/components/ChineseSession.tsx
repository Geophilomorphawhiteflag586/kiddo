'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import Hud from '@/components/Hud';
import { speak, stopSpeaking } from '@/lib/speech';
import VoiceWarning from './VoiceWarning.tsx';
import { useGame, useHydrated } from '@/lib/store';
import { characterForPinyin, getCharacter } from '../characters.ts';
import { ECHO_DELAY, MODE_LABELS, SESSION_LENGTH, SKILL_META, SPEECH_LANG } from '../config.ts';
import { normalizeChineseProgress } from '../progress.ts';
import { buildSession } from '../session.ts';
import type { ChineseQuestion, ChineseQuizMode } from '../types.ts';

type Phase = 'asking' | 'right' | 'wrong';

interface Miss {
  characterId: string;
  selected: string;
  correct: string;
  mode: ChineseQuizMode;
}

/** Иероглиф читается медленнее обычного — так тон слышно отчётливее. */
const RATE = 0.75;

function speakCharacter(character: string) {
  speak(character, { lang: SPEECH_LANG, rate: RATE });
}

/**
 * Произносит слог по-китайски. Синтез читает 汉字 с правильным тоном, а
 * латиницу — как английские буквы, поэтому вслух идёт иероглиф с тем же
 * чтением. Варианты ответа подбираются только из произносимых слогов, так что
 * подстановка находится всегда.
 */
function speakPinyin(pinyin: string) {
  const character = characterForPinyin(pinyin);
  if (character) speakCharacter(character);
}

export default function ChineseSession() {
  const hydrated = useHydrated();
  const searchParams = useSearchParams();
  const profileId = useGame((s) => s.activeProfileId);
  const kind = searchParams.get('mode');

  if (!hydrated) {
    return (
      <div className="min-h-dvh">
        <Hud />
        <div className="grid place-items-center py-32 text-slate-400">加载中…</div>
      </div>
    );
  }

  return <RunningSession key={`${profileId}:${kind ?? 'mixed'}`} kind={kind} />;
}

function makeQuestions(kind: string | null): ChineseQuestion[] {
  const state = useGame.getState();
  const progress = normalizeChineseProgress(state.data[state.activeProfileId]?.chinese);
  return buildSession({
    progress,
    length: SESSION_LENGTH,
    mistakesOnly: kind === 'mistakes',
    reviewOnly: kind === 'review',
  });
}

function RunningSession({ kind }: { kind: string | null }) {
  const router = useRouter();
  const submit = useGame((s) => s.submitChineseAnswer);
  const recordSession = useGame((s) => s.recordSession);

  const [questions, setQuestions] = useState<ChineseQuestion[]>(() => makeQuestions(kind));
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('asking');
  const [selected, setSelected] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [xp, setXp] = useState(0);
  const [misses, setMisses] = useState<Miss[]>([]);
  const [finished, setFinished] = useState(false);

  const startedAt = useRef(0);
  /** Единственный таймер: отложенное эхо правильного ответа после ошибки. */
  const echoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (echoTimer.current) clearTimeout(echoTimer.current);
    echoTimer.current = null;
  }, []);

  const question = questions[index] ?? null;
  const character = question ? getCharacter(question.characterId) : null;

  // Новый вопрос: сброс таймера; в аудиорежимах знак сразу проговаривается.
  useEffect(() => {
    startedAt.current = Date.now();
    if (question?.mode.startsWith('audio-')) {
      const target = getCharacter(question.characterId);
      if (target) speakCharacter(target.character);
    }
  }, [index, question]);

  useEffect(() => {
    return () => {
      clearTimers();
      stopSpeaking();
    };
  }, [clearTimers]);

  useEffect(() => {
    if (!finished || questions.length === 0) return;
    recordSession('chinese', { correct: correctCount, total: questions.length, avgMs: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ровно один раз
  }, [finished]);

  const advance = useCallback(() => {
    clearTimers();
    stopSpeaking();
    setPhase('asking');
    setSelected(null);
    if (index + 1 >= questions.length) setFinished(true);
    else setIndex(index + 1);
  }, [clearTimers, index, questions.length]);

  /** Переслушать свой вариант — он записан в том же виде, что и варианты ответа. */
  const replaySelected = useCallback(
    (option: string) => {
      if (!question) return;
      if (question.mode === 'pinyin-to-character' || question.mode === 'audio-to-character') {
        speakCharacter(option);
      } else if (
        question.mode === 'character-to-pinyin' ||
        question.mode === 'audio-to-pinyin'
      ) {
        speakPinyin(option);
      }
      // В режиме значений вариант — это перевод, озвучивать нечего.
    },
    [question],
  );

  // Пробел и Enter листают дальше — удобно, когда разбор уже прочитан.
  useEffect(() => {
    if (phase === 'asking') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, phase]);

  const choose = useCallback(
    (option: string) => {
      if (!question || !character || phase !== 'asking') return;
      const isCorrect = option === question.answer;

      // Каждый вариант — микро-урок произношения: озвучиваем выбранное
      // немедленно, верное оно или нет.
      const optionsAreCharacters =
        question.mode === 'pinyin-to-character' || question.mode === 'audio-to-character';
      const optionsArePinyin =
        question.mode === 'character-to-pinyin' || question.mode === 'audio-to-pinyin';

      if (optionsAreCharacters) speakCharacter(option);
      else if (optionsArePinyin) speakPinyin(option);
      else speakCharacter(character.character);

      // После ошибки следом проговаривается правильный ответ.
      if (!isCorrect) {
        echoTimer.current = setTimeout(() => speakCharacter(character.character), ECHO_DELAY);
      }

      const result = submit({
        characterId: question.characterId,
        skill: question.skill,
        mode: question.mode,
        selectedAnswer: option,
        correctAnswer: question.answer,
        isCorrect,
        responseTimeMs: Date.now() - startedAt.current,
      });

      setSelected(option);
      setPhase(isCorrect ? 'right' : 'wrong');
      setXp((value) => value + result.xpGained);
      if (isCorrect) setCorrectCount((c) => c + 1);
      else {
        setMisses((list) => [
          ...list,
          {
            characterId: question.characterId,
            selected: option,
            correct: question.answer,
            mode: question.mode,
          },
        ]);
      }

      // Автоперехода нет: ученик сам решает, когда наслушался и готов дальше.
    },
    [character, phase, question, submit],
  );

  const restart = (nextKind: string | null) => {
    clearTimers();
    setQuestions(makeQuestions(nextKind));
    setIndex(0);
    setPhase('asking');
    setSelected(null);
    setCorrectCount(0);
    setXp(0);
    setMisses([]);
    setFinished(false);
  };

  if (finished) {
    return (
      <Results
        total={questions.length}
        correct={correctCount}
        xp={xp}
        misses={misses}
        onPracticeMistakes={() => restart('mistakes')}
        onAgain={() => restart(kind)}
        onHome={() => router.push('/chinese')}
      />
    );
  }

  if (!question || !character) {
    return (
      <div className="min-h-dvh">
        <Hud />
        <div className="grid place-items-center gap-4 py-32 text-center text-slate-400">
          <p>Пока нечего повторять — сыграй обычную сессию.</p>
          <Link href="/chinese" className="btn-primary px-6 py-3 text-sm">
            К 中文
          </Link>
        </div>
      </div>
    );
  }

  const optionsAreCharacters =
    question.mode === 'pinyin-to-character' || question.mode === 'audio-to-character';
  const progress = ((index + (phase === 'asking' ? 0 : 1)) / questions.length) * 100;

  return (
    <div className="min-h-dvh">
      <Hud />

      <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:px-6">
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between text-sm text-slate-400">
            <span className="font-bold">{MODE_LABELS[question.mode]}</span>
            <span className="flex items-center gap-2">
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-extrabold"
                style={{
                  background: `${SKILL_META[question.skill].color}22`,
                  color: SKILL_META[question.skill].color,
                }}
              >
                {SKILL_META[question.skill].short}
              </span>
              {index + 1} / {questions.length}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-ink-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-red-400 to-amber-400 transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Задание */}
        <div className="panel grid min-h-48 place-items-center p-6 text-center">
          {question.mode === 'character-to-pinyin' || question.mode === 'character-to-meaning' ? (
            <button
              type="button"
              onClick={() => speakCharacter(character.character)}
              aria-label={`Произнести ${character.character}`}
            >
              <span className="block text-8xl font-extrabold leading-none">
                {character.character}
              </span>
              {/* Пиньинь — мост между знаком и звуком; на раннем этапе он виден
                  всегда, кроме задания, где его как раз и нужно выбрать. */}
              {question.mode === 'character-to-meaning' && (
                <span className="mt-3 block text-2xl text-amber-300">{character.pinyin}</span>
              )}
            </button>
          ) : question.mode === 'pinyin-to-character' ? (
            <button type="button" onClick={() => speakPinyin(character.pinyin)}>
              <span className="block text-6xl font-extrabold text-amber-300">
                {character.pinyin}
              </span>
              <span className="mt-3 block text-3xl">🔊</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => speakCharacter(character.character)}
              className="grid h-28 w-28 place-items-center rounded-full bg-accent/20 text-6xl transition hover:bg-accent/30"
              aria-label="Прослушать ещё раз"
            >
              🔊
            </button>
          )}
        </div>

        {/* Варианты */}
        <div className={`mt-4 grid gap-3 ${optionsAreCharacters ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {question.options.map((option) => {
            const revealed = phase !== 'asking';
            const isAnswer = option === question.answer;
            const isChosen = option === selected;
            const tone = !revealed
              ? 'border-line bg-ink-800 hover:border-accent/60 hover:bg-ink-700'
              : isAnswer
                ? 'border-emerald-400 bg-emerald-500/15'
                : isChosen
                  ? 'border-rose-400 bg-rose-500/15'
                  : 'border-line bg-ink-800 opacity-40';

            return (
              <button
                key={option}
                type="button"
                onClick={() => choose(option)}
                disabled={revealed}
                className={`flex items-center justify-center gap-3 rounded-2xl border-2 p-4 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${tone}`}
              >
                <span
                  className={
                    optionsAreCharacters
                      ? 'text-5xl font-extrabold'
                      : question.mode === 'character-to-meaning'
                        ? 'text-xl font-bold'
                        : 'text-3xl font-extrabold text-amber-200'
                  }
                >
                  {option}
                </span>
                {!optionsAreCharacters && question.mode !== 'character-to-meaning' && (
                  <span aria-hidden className="text-lg opacity-60">
                    🔊
                  </span>
                )}
                {revealed && isAnswer && <span className="text-xl text-emerald-300">✓</span>}
                {revealed && isChosen && !isAnswer && (
                  <span className="text-xl text-rose-300">✗</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Разбор ответа. Переход только по кнопке — чтобы успеть переслушать. */}
        <div aria-live="polite" className="mt-5 min-h-28 text-center">
          {phase !== 'asking' && (
            <div
              className={`animate-pop rounded-2xl border p-4 ${
                phase === 'right'
                  ? 'border-emerald-400/40 bg-emerald-500/10'
                  : 'border-rose-400/40 bg-rose-500/10'
              }`}
            >
              <p
                className={`text-lg font-extrabold ${
                  phase === 'right' ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {phase === 'right' ? '✓ Верно!' : '✗ Не то'}
              </p>

              <p className="mt-2 text-5xl font-extrabold">{character.character}</p>
              <p className="text-2xl text-amber-300">{character.pinyin}</p>
              <p className="text-sm text-slate-400">{character.meaningRu}</p>

              {/* Послушать ещё раз — и сравнить со своим вариантом. */}
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button
                  onClick={() => speakCharacter(character.character)}
                  className="btn-ghost px-4 py-2 text-sm"
                >
                  🔊 Правильно: {character.pinyin}
                </button>
                {phase === 'wrong' && selected && (
                  <button
                    onClick={() => replaySelected(selected)}
                    className="btn-ghost px-4 py-2 text-sm text-rose-200"
                  >
                    🔊 Ваш ответ: {selected}
                  </button>
                )}
              </div>

              <button onClick={advance} autoFocus className="btn-primary mt-4 px-10 py-3">
                Далее →
              </button>
              <p className="mt-2 text-xs text-slate-600">
                Слушайте сколько нужно · Enter или пробел — дальше
              </p>
            </div>
          )}
        </div>

        <div className="mt-4">
          <VoiceWarning />
        </div>

        <div className="mt-4 text-center">
          <Link href="/chinese" className="text-sm text-slate-500 hover:underline">
            Выйти
          </Link>
        </div>
      </main>
    </div>
  );
}

function Results({
  total,
  correct,
  xp,
  misses,
  onPracticeMistakes,
  onAgain,
  onHome,
}: {
  total: number;
  correct: number;
  xp: number;
  misses: Miss[];
  onPracticeMistakes: () => void;
  onAgain: () => void;
  onHome: () => void;
}) {
  const accuracy = total === 0 ? 0 : Math.round((correct / total) * 100);

  return (
    <div className="min-h-dvh">
      <Hud />
      <main className="mx-auto w-full max-w-lg px-4 pb-16 pt-10 sm:px-6">
        <div className="panel animate-pop p-7 text-center">
          <p className="text-5xl" aria-hidden>
            {accuracy >= 80 ? '🎉' : '💪'}
          </p>
          <p className="mt-3 text-4xl font-extrabold">
            {correct} / {total}
          </p>
          <p className="text-sm text-slate-400">{accuracy}% accuracy</p>

          <div className="mt-5 flex justify-center gap-2 text-sm font-extrabold">
            <span className="rounded-full bg-amber-400/15 px-4 py-1.5 text-amber-200">
              ⭐ +{xp} XP
            </span>
            <span className="rounded-full bg-emerald-400/15 px-4 py-1.5 text-emerald-200">
              汉字 {correct}
            </span>
          </div>

          {misses.length > 0 && (
            <div className="mt-6 text-left">
              <p className="panel-title mb-2">Your mistakes</p>
              <ul className="space-y-2">
                {misses.map((miss, i) => {
                  const char = getCharacter(miss.characterId);
                  if (!char) return null;
                  return (
                    <li
                      key={`${miss.characterId}-${i}`}
                      className="flex items-center gap-3 rounded-xl border border-line bg-ink-900 p-3"
                    >
                      <span className="text-3xl font-extrabold">{char.character}</span>
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="font-extrabold text-amber-300">{char.pinyin}</p>
                        <p className="text-xs text-slate-500">{char.meaningRu}</p>
                      </div>
                      <div className="text-right text-xs">
                        <p className="text-rose-300">{miss.selected}</p>
                        <p className="text-emerald-300">{miss.correct}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="mt-7 flex flex-wrap gap-2">
            {misses.length > 0 && (
              <button onClick={onPracticeMistakes} className="btn-primary flex-1 px-5 py-3 text-sm">
                Practice mistakes
              </button>
            )}
            <button onClick={onAgain} className="btn-ghost flex-1 px-5 py-3 text-sm">
              Again
            </button>
            <button onClick={onHome} className="btn-ghost px-5 py-3 text-sm">
              中文
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
