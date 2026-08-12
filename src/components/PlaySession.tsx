'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CONTINENT_BY_ID, COUNTRIES, WITHOUT_POLYGON, countriesOf, getCountry } from '@/lib/countries';
import { type ModeConfig, MODE_BY_SLUG, SKILL_PROMPTS } from '@/lib/modes';
import { type ProfileData, emptyProfileData } from '@/lib/progress';
import {
  type Question,
  buildConfusionDrill,
  buildCountryTraining,
  buildPersonalSession,
} from '@/lib/quiz';
import { SKILL_META } from '@/lib/skills';
import { syncNow } from '@/lib/competitive/api';
import { type Achievement, useActiveProfile, useGame, useHydrated } from '@/lib/store';
import type { ContinentId, Country, CountrySkill } from '@/lib/types';
import Donut from './Donut';
import FlagImage from './FlagImage';
import GlobeView from './GlobeView';
import Hud from './Hud';
import { MiniMap, OutlineShape } from './OutlineShape';
import SpeakButton from './SpeakButton';

const SESSION_LENGTH = 10;
/** Пауза перед следующим вопросом после верного ответа. */
const ADVANCE_DELAY = 1100;

type Phase = 'asking' | 'right' | 'wrong';

interface Miss {
  countryCode: string;
  chosenCode: string;
  skill: CountrySkill;
}

const SKILLS_SET = new Set<CountrySkill>([
  'flagToCountry',
  'countryToFlag',
  'countryToCapital',
  'capitalToCountry',
  'countryLocation',
  'outlineToCountry',
]);

/**
 * Внешняя оболочка: ждёт, пока поднимется сохранённый прогресс, и только потом
 * монтирует саму игру — сессия собирается один раз, на клиенте.
 */
export default function PlaySession({ slug }: { slug: string }) {
  const config = MODE_BY_SLUG.get(slug);
  const searchParams = useSearchParams();
  const hydrated = useHydrated();
  const profileId = useGame((s) => s.activeProfileId);

  const continent = searchParams.get('continent') as ContinentId | null;
  /** `?pair=RO,TD` — сравнительная тренировка по двум путаемым странам. */
  const pair = searchParams.get('pair');
  /** `?country=KZ&skill=outlineToCountry` — персональная тренировка страны. */
  const trainCountry = searchParams.get('country');
  const rawSkill = searchParams.get('skill');
  const trainSkill = rawSkill && SKILLS_SET.has(rawSkill as CountrySkill)
    ? (rawSkill as CountrySkill)
    : null;

  if (!config) return null;

  if (!hydrated) {
    return (
      <div className="min-h-dvh">
        <Hud />
        <div className="grid place-items-center py-32 text-slate-400">Собираем миссию…</div>
      </div>
    );
  }

  return (
    <RunningSession
      key={`${profileId}:${slug}:${continent ?? ''}:${pair ?? ''}:${trainCountry ?? ''}:${trainSkill ?? ''}`}
      config={config}
      continent={continent}
      pair={pair}
      trainCountry={trainCountry}
      trainSkill={trainSkill}
    />
  );
}

interface SessionParams {
  config: ModeConfig;
  continent: ContinentId | null;
  pair: string | null;
  trainCountry: string | null;
  trainSkill: CountrySkill | null;
}

function makeQuestions(
  { config, pair, trainCountry, trainSkill }: SessionParams,
  pool: Country[],
  data: ProfileData,
  ageMode: 'kid' | 'school' | 'adult',
): Question[] {
  if (trainCountry) {
    return buildCountryTraining(trainCountry, data, config.skills, trainSkill ?? undefined);
  }
  if (pair) {
    const [a, b] = pair.split(',');
    // Три круга по паре: каждая страна встречается несколько раз подряд.
    const skill = trainSkill ?? config.skills[0];
    return [
      ...buildConfusionDrill(a, b, skill),
      ...buildConfusionDrill(a, b, skill),
      ...buildConfusionDrill(a, b, skill),
    ];
  }
  return buildPersonalSession({
    data,
    pool,
    skills: config.skills,
    length: Math.min(SESSION_LENGTH, pool.length),
    ageMode,
  });
}

