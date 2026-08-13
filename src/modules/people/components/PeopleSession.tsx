'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import Hud from '@/components/Hud';
import { useGame, useHydrated } from '@/lib/store';
import { CATEGORY_ORDER, MODE_LABELS, SESSION_LENGTH, SKILL_META } from '../config.ts';
import { normalizePeopleProgress } from '../progress.ts';
import { getPerson } from '../people.ts';
import { buildPeopleSession, type PeopleStep } from '../session.ts';
import type { PersonCategory } from '../types.ts';
import PersonPhoto from './PersonPhoto.tsx';

type Phase = 'asking' | 'right' | 'wrong';

interface Miss {
  personId: string;
  chosen: string;
}

function parseCategories(raw: string | null): PersonCategory[] {
  if (!raw) return [];
  return raw.split(',').filter((id): id is PersonCategory =>
    CATEGORY_ORDER.includes(id as PersonCategory),
  );
}

export default function PeopleSession() {
  const hydrated = useHydrated();
  const searchParams = useSearchParams();
  const profileId = useGame((s) => s.activeProfileId);

  const categories = parseCategories(searchParams.get('category'));
  const mistakesOnly = searchParams.get('mode') === 'mistakes';

  if (!hydrated) {
    return (
      <div className="min-h-dvh">
        <Hud />
        <div className="grid place-items-center py-32 text-slate-400">Загружаем…</div>
      </div>
    );
  }

  return (
    <RunningSession
      key={`${profileId}:${categories.join('-')}:${mistakesOnly}`}
      categories={categories}
      mistakesOnly={mistakesOnly}
    />
  );
}

function makeSteps(categories: PersonCategory[], mistakesOnly: boolean): PeopleStep[] {
  const state = useGame.getState();
  const progress = normalizePeopleProgress(state.data[state.activeProfileId]?.people);
  return buildPeopleSession({ progress, categories, length: SESSION_LENGTH, mistakesOnly });
}

function RunningSession({
  categories,
  mistakesOnly,
}: {
  categories: PersonCategory[];
  mistakesOnly: boolean;
}) {
  const router = useRouter();
  const submit = useGame((s) => s.submitPeopleAnswer);
  const markSeen = useGame((s) => s.markPersonSeen);
  const recordSession = useGame((s) => s.recordSession);

  const [steps, setSteps] = useState<PeopleStep[]>(() => makeSteps(categories, mistakesOnly));
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('asking');
  const [chosen, setChosen] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [quizCount, setQuizCount] = useState(0);
  const [newFaces, setNewFaces] = useState(0);
  const [xp, setXp] = useState(0);
  const [misses, setMisses] = useState<Miss[]>([]);
  const [finished, setFinished] = useState(false);

  const startedAt = useRef(0);
  const step = steps[index] ?? null;
  const person = step ? getPerson(step.personId) : null;

  useEffect(() => {
    startedAt.current = Date.now();
  }, [index]);

  useEffect(() => {
    if (!finished || quizCount === 0) return;
    recordSession('people', { correct: correctCount, total: quizCount, avgMs: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ровно один раз
  }, [finished]);

  const advance = useCallback(() => {
    setPhase('asking');
    setChosen(null);
    if (index + 1 >= steps.length) setFinished(true);
    else setIndex(index + 1);
  }, [index, steps.length]);

  const answer = useCallback(
    (value: string) => {
      if (!step?.question || phase !== 'asking') return;
      const target = step.question.mode.endsWith('role')
        ? (getPerson(step.personId)?.role ?? '')
        : step.personId;
      const isCorrect = value === target;

      const result = submit({
        personId: step.personId,
        skill: step.question.skill,
        mode: step.question.mode,
        chosen: value,
        isCorrect,
        responseTimeMs: Date.now() - startedAt.current,
      });

      setChosen(value);
      setPhase(isCorrect ? 'right' : 'wrong');
      setQuizCount((n) => n + 1);
      setXp((value) => value + result.xpGained);
      if (isCorrect) setCorrectCount((n) => n + 1);
      else setMisses((list) => [...list, { personId: step.personId, chosen: value }]);
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
        newFaces={newFaces}
        xp={xp}
        misses={misses}
        onAgain={() => {
          setSteps(makeSteps(categories, mistakesOnly));
          setIndex(0);
          setPhase('asking');
          setChosen(null);
          setCorrectCount(0);
          setQuizCount(0);
          setNewFaces(0);
          setXp(0);
          setMisses([]);
          setFinished(false);
        }}
        onHome={() => router.push('/people')}
      />
    );
  }

  if (!step || !person) {
    return (
      <div className="min-h-dvh">
        <Hud />
        <div className="grid place-items-center gap-4 py-32 text-center text-slate-400">
          <p>Пока нечего повторять.</p>
          <Link href="/people" className="btn-primary px-6 py-3 text-sm">
            К людям
          </Link>
        </div>
      </div>
    );
  }

  const percent = ((index + (phase === 'asking' ? 0 : 1)) / steps.length) * 100;

  return (
    <div className="min-h-dvh">
      <Hud />

      <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:px-6">
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between text-sm text-slate-400">
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
              className="h-full rounded-full bg-gradient-to-r from-sky-400 to-violet-400 transition-[width] duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {step.kind === 'learn' ? (
          <LearnCard
            personId={step.personId}
            onNext={() => {
              markSeen(step.personId);
              setNewFaces((n) => n + 1);
              advance();
            }}
          />
        ) : (
          <QuizCard step={step} phase={phase} chosen={chosen} onAnswer={answer} onNext={advance} />
        )}
      </main>
    </div>
  );
}

