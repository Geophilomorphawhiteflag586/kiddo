'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import Hud from '@/components/Hud';
import { speak, stopSpeaking } from '@/lib/speech';
import { useGame, useHydrated } from '@/lib/store';
import { ECHO_DELAY, MODE_LABELS, SESSION_LENGTH, SPEECH_LANG } from '../config.ts';
import { normalizeEnglishProgress } from '../progress.ts';
import { buildSession } from '../session.ts';
import type { EnglishQuestion } from '../types.ts';
import { getWord } from '../words.ts';
import WordVisual from './WordVisual.tsx';

type Phase = 'asking' | 'right' | 'wrong';

interface Miss {
  wordId: string;
  chosenId: string;
}

export default function EnglishSession() {
  const hydrated = useHydrated();
  const searchParams = useSearchParams();
  const profileId = useGame((s) => s.activeProfileId);
  const kind = searchParams.get('mode');

  if (!hydrated) {
    return (
      <div className="min-h-dvh">
        <Hud />
        <div className="grid place-items-center py-32 text-slate-500">Loading…</div>
      </div>
    );
  }

  return <RunningSession key={`${profileId}:${kind ?? 'mixed'}`} kind={kind} />;
}

function makeQuestions(kind: string | null): EnglishQuestion[] {
  const state = useGame.getState();
  const progress = normalizeEnglishProgress(state.data[state.activeProfileId]?.english);
  return buildSession({
    progress,
    length: SESSION_LENGTH,
    mistakesOnly: kind === 'mistakes',
    reviewOnly: kind === 'review',
  });
}