function RunningSession(params: SessionParams) {
  const { config, continent, pair, trainCountry } = params;
  const router = useRouter();
  const answer = useGame((s) => s.answer);
  const profile = useActiveProfile();

  const pool = useMemo(() => {
    const base = continent ? countriesOf(continent) : COUNTRIES;
    // Контурный режим доступен только странам с полигоном в Natural Earth.
    return config.skills.length === 1 && config.skills[0] === 'outlineToCountry'
      ? base.filter((c) => !WITHOUT_POLYGON.has(c.code))
      : base;
  }, [config.skills, continent]);

  const [questions, setQuestions] = useState<Question[]>(() => {
    const state = useGame.getState();
    const data = state.data[state.activeProfileId] ?? emptyProfileData();
    return makeQuestions(params, pool, data, profile.ageMode);
  });
  // Тренировка страны начинается с интро-экрана со списком навыков.
  const [started, setStarted] = useState(!trainCountry);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('asking');
  const [chosen, setChosen] = useState<string | null>(null);
  const [hintShown, setHintShown] = useState(false);
  const [misses, setMisses] = useState<Miss[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [xpGained, setXpGained] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [, setStreak] = useState(0);
  const [earned, setEarned] = useState<Achievement[]>([]);
  const [finished, setFinished] = useState(false);

  const startedAt = useRef(0);
  const sumMs = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Итог сессии: локальный рекорд режима + отправка прогресса на сервер.
  useEffect(() => {
    if (!finished) return;
    const answered = Math.max(1, correctCount + misses.length);
    useGame.getState().recordSession(config.slug, {
      correct: correctCount,
      total: questions.length,
      avgMs: Math.round(sumMs.current / answered),
    });
    void syncNow().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- только по завершении
  }, [finished]);

  // Отсчёт времени ответа начинается заново на каждом вопросе.
  useEffect(() => {
    startedAt.current = Date.now();
  }, [index, questions, started]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const current = questions[index] ?? null;
  const isKid = profile.ageMode === 'kid';

  const advance = useCallback(() => {
    if (index + 1 >= questions.length) {
      setFinished(true);
      return;
    }
    setIndex(index + 1);
    setPhase('asking');
    setChosen(null);
    setHintShown(false);
  }, [index, questions.length]);

  const submit = useCallback(
    (chosenCode: string) => {
      if (!current || phase !== 'asking') return;
      sumMs.current += Date.now() - startedAt.current;
      const correct = chosenCode === current.countryCode;
      const result = answer({
        correct,
        countryCode: current.countryCode,
        skill: current.skill,
        chosenCode: correct ? undefined : chosenCode,
        elapsedMs: Date.now() - startedAt.current,
        hintUsed: hintShown,
      });

      setChosen(chosenCode);
      setPhase(correct ? 'right' : 'wrong');
      setXpGained((x) => x + result.xpGained);
      setEarned((list) => [...list, ...result.unlocked]);

      if (correct) {
        setCorrectCount((c) => c + 1);
        setStreak((s) => {
          setBestStreak((b) => Math.max(b, s + 1));
          return s + 1;
        });
        timer.current = setTimeout(advance, ADVANCE_DELAY);
      } else {
        setStreak(0);
        setMisses((list) => [
          ...list,
          { countryCode: current.countryCode, chosenCode, skill: current.skill },
        ]);
      }
    },
    [advance, answer, current, hintShown, phase],
  );

  // Цифры 1–4 отвечают на вопрос, пробел листает дальше после ошибки.
  useEffect(() => {
    if (!started) return;
    const onKey = (event: KeyboardEvent) => {
      if (!current) return;
      if (phase === 'wrong' && (event.key === ' ' || event.key === 'Enter')) {
        event.preventDefault();
        advance();
        return;
      }
      const digit = Number(event.key);
      if (phase === 'asking' && digit >= 1 && digit <= current.options.length) {
        submit(current.options[digit - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, current, phase, started, submit]);

  const restart = () => {
    if (timer.current) clearTimeout(timer.current);
    const state = useGame.getState();
    const data = state.data[state.activeProfileId] ?? emptyProfileData();
    setQuestions(makeQuestions(params, pool, data, profile.ageMode));
    setIndex(0);
    setPhase('asking');
    setChosen(null);
    setHintShown(false);
    setMisses([]);
    setCorrectCount(0);
    setXpGained(0);
    setStreak(0);
    setBestStreak(0);
    setEarned([]);
    setFinished(false);
  };

  if (!started && trainCountry) {
    return (
      <TrainIntro
        countryCode={trainCountry}
        questions={questions}
        onStart={() => setStarted(true)}
      />
    );
  }

  if (finished) {
    return (
      <Results
        total={questions.length}
        correct={correctCount}
        xp={xpGained}
        bestStreak={bestStreak}
        misses={misses}
        earned={earned}
        onRetry={restart}
        onHome={() => router.push('/')}
      />
    );
  }

  const country = current ? getCountry(current.countryCode) : null;
  if (!current || !country) {
    return (
      <div className="min-h-dvh">
        <Hud />
        <div className="grid place-items-center py-32 text-slate-400">
          Для этого режима пока нет заданий.
        </div>
        <div className="text-center">
          <Link href="/" className="text-sm text-slate-400 underline-offset-4 hover:underline">
            На главную
          </Link>
        </div>
      </div>
    );
  }

  const continentName = continent ? CONTINENT_BY_ID.get(continent)?.name : null;
  const trainName = trainCountry ? getCountry(trainCountry)?.name : null;
  const pairLabel = pair
    ? pair.split(',').map((code) => getCountry(code)?.name ?? code).join(' / ')
    : null;
  const skill = current.skill;
  const isGlobe = skill === 'countryLocation';

  return (
    <div className="min-h-dvh">
      <Hud />

      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6">
        {/* Шапка сессии: режим, счёт, таймер, прогресс */}
        <div className="panel mb-4 p-4">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-bold text-slate-400">
              {config.emoji} {config.title}
              {continentName ? ` · ${continentName}` : ''}
              {trainName ? ` · ${trainName}` : ''}
              {pairLabel ? ` · ${pairLabel}` : ''}
            </span>
            <span className="flex items-center gap-3 text-slate-400">
              <span className="font-bold">
                Вопрос {index + 1} из {questions.length}
              </span>
              <SessionTimer resetKey={`${index}`} />
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-950">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500 transition-[width] duration-300"
              style={{
                width: `${((index + (phase === 'asking' ? 0 : 1)) / questions.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {isGlobe ? (
          <GlobeQuestion
            question={current}
            phase={phase}
            chosen={chosen}
            onSelect={submit}
            onNext={advance}
          />
        ) : (
          <div className="panel p-5">
            <h1 className="mb-5 text-center text-xl font-extrabold sm:text-2xl">
              {SKILL_PROMPTS[skill]}
            </h1>

            <div className="grid gap-5 md:grid-cols-2">
              {/* Стимул слева */}
              <div className="grid place-items-center rounded-xl border border-line bg-ink-900 p-5">
                <Stimulus question={current} country={country} isKid={isKid} />
              </div>

              {/* Варианты справа */}
              <div
                className={`flex flex-col justify-center gap-2.5 ${phase === 'wrong' ? 'animate-shake' : ''}`}
              >
                {current.options.map((code, i) => (
                  <OptionButton
                    key={code}
                    index={i}
                    code={code}
                    skill={skill}
                    phase={phase}
                    chosen={chosen}
                    answerCode={current.countryCode}
                    onClick={() => submit(code)}
                  />
                ))}

                {current.hint && phase === 'asking' && (
                  hintShown ? (
                    <p className="animate-pop rounded-lg bg-amber-400/10 px-3 py-2 text-center text-sm font-bold text-amber-300">
                      💡 {current.hint}
                    </p>
                  ) : (
                    <button
                      onClick={() => setHintShown(true)}
                      className="btn-ghost px-3 py-2 text-sm text-slate-400"
                    >
                      💡 Подсказка
                    </button>
                  )
                )}
              </div>
            </div>

            <Feedback
              phase={phase}
              skill={skill}
              answerCode={current.countryCode}
              chosen={chosen}
              onNext={advance}
            />

            <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-slate-500">
              {current.options.map((_, i) => (
                <span key={i} className="grid h-6 w-6 place-items-center rounded-md border border-line">
                  {i + 1}
                </span>
              ))}
              <span className="ml-2">выбор ответа</span>
            </div>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-slate-400 underline-offset-4 hover:underline">
            Выйти из миссии
          </Link>
        </div>
      </main>
    </div>
  );
}

/** Таймер текущего вопроса (mm:ss), сбрасывается на каждом вопросе. */
function SessionTimer({ resetKey }: { resetKey: string }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    setSecondsSafe(setSeconds, 0);
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [resetKey]);
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return (
    <span className="tabular-nums" aria-label="Время на вопрос">
      {mm}:{ss}
    </span>
  );
}

/** Обёртка, чтобы сброс таймера в эффекте не считался каскадным setState. */
function setSecondsSafe(set: (v: number) => void, value: number) {
  set(value);
}

function Stimulus({
  question,
  country,
  isKid,
}: {
  question: Question;
  country: Country;
  isKid: boolean;
}) {
  switch (question.skill) {
    case 'flagToCountry':
      return <FlagImage code={question.countryCode} size={isKid ? 180 : 150} alt="Флаг страны" priority />;
    case 'outlineToCountry':
      return <OutlineShape code={question.countryCode} className="h-52 w-52 sm:h-60 sm:w-60" />;
    case 'capitalToCountry':
      return (
        <div className="text-center">
          <p className="panel-title mb-1">Столица</p>
          <p className="flex items-center gap-2 text-3xl font-extrabold">
            {country.capital}
            <SpeakButton text={country.capital} />
          </p>
        </div>
      );
    default:
      return (
        <div className="text-center">
          <p className="mb-2 flex items-center justify-center gap-2 text-3xl font-extrabold">
            {country.name}
            <SpeakButton text={country.name} />
          </p>
          {question.skill === 'countryToCapital' && (
            <FlagImage code={question.countryCode} size={60} className="mx-auto" />
          )}
        </div>
      );
  }
}

function OptionButton({
  index,
  code,
  skill,
  phase,
  chosen,
  answerCode,
  onClick,
}: {
  index: number;
  code: string;
  skill: CountrySkill;
  phase: Phase;
  chosen: string | null;
  answerCode: string;
  onClick: () => void;
}) {
  const country = getCountry(code);
  if (!country) return null;

  const revealed = phase !== 'asking';
  const isAnswer = code === answerCode;
  const isChosen = code === chosen;

  const tone = !revealed
    ? 'border-line bg-ink-700/60 hover:border-accent/60 hover:bg-ink-700'
    : isAnswer
      ? 'border-emerald-400 bg-emerald-500/15'
      : isChosen
        ? 'border-rose-400 bg-rose-500/15'
        : 'border-line bg-ink-800 opacity-50';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={revealed}
      className={`flex items-center gap-3 rounded-xl border p-3 text-left font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${tone}`}
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/5 text-sm">
        {index + 1}
      </span>
      {skill === 'countryToFlag' ? (
        <FlagImage code={code} size={44} alt="Вариант флага" />
      ) : skill === 'countryToCapital' ? (
        <span>{country.capital}</span>
      ) : (
        <span>{country.name}</span>
      )}
      {revealed && isAnswer && <span className="ml-auto text-emerald-300">✓</span>}
      {revealed && isChosen && !isAnswer && <span className="ml-auto text-rose-300">✗</span>}
    </button>
  );
}

function GlobeQuestion({
  question,
  phase,
  chosen,
  onSelect,
  onNext,
}: {
  question: Question;
  phase: Phase;
  chosen: string | null;
  onSelect: (code: string) => void;
  onNext: () => void;
}) {
  const country = getCountry(question.countryCode);
  const revealed = phase !== 'asking';

  const colorFor = useMemo(
    () => (code: string) => {
      if (!revealed) return null;
      if (code === question.countryCode) return '#22c55e';
      if (code === chosen) return '#f43f5e';
      return null;
    },
    [chosen, question.countryCode, revealed],
  );

  const raised = useMemo(
    () => new Set(revealed ? [question.countryCode] : []),
    [question.countryCode, revealed],
  );

  const focus = useMemo(
    () => (revealed && country ? { lat: country.lat, lng: country.lng, altitude: 1.7 } : null),
    [country, revealed],
  );

  const noop = useCallback(() => {}, []);
  const hideLabels = useCallback(() => null, []);

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-center gap-2 border-b border-line bg-ink-900 p-4 text-2xl font-extrabold">
        {country?.name}
        {country && <SpeakButton text={country.name} />}
      </div>
      <div className="relative h-[52vh] min-h-[360px]">
        <GlobeView
          colorFor={colorFor}
          raised={raised}
          focus={focus}
          onSelect={revealed ? noop : onSelect}
          /* Подписи спрятаны: иначе задание решается наведением мыши. */
          labelFor={hideLabels}
        />
      </div>
      {phase === 'wrong' && (
        <div className="border-t border-line p-4 text-center">
          <p className="font-extrabold text-rose-300">
            ❌ Это {chosen ? getCountry(chosen)?.name : 'другая страна'}. Правильный ответ подсвечен.
          </p>
          <button onClick={onNext} className="btn-primary mt-3 px-8 py-2.5">
            Далее →
          </button>
        </div>
      )}
    </div>
  );
}

function Feedback({
  phase,
  skill,
  answerCode,
  chosen,
  onNext,
}: {
  phase: Phase;
  skill: CountrySkill;
  answerCode: string;
  chosen: string | null;
  onNext: () => void;
}) {
  if (phase === 'asking') return null;

  const answer = getCountry(answerCode);
  const wrong = chosen ? getCountry(chosen) : null;
  const isOutline = skill === 'outlineToCountry';

  if (phase === 'right') {
    return (
      <div className="animate-pop mt-5 rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3 text-center font-extrabold text-emerald-300">
        ✅ Верно — {answer?.name}
      </div>
    );
  }

  return (
    <div className="animate-pop mt-5 rounded-xl border border-line bg-ink-900 p-4">
      <div className="flex flex-wrap items-center justify-center gap-5">
        <div className="flex items-center gap-3">
          <FlagImage code={answerCode} size={52} />
          <div className="text-sm">
            <p className="text-base font-extrabold">Это {answer?.name}</p>
            <p className="text-slate-400">Столица: {answer?.capital}</p>
            <p className="text-slate-400">
              Континент: {answer && CONTINENT_BY_ID.get(answer.continent)?.name}
            </p>
          </div>
        </div>
        {isOutline && <MiniMap code={answerCode} className="h-24 w-48" />}
        {wrong && (
          <div className="flex items-center gap-2 opacity-70">
            <FlagImage code={wrong.code} size={36} />
            <p className="text-sm text-slate-400">
              Ты выбрал: <span className="font-bold text-slate-400">{wrong.name}</span>
            </p>
          </div>
        )}
      </div>
      <div className="mt-4 text-center">
        <button onClick={onNext} className="btn-primary px-8 py-2.5">
          Далее →
        </button>
      </div>
    </div>
  );
}

/** Интро тренировки страны: какие навыки и какие «двойники» будут в сессии. */
function TrainIntro({
  countryCode,
  questions,
  onStart,
}: {
  countryCode: string;
  questions: Question[];
  onStart: () => void;
}) {
  const country = getCountry(countryCode);
  const skills = [...new Set(questions.filter((q) => q.countryCode === countryCode).map((q) => q.skill))];
  const rivals = [...new Set(questions.map((q) => q.countryCode))].filter((c) => c !== countryCode);

  return (
    <div className="min-h-dvh">
      <Hud />
      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <div className="panel animate-pop p-6">
          <div className="flex items-center gap-3">
            {country && <FlagImage code={country.code} size={44} />}
            <div>
              <p className="panel-title">Тренировка страны</p>
              <h1 className="text-2xl font-extrabold">{country?.name}</h1>
            </div>
          </div>

          <p className="panel-title mb-3 mt-6">Навыки в этой сессии</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {skills.map((skill) => (
              <div
                key={skill}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-ink-700/50 p-3 text-center"
              >
                <span
                  aria-hidden
                  className="grid h-9 w-9 place-items-center rounded-lg text-lg"
                  style={{ background: `${SKILL_META[skill].color}26` }}
                >
                  {SKILL_META[skill].emoji}
                </span>
                <span className="text-xs font-bold">{SKILL_META[skill].short}</span>
              </div>
            ))}
          </div>

          {rivals.length > 0 && (
            <>
              <p className="panel-title mb-3 mt-6">Вы также будете тренировать</p>
              <div className="flex flex-wrap gap-3">
                {rivals.map((code) => (
                  <div key={code} className="flex items-center gap-2 rounded-xl border border-line bg-ink-700/50 px-3 py-2">
                    <FlagImage code={code} size={26} />
                    <span className="text-sm font-bold">{getCountry(code)?.name}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="mt-7 flex gap-2">
            <button onClick={onStart} className="btn-primary flex-1 px-6 py-3">
              Начать тренировку
            </button>
            <Link href="/" className="btn-ghost px-6 py-3 text-sm">
              Назад
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function Results({
  total,
  correct,
  xp,
  bestStreak,
  misses,
  earned,
  onRetry,
  onHome,
}: {
  total: number;
  correct: number;
  xp: number;
  bestStreak: number;
  misses: Miss[];
  earned: Achievement[];
  onRetry: () => void;
  onHome: () => void;
}) {
  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
  const title = percent === 100 ? 'Идеально!' : percent >= 70 ? 'Отлично!' : 'Продолжаем путь!';
  const uniqueEarned = earned.filter((a, i) => earned.findIndex((x) => x.id === a.id) === i);
  const coins = correct * 2;

  return (
    <div className="min-h-dvh">
      <Hud />
      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <div className="panel animate-pop p-7">
          <h1 className="text-center text-2xl font-extrabold">{title}</h1>
          <p className="mt-1 text-center text-sm text-slate-400">Вы закончили сессию</p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-8">
            <Donut percent={percent} size={130} stroke={11} color={percent >= 70 ? '#22c55e' : '#f59e0b'}>
              <div>
                <div className="text-2xl font-extrabold">
                  {correct}/{total}
                </div>
                <div className="text-sm font-bold text-slate-400">{percent}%</div>
              </div>
            </Donut>

            <dl className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-10">
                <dt className="text-slate-400">⭐ XP заработано</dt>
                <dd className="font-extrabold text-emerald-300">+{xp}</dd>
              </div>
              <div className="flex items-center justify-between gap-10">
                <dt className="text-slate-400">🪙 Монеты</dt>
                <dd className="font-extrabold text-amber-300">+{coins}</dd>
              </div>
              <div className="flex items-center justify-between gap-10">
                <dt className="text-slate-400">🔥 Лучшая серия</dt>
                <dd className="font-extrabold">{bestStreak}</dd>
              </div>
            </dl>
          </div>

          {uniqueEarned.length > 0 && (
            <div className="mt-6 text-center">
              <p className="panel-title mb-2">Новые достижения</p>
              <div className="flex flex-wrap justify-center gap-2">
                {uniqueEarned.map((a) => (
                  <span
                    key={a.id}
                    className="rounded-full border border-amber-300/40 bg-amber-400/10 px-4 py-1.5 text-sm font-bold text-amber-200"
                  >
                    {a.emoji} {a.title}
                  </span>
                ))}
              </div>
            </div>
          )}

          {misses.length > 0 && (
            <div className="mt-6">
              <p className="panel-title mb-2">Вернём в следующих заданиях</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {misses.map((miss, i) => (
                  <Link
                    key={`${miss.countryCode}-${i}`}
                    href={`/play/train?country=${miss.countryCode}&skill=${miss.skill}`}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-ink-700/50 p-3 text-center transition hover:border-accent/50"
                  >
                    <FlagImage code={miss.countryCode} size={30} />
                    <span className="text-xs font-extrabold">
                      {getCountry(miss.countryCode)?.name}
                    </span>
                    <span className="text-[10px] text-slate-400">{SKILL_META[miss.skill].short}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="mt-7 flex gap-2">
            <button onClick={onHome} className="btn-ghost flex-1 px-6 py-3 text-sm">
              Главная
            </button>
            <button onClick={onRetry} className="btn-primary flex-1 px-6 py-3">
              Ещё раз
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
