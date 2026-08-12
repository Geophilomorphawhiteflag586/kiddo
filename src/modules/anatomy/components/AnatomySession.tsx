'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import Hud from '@/components/Hud';
import { useGame, useHydrated } from '@/lib/store';
import { MODE_LABELS, SESSION_LENGTH, SKILL_META } from '../config.ts';
import { allHaveImages, structureImage } from '../data/images.ts';
import { normalizeAnatomyProgress } from '../progress.ts';
import { buildSession, type SessionStep } from '../session.ts';
import { getStructure } from '../structures.ts';
import type { RegionId } from '../types.ts';
import AnatomyFigure from './AnatomyFigure.tsx';
import ImageCredit from './ImageCredit.tsx';
import StructureImage from './StructureImage.tsx';

type Phase = 'asking' | 'right' | 'wrong';

interface Miss {
  structureId: string;
  chosenId: string;
}

const ALL_REGIONS: RegionId[] = [
  'organs_main',
  'organs_digestive',
  'skull',
  'arm',
  'leg',
  'torso_bones',
  'muscles',
];

function parseRegions(raw: string | null): RegionId[] {
  if (!raw) return ALL_REGIONS;
  const list = raw.split(',').filter((id): id is RegionId =>
    [...ALL_REGIONS, 'skeleton'].includes(id as RegionId),
  );
  return list.length > 0 ? list : ALL_REGIONS;
}

export default function AnatomySession() {
  const hydrated = useHydrated();
  const searchParams = useSearchParams();
  const profileId = useGame((s) => s.activeProfileId);

  const regions = parseRegions(searchParams.get('region'));
  const mistakesOnly = searchParams.get('mode') === 'mistakes';

  if (!hydrated) {
    return (
      <div className="min-h-dvh">
        <Hud />
        <div className="grid place-items-center py-32 text-slate-500">Загружаем…</div>
      </div>
    );
  }

  return (
    <RunningSession
      key={`${profileId}:${regions.join('-')}:${mistakesOnly}`}
      regions={regions}
      mistakesOnly={mistakesOnly}
    />
  );
}

function makeSteps(regions: RegionId[], mistakesOnly: boolean): SessionStep[] {
  const state = useGame.getState();
  const progress = normalizeAnatomyProgress(state.data[state.activeProfileId]?.anatomy);
  return buildSession({ progress, regions, length: SESSION_LENGTH, mistakesOnly });
}