/** Знакомство: большое фото, имя, роль и одна строка о человеке. */
function LearnCard({ personId, onNext }: { personId: string; onNext: () => void }) {
  const person = getPerson(personId);
  if (!person) return null;
  const years = [person.birthYear, person.deathYear].filter(Boolean).join(' — ');

  return (
    <section className="panel p-6 text-center">
      <PersonPhoto personId={person.id} className="mx-auto h-56 w-56" priority showKind />
      <h2 className="mt-4 text-2xl font-extrabold">{person.nameRu}</h2>
      <p className="mt-1 text-lg font-bold text-accent">{person.role}</p>
      {years && <p className="mt-1 text-sm text-slate-400">{years}</p>}
      {person.shortDescription && (
        <p className="mx-auto mt-3 max-w-sm text-sm text-slate-400">{person.shortDescription}</p>
      )}
      <button onClick={onNext} className="btn-primary mt-6 px-10 py-3">
        Далее
      </button>
    </section>
  );
}

function QuizCard({
  step,
  phase,
  chosen,
  onAnswer,
  onNext,
}: {
  step: PeopleStep;
  phase: Phase;
  chosen: string | null;
  onAnswer: (value: string) => void;
  onNext: () => void;
}) {
  const question = step.question!;
  const person = getPerson(step.personId)!;
  const asksRole = question.mode === 'photo-to-role' || question.mode === 'name-to-role';
  const showsPhoto = question.mode === 'photo-to-name' || question.mode === 'photo-to-role';
  const correctValue = asksRole ? person.role : person.id;

  const prompt = {
    'photo-to-name': 'Кто это?',
    'photo-to-role': 'Чем известен этот человек?',
    'name-to-photo': `Кто такой ${person.nameRu}?`,
    'name-to-role': `Кем является ${person.nameRu}?`,
  }[question.mode];

  return (
    <section className="panel p-5">
      {showsPhoto && (
        <PersonPhoto
          personId={person.id}
          className="mx-auto mb-4 h-56 w-56"
          priority
          showKind={phase !== 'asking'}
        />
      )}

      <h2 className="mb-4 text-center text-xl font-extrabold">{prompt}</h2>

      {question.mode === 'name-to-photo' ? (
        <div className="grid grid-cols-2 gap-3">
          {question.options.map((id) => {
            const isTarget = id === correctValue;
            const isChosen = id === chosen;
            return (
              <button
                key={id}
                onClick={() => onAnswer(id)}
                disabled={phase !== 'asking'}
                className={`overflow-hidden rounded-2xl border-2 transition ${
                  phase === 'asking'
                    ? 'border-line hover:border-accent'
                    : isTarget
                      ? 'border-emerald-500'
                      : isChosen
                        ? 'border-rose-500'
                        : 'border-line opacity-50'
                }`}
              >
                <PersonPhoto personId={id} className="h-32 w-full" sizes="160px" />
                {phase !== 'asking' && (
                  <span className="block px-2 py-1.5 text-xs font-bold">
                    {getPerson(id)?.nameRu}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-2">
          {question.options.map((value) => {
            const label = asksRole ? value : (getPerson(value)?.nameRu ?? value);
            const isTarget = value === correctValue;
            const isChosen = value === chosen;
            return (
              <button
                key={value}
                onClick={() => onAnswer(value)}
                disabled={phase !== 'asking'}
                className={`rounded-xl border-2 px-4 py-3 text-left font-bold transition ${
                  phase === 'asking'
                    ? 'border-line bg-ink-700/40 hover:border-accent'
                    : isTarget
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : isChosen
                        ? 'border-rose-500 bg-rose-500/10'
                        : 'border-line opacity-50'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {phase !== 'asking' && (
        <div className="mt-5 rounded-2xl border border-line bg-ink-700/40 p-4 text-center">
          <p className={`font-extrabold ${phase === 'right' ? 'text-emerald-500' : 'text-rose-500'}`}>
            {phase === 'right' ? 'Верно' : 'Пока нет'}
          </p>
          <p className="mt-1 text-lg font-extrabold">{person.nameRu}</p>
          <p className="text-sm font-bold text-accent">{person.role}</p>
          {person.shortDescription && (
            <p className="mt-2 text-sm text-slate-400">{person.shortDescription}</p>
          )}
          <button onClick={onNext} className="btn-primary mt-4 px-8 py-2.5 text-sm">
            Дальше
          </button>
        </div>
      )}
    </section>
  );
}

function Results({
  total,
  correct,
  newFaces,
  xp,
  misses,
  onAgain,
  onHome,
}: {
  total: number;
  correct: number;
  newFaces: number;
  xp: number;
  misses: Miss[];
  onAgain: () => void;
  onHome: () => void;
}) {
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <div className="min-h-dvh">
      <Hud />
      <main className="mx-auto w-full max-w-lg px-4 pb-16 pt-10 sm:px-6">
        <section className="panel p-6 text-center">
          <p className="panel-title">Известные люди</p>
          <p className="mt-3 text-5xl font-extrabold">
            {correct} / {total}
          </p>
          <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
            <Stat label="Точность" value={`${accuracy}%`} />
            <Stat label="Новых лиц" value={newFaces} />
            <Stat label="XP" value={`+${xp}`} />
          </div>
        </section>

        {misses.length > 0 && (
          <section className="panel mt-4 p-5">
            <p className="panel-title mb-3">Ошибки</p>
            <ul className="space-y-2">
              {misses.map((miss, position) => {
                const person = getPerson(miss.personId);
                return (
                  <li key={`${miss.personId}-${position}`} className="flex items-center gap-3">
                    <PersonPhoto personId={miss.personId} className="h-10 w-10" sizes="40px" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{person?.nameRu}</span>
                      <span className="block text-xs text-slate-400">{person?.role}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <Link
              href="/people/play?mode=mistakes"
              className="btn-ghost mt-4 block px-4 py-2.5 text-center text-sm"
            >
              Повторить ошибки
            </Link>
          </section>
        )}

        <div className="mt-5 flex gap-3">
          <button onClick={onAgain} className="btn-primary flex-1 px-6 py-3">
            Ещё раз
          </button>
          <button onClick={onHome} className="btn-ghost flex-1 px-6 py-3">
            К людям
          </button>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-line bg-ink-700/40 p-3">
      <p className="text-lg font-extrabold">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}