function RunningSession({ kind }: { kind: string | null }) {
  const router = useRouter();
  const submit = useGame((s) => s.submitEnglishAnswer);
  const recordSession = useGame((s) => s.recordSession);

  const [questions, setQuestions] = useState<EnglishQuestion[]>(() => makeQuestions(kind));
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('asking');
  const [chosen, setChosen] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [xp, setXp] = useState(0);
  const [misses, setMisses] = useState<Miss[]>([]);
  const [finished, setFinished] = useState(false);

  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const question = questions[index] ?? null;
  const word = question ? getWord(question.wordId) : null;

  // Новый вопрос: сброс таймера; в аудиорежиме слово сразу произносится.
  useEffect(() => {
    startedAt.current = Date.now();
    if (question?.mode === 'audio-to-image') {
      const target = getWord(question.wordId);
      if (target) speak(target.pronunciation, { lang: SPEECH_LANG, rate: 0.85 });
    }
  }, [index, question]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => {
    if (!finished || questions.length === 0) return;
    recordSession('english', {
      correct: correctCount,
      total: questions.length,
      avgMs: 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ровно один раз
  }, [finished]);

  const advance = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    stopSpeaking();
    setPhase('asking');
    setChosen(null);
    if (index + 1 >= questions.length) setFinished(true);
    else setIndex(index + 1);
  }, [index, questions.length]);

  // Пробел и Enter листают дальше — когда разбор уже прочитан.
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
    (chosenId: string) => {
      if (!question || phase !== 'asking') return;
      const target = getWord(question.wordId);
      const picked = getWord(chosenId);
      if (!target || !picked) return;

      const isCorrect = chosenId === question.wordId;
      // Каждый вариант — маленький урок произношения: озвучиваем выбранное
      // слово сразу, независимо от правильности.
      speak(picked.pronunciation, { lang: SPEECH_LANG });
      if (!isCorrect) {
        // После ошибки следом проговаривается правильное слово.
        timer.current = setTimeout(
          () => speak(target.pronunciation, { lang: SPEECH_LANG, rate: 0.85 }),
          ECHO_DELAY,
        );
      }

      const result = submit({
        wordId: question.wordId,
        chosenId,
        mode: question.mode,
        isCorrect,
        responseTimeMs: Date.now() - startedAt.current,
      });

      setChosen(chosenId);
      setPhase(isCorrect ? 'right' : 'wrong');
      setXp((value) => value + result.xpGained);
      if (isCorrect) setCorrectCount((c) => c + 1);
      else setMisses((list) => [...list, { wordId: question.wordId, chosenId }]);

      // Автоперехода нет: ребёнок сам решает, когда наслушался и готов дальше.
    },
    [phase, question, submit],
  );

  const restart = (nextKind: string | null) => {
    if (timer.current) clearTimeout(timer.current);
    setQuestions(makeQuestions(nextKind));
    setIndex(0);
    setPhase('asking');
    setChosen(null);
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
        onHome={() => router.push('/english')}
      />
    );
  }

  if (!question || !word) {
    return (
      <div className="min-h-dvh">
        <Hud />
        <div className="grid place-items-center gap-4 py-32 text-center text-slate-500">
          <p>Пока нечего повторять — сыграй обычную сессию.</p>
          <Link href="/english" className="btn-primary px-6 py-3 text-sm">
            К English
          </Link>
        </div>
      </div>
    );
  }

  const showsImages = question.mode !== 'image-to-word';
  const progress = ((index + (phase === 'asking' ? 0 : 1)) / questions.length) * 100;
  const wrongPick = phase === 'wrong' && chosen ? getWord(chosen) : null;

  return (
    <div className="min-h-dvh">
      <Hud />

      <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:px-6">
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
            <span className="font-bold">{MODE_LABELS[question.mode]}</span>
            <span>
              {index + 1} / {questions.length}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-ink-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500 transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Задание */}
        <div className="panel grid min-h-44 place-items-center p-6">
          {question.mode === 'image-to-word' && <WordVisual word={word} size={110} />}

          {question.mode === 'word-to-image' && (
            <button
              type="button"
              onClick={() => speak(word.pronunciation, { lang: SPEECH_LANG })}
              className="text-center"
              aria-label={`Произнести ${word.word}`}
            >
              <span className="block text-5xl font-extrabold uppercase tracking-wide">
                {word.word}
              </span>
              <span className="mt-2 block text-2xl">🔊</span>
            </button>
          )}

          {question.mode === 'audio-to-image' && (
            <button
              type="button"
              onClick={() => speak(word.pronunciation, { lang: SPEECH_LANG, rate: 0.85 })}
              className="grid h-28 w-28 place-items-center rounded-full bg-accent/20 text-6xl transition hover:bg-accent/30"
              aria-label="Прослушать слово ещё раз"
            >
              🔊
            </button>
          )}
        </div>

        {/* Варианты */}
        <div className={`mt-4 grid gap-3 ${showsImages ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
          {question.options.map((id) => {
            const option = getWord(id);
            if (!option) return null;
            const revealed = phase !== 'asking';
            const isAnswer = id === question.wordId;
            const isChosen = id === chosen;
            const tone = !revealed
              ? 'border-line bg-ink-800 hover:border-accent/60 hover:bg-ink-700'
              : isAnswer
                ? 'border-emerald-400 bg-emerald-500/15'
                : isChosen
                  ? 'border-rose-400 bg-rose-500/15'
                  : 'border-line bg-ink-800 opacity-40';

            return (
              <button
                key={id}
                type="button"
                onClick={() => choose(id)}
                disabled={revealed}
                className={`grid place-items-center gap-2 rounded-2xl border-2 p-5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${tone}`}
              >
                {showsImages ? (
                  <WordVisual word={option} size={64} />
                ) : (
                  <span className="text-2xl font-extrabold uppercase tracking-wide">
                    {option.word}
                  </span>
                )}
                {revealed && isAnswer && <span className="text-xl text-emerald-600">✓</span>}
                {revealed && isChosen && !isAnswer && (
                  <span className="text-xl text-rose-600">✗</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Разбор ответа. Переход только по кнопке — чтобы успеть переслушать. */}
        <div aria-live="polite" className="mt-5 min-h-24 text-center">
          {phase !== 'asking' && (
            <div
              className={`animate-pop rounded-2xl border p-4 ${
                phase === 'right'
                  ? 'border-emerald-400/40 bg-emerald-500/10'
                  : 'border-rose-400/40 bg-rose-500/10'
              }`}
            >
              <p
                className={`text-xl font-extrabold ${
                  phase === 'right' ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {phase === 'right' ? '✓ Correct!' : '✗ Not quite'}
              </p>

              <p className="mt-2 flex items-center justify-center gap-2 text-2xl font-extrabold uppercase">
                <WordVisual word={word} size={32} /> {word.word}
              </p>
              <p className="text-sm text-slate-500">{word.translationRu}</p>

              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <button
                  onClick={() => speak(word.pronunciation, { lang: SPEECH_LANG })}
                  className="btn-ghost px-4 py-2 text-sm"
                >
                  🔊 {word.word}
                </button>
                {phase === 'wrong' && wrongPick && (
                  <button
                    onClick={() => speak(wrongPick.pronunciation, { lang: SPEECH_LANG })}
                    className="btn-ghost px-4 py-2 text-sm text-rose-200"
                  >
                    🔊 {wrongPick.word}
                  </button>
                )}
              </div>

              <button onClick={advance} autoFocus className="btn-primary mt-4 px-10 py-3">
                Next →
              </button>
              <p className="mt-2 text-xs text-slate-600">
                Listen as long as you need · Enter or Space to continue
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 text-center">
          <Link href="/english" className="text-sm text-slate-500 hover:underline">
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
          <p className="text-sm text-slate-500">{accuracy}% accuracy</p>

          <div className="mt-5 flex justify-center gap-2 text-sm font-extrabold">
            <span className="rounded-full bg-amber-400/15 px-4 py-1.5 text-amber-700">
              ⭐ +{xp} XP
            </span>
            <span className="rounded-full bg-emerald-400/15 px-4 py-1.5 text-emerald-200">
              ✓ {correct} words
            </span>
          </div>

          {misses.length > 0 && (
            <div className="mt-6 text-left">
              <p className="panel-title mb-2">Your mistakes</p>
              <ul className="space-y-2">
                {misses.map((miss, i) => {
                  const target = getWord(miss.wordId);
                  const picked = getWord(miss.chosenId);
                  if (!target || !picked) return null;
                  return (
                    <li
                      key={`${miss.wordId}-${i}`}
                      className="flex items-center gap-3 rounded-xl border border-line bg-ink-900 p-3"
                    >
                      <WordVisual word={target} size={32} />
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="font-extrabold uppercase text-emerald-600">{target.word}</p>
                        <p className="text-xs text-slate-500">
                          Ваш ответ: <span className="uppercase text-rose-600">{picked.word}</span>
                        </p>
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
              English
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