function RunningSession({
  regions,
  mistakesOnly,
}: {
  regions: RegionId[];
  mistakesOnly: boolean;
}) {
  const router = useRouter();
  const submit = useGame((s) => s.submitAnatomyAnswer);
  const markSeen = useGame((s) => s.markAnatomySeen);
  const recordSession = useGame((s) => s.recordSession);

  const [steps, setSteps] = useState<SessionStep[]>(() => makeSteps(regions, mistakesOnly));
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('asking');
  const [chosen, setChosen] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [quizCount, setQuizCount] = useState(0);
  const [xp, setXp] = useState(0);
  const [misses, setMisses] = useState<Miss[]>([]);
  const [finished, setFinished] = useState(false);

  const startedAt = useRef(0);
  const step = steps[index] ?? null;
  const structure = step ? getStructure(step.structureId) : null;

  useEffect(() => {
    startedAt.current = Date.now();
  }, [index]);

  useEffect(() => {
    if (!finished || quizCount === 0) return;
    recordSession('anatomy', { correct: correctCount, total: quizCount, avgMs: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ровно один раз
  }, [finished]);

  const advance = useCallback(() => {
    setPhase('asking');
    setChosen(null);
    if (index + 1 >= steps.length) setFinished(true);
    else setIndex(index + 1);
  }, [index, steps.length]);

  const answer = useCallback(
    (chosenId: string) => {
      if (!step?.question || phase !== 'asking') return;
      const isCorrect = chosenId === step.structureId;
      const result = submit({
        structureId: step.structureId,
        skill: step.question.skill,
        mode: step.question.mode,
        chosenId,
        isCorrect,
        responseTimeMs: Date.now() - startedAt.current,
      });

      setChosen(chosenId);
      setPhase(isCorrect ? 'right' : 'wrong');
      setQuizCount((n) => n + 1);
      setXp((value) => value + result.xpGained);
      if (isCorrect) setCorrectCount((n) => n + 1);
      else setMisses((list) => [...list, { structureId: step.structureId, chosenId }]);
      // Автоперехода нет: разбор закрывает сам ребёнок.
    },
    [phase, step, submit],
  );

  // Пробел и Enter листают дальше, когда разбор прочитан.
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

  if (finished) {
    return (
      <Results
        total={quizCount}
        correct={correctCount}
        xp={xp}
        misses={misses}
        onAgain={() => {
          setSteps(makeSteps(regions, mistakesOnly));
          setIndex(0);
          setPhase('asking');
          setChosen(null);
          setCorrectCount(0);
          setQuizCount(0);
          setXp(0);
          setMisses([]);
          setFinished(false);
        }}
        onHome={() => router.push('/anatomy')}
      />
    );
  }

  if (!step || !structure) {
    return (
      <div className="min-h-dvh">
        <Hud />
        <div className="grid place-items-center gap-4 py-32 text-center text-slate-500">
          <p>Пока нечего повторять.</p>
          <Link href="/anatomy" className="btn-primary px-6 py-3 text-sm">
            К анатомии
          </Link>
        </div>
      </div>
    );
  }

  const progressPercent = ((index + (phase === 'asking' ? 0 : 1)) / steps.length) * 100;
  // Рисунками показываем варианты только если они есть у всех: иначе один
  // непохожий на остальные вариант сам по себе выдавал бы ответ.
  const photoOptions = step.kind === 'quiz' && allHaveImages(step.question?.options ?? []);

  return (
    <div className="min-h-dvh">
      <Hud />

      <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:px-6">
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
            <span className="font-bold">
              {step.kind === 'learn' ? 'Знакомимся' : MODE_LABELS[step.question!.mode]}
            </span>
            <span className="flex items-center gap-2">
              {step.kind === 'quiz' && (
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-extrabold"
                  style={{
                    background: `${SKILL_META[step.question!.skill].color}22`,
                    color: SKILL_META[step.question!.skill].color,
                  }}
                >
                  {SKILL_META[step.question!.skill].short}
                </span>
              )}
              {index + 1} / {steps.length}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-ink-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-400 to-amber-400 transition-[width] duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Экран изучения: крупная иллюстрация и название, минимум текста. */}
        {step.kind === 'learn' && (
          <div className="panel p-6 text-center">
            {structureImage(structure.id) ? (
              // Рисунок из учебника показывает, как структура выглядит,
              // схема рядом — где она находится. Это разные вопросы.
              <div className="flex items-end justify-center gap-4">
                <StructureImage
                  structureId={structure.id}
                  alt={structure.nameRu}
                  priority
                  className="h-64 w-40 shrink-0 sm:w-48"
                  sizes="(max-width: 640px) 40vw, 200px"
                />
                <div className="shrink-0">
                  <AnatomyFigure
                    region={structure.region}
                    highlight={structure.id}
                    className="h-48"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">где находится</p>
                </div>
              </div>
            ) : (
              <AnatomyFigure
                region={structure.region}
                highlight={structure.id}
                priority
                className="mx-auto h-64"
              />
            )}
            <h2 className="mt-4 text-3xl font-extrabold">{structure.nameRu}</h2>
            <p className="mt-2 text-sm text-slate-500">{structure.factRu}</p>
            <button
              onClick={() => {
                markSeen(structure.id);
                advance();
              }}
              autoFocus
              className="btn-primary mt-6 px-10 py-3"
            >
              Продолжить
            </button>
          </div>
        )}

        {step.kind === 'quiz' && step.question && (
          <div className="panel p-5">
            {/* «Что это?» — показываем структуру, ребёнок выбирает название. */}
            {step.question.mode === 'what-is-this' && (
              <>
                {structureImage(structure.id) ? (
                  <StructureImage
                    structureId={structure.id}
                    alt=""
                    priority
                    className="mx-auto h-56 w-full max-w-xs"
                  />
                ) : (
                  <AnatomyFigure
                    region={step.question.region}
                    highlight={structure.id}
                    priority
                    className="mx-auto h-56"
                  />
                )}
                <h1 className="mt-4 text-center text-xl font-extrabold">Что это?</h1>
              </>
            )}

            {/* «Найди изображение» — показываем название, ребёнок выбирает схему. */}
            {step.question.mode === 'find-image' && (
              <h1 className="text-center text-2xl font-extrabold">{structure.nameRu}</h1>
            )}

            {/* «Покажи на теле» — ребёнок кликает прямо по схеме. */}
            {step.question.mode === 'find-on-body' && (
              <>
                <h1 className="text-center text-xl font-extrabold">
                  Покажи: {structure.nameRu}
                </h1>
                <p className="mt-1 text-center text-xs text-slate-500">
                  Нажмите на нужное место на изображении
                </p>
                <AnatomyFigure
                  region={step.question.region}
                  highlight={phase === 'asking' ? null : structure.id}
                  wrong={phase === 'wrong' ? chosen : null}
                  onPick={phase === 'asking' ? answer : undefined}
                  priority
                  className="mx-auto mt-3 h-80"
                />
              </>
            )}

            {/* Варианты для двух режимов с выбором. */}
            {step.question.mode !== 'find-on-body' && (
              <div
                className={`mt-4 grid gap-3 ${
                  step.question.mode === 'find-image' ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'
                }`}
              >
                {step.question.options.map((id) => {
                  const option = getStructure(id);
                  if (!option) return null;
                  const revealed = phase !== 'asking';
                  const isAnswer = id === structure.id;
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
                      onClick={() => answer(id)}
                      disabled={revealed}
                      className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-3 text-center transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${tone}`}
                    >
                      {step.question!.mode !== 'find-image' ? (
                        <span className="text-base font-bold">{option.nameRu}</span>
                      ) : photoOptions ? (
                        <StructureImage
                          structureId={option.id}
                          alt=""
                          className="h-24 w-full"
                          sizes="(max-width: 640px) 40vw, 180px"
                        />
                      ) : (
                        <AnatomyFigure
                          region={option.region}
                          highlight={option.id}
                          className="h-24"
                          sizes="120px"
                        />
                      )}
                      {revealed && isAnswer && <span className="text-emerald-600">✓</span>}
                      {revealed && isChosen && !isAnswer && (
                        <span className="text-rose-600">✗</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Разбор: ошибка не наказывается, переход только по кнопке. */}
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
                    className={`text-lg font-extrabold ${
                      phase === 'right' ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {phase === 'right' ? '✓ Правильно' : '✗ Не то'}
                  </p>
                  <p className="mt-1 text-xl font-extrabold">{structure.nameRu}</p>
                  <p className="text-sm text-slate-500">{structure.factRu}</p>
                  {phase === 'wrong' && chosen && (
                    <p className="mt-1 text-xs text-slate-500">
                      Вы выбрали: {getStructure(chosen)?.nameRu}
                    </p>
                  )}
                  <button onClick={advance} autoFocus className="btn-primary mt-4 px-10 py-3">
                    Дальше →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 text-center">
          <Link href="/anatomy" className="text-sm text-slate-500 hover:underline">
            Выйти
          </Link>
        </div>

        <ImageCredit className="mt-6" />
      </main>
    </div>
  );
}

function Results({
  total,
  correct,
  xp,
  misses,
  onAgain,
  onHome,
}: {
  total: number;
  correct: number;
  xp: number;
  misses: Miss[];
  onAgain: () => void;
  onHome: () => void;
}) {
  const accuracy = total === 0 ? 0 : Math.round((correct / total) * 100);

  return (
    <div className="min-h-dvh">
      <Hud />
      <main className="mx-auto w-full max-w-lg px-4 pb-16 pt-10 sm:px-6">
        <div className="panel animate-pop p-7 text-center">
          <p className="mt-1 text-4xl font-extrabold">
            {correct} / {total}
          </p>
          <p className="text-sm text-slate-500">{accuracy}% правильных</p>

          <div className="mt-5 flex justify-center gap-2 text-sm font-extrabold">
            <span className="rounded-full bg-amber-400/15 px-4 py-1.5 text-amber-700">
              +{xp} XP
            </span>
          </div>

          {misses.length > 0 && (
            <div className="mt-6 text-left">
              <p className="panel-title mb-2">Что повторить</p>
              <ul className="space-y-2">
                {misses.map((miss, i) => {
                  const target = getStructure(miss.structureId);
                  const picked = getStructure(miss.chosenId);
                  if (!target) return null;
                  return (
                    <li
                      key={`${miss.structureId}-${i}`}
                      className="flex items-center gap-3 rounded-xl border border-line bg-ink-900 p-3"
                    >
                      {structureImage(target.id) ? (
                        <StructureImage
                          structureId={target.id}
                          alt=""
                          className="h-12 w-12 shrink-0"
                          sizes="48px"
                        />
                      ) : (
                        <AnatomyFigure
                          region={target.region}
                          highlight={target.id}
                          className="h-12 shrink-0"
                          sizes="48px"
                        />
                      )}
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="font-extrabold">{target.nameRu}</p>
                        {picked && (
                          <p className="text-xs text-slate-500">вы выбрали: {picked.nameRu}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="mt-7 flex flex-wrap gap-2">
            <button onClick={onAgain} className="btn-primary flex-1 px-5 py-3 text-sm">
              Ещё сессия
            </button>
            <button onClick={onHome} className="btn-ghost px-5 py-3 text-sm">
              К анатомии
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
