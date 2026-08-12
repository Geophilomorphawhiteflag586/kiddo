import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COUNTRIES, WITHOUT_POLYGON, getCountry } from './countries.ts';
import { applyAnswer, emptyProfileData } from './progress.ts';
import {
  buildConfusionDrill,
  buildCountryTraining,
  buildOptions,
  buildOutlineOptions,
  buildPersonalSession,
} from './quiz.ts';
import type { AnswerOutcome, CountrySkill } from './types.ts';

const NOW = Date.UTC(2026, 0, 15, 12);
const SKILLS_ALL: CountrySkill[] = [
  'flagToCountry',
  'countryToFlag',
  'countryToCapital',
  'capitalToCountry',
  'countryLocation',
  'outlineToCountry',
];

function outcome(partial: Partial<AnswerOutcome>): AnswerOutcome {
  return { correct: true, countryCode: 'KZ', skill: 'flagToCountry', elapsedMs: 2000, ...partial };
}

test('варианты ответа: без дубликатов, с правильным ответом, нужного размера', () => {
  for (const target of ['KZ', 'FR', 'VU', 'SM']) {
    const country = getCountry(target)!;
    const options = buildOptions(country, COUNTRIES, 4);
    assert.equal(options.length, 4, target);
    assert.equal(new Set(options).size, 4, `дубликаты для ${target}`);
    assert.ok(options.includes(target));
  }
});

test('личная путаница попадает в варианты первой', () => {
  const country = getCountry('RO')!;
  const options = buildOptions(country, COUNTRIES, 4, { TD: 5 });
  assert.ok(options.includes('TD'), 'Чад должен быть среди вариантов для Румынии');
});

test('outline-варианты не содержат стран без контура', () => {
  for (const target of ['IT', 'RU', 'FJ', 'CL']) {
    const country = getCountry(target)!;
    const options = buildOutlineOptions(country, COUNTRIES, 4);
    assert.equal(options.length, 4);
    assert.equal(new Set(options).size, 4);
    assert.ok(options.includes(target));
    for (const code of options) {
      assert.ok(!WITHOUT_POLYGON.has(code), `${code} не имеет контура`);
    }
  }
});

test('outline-варианты для Италии не карикатурно лёгкие', () => {
  const italy = getCountry('IT')!;
  // 20 прогонов: варианты хотя бы наполовину с того же континента.
  for (let i = 0; i < 20; i++) {
    const options = buildOutlineOptions(italy, COUNTRIES, 4);
    const sameContinent = options.filter((code) => getCountry(code)?.continent === 'europe');
    assert.ok(sameContinent.length >= 2, `слишком разношёрстные варианты: ${options.join(',')}`);
  }
});

test('персональная сессия начинается с просроченных повторений', () => {
  let data = emptyProfileData();
  // Учим Казахстан давно — карточка просрочена к NOW.
  const past = NOW - 30 * 24 * 60 * 60 * 1000;
  data = applyAnswer(data, outcome({ countryCode: 'KZ' }), past).data;
  data = applyAnswer(data, outcome({ countryCode: 'FR' }), past).data;

  const session = buildPersonalSession({
    data,
    pool: COUNTRIES,
    skills: ['flagToCountry'],
    length: 10,
    now: NOW,
  });

  const first2 = session.slice(0, 2).map((q) => q.countryCode).sort();
  assert.deepEqual(first2, ['FR', 'KZ'], 'просроченные карточки идут первыми');
});

test('сессия подтягивает слабые навыки знакомых стран', () => {
  let data = emptyProfileData();
  data = applyAnswer(data, outcome({ countryCode: 'FR', skill: 'flagToCountry', elapsedMs: 1000 }), NOW - 1000).data;

  const session = buildPersonalSession({
    data,
    pool: COUNTRIES,
    skills: SKILLS_ALL,
    length: 12,
    now: NOW,
  });

  const frSkills = session.filter((q) => q.countryCode === 'FR').map((q) => q.skill);
  assert.ok(frSkills.length > 0, 'Франция присутствует в сессии');
  assert.ok(
    frSkills.some((s) => s !== 'flagToCountry'),
    `не только флаг: ${frSkills.join(',')}`,
  );
});

test('сессия включает страны из личной путаницы', () => {
  let data = emptyProfileData();
  const past = NOW - 10 * 24 * 60 * 60 * 1000;
  // Наошибались: Румынию путаем с Чадом.
  data = applyAnswer(data, outcome({ countryCode: 'RO', correct: false, chosenCode: 'TD' }), past).data;
  data = applyAnswer(data, outcome({ countryCode: 'RO', correct: false, chosenCode: 'TD' }), past).data;

  const session = buildPersonalSession({
    data,
    pool: COUNTRIES,
    skills: ['flagToCountry'],
    length: 10,
    now: NOW,
  });

  const codes = session.map((q) => q.countryCode);
  assert.ok(codes.includes('RO'), 'Румыния в сессии');
  assert.ok(codes.includes('TD'), 'Чад — её двойник — тоже в сессии');
});

test('в сессии нет дубликатов пары «страна × навык» и стран без контура в outline', () => {
  const session = buildPersonalSession({
    data: emptyProfileData(),
    pool: COUNTRIES,
    skills: ['outlineToCountry'],
    length: 15,
    now: NOW,
  });

  const keys = session.map((q) => `${q.countryCode}:${q.skill}`);
  assert.equal(new Set(keys).size, keys.length);
  for (const q of session) {
    assert.ok(!WITHOUT_POLYGON.has(q.countryCode), `${q.countryCode} без контура`);
    assert.equal(new Set(q.options).size, q.options.length);
  }
});

test('детский режим: 3 варианта и подсказка континента в контурах', () => {
  const session = buildPersonalSession({
    data: emptyProfileData(),
    pool: COUNTRIES,
    skills: ['outlineToCountry'],
    length: 5,
    ageMode: 'kid',
    now: NOW,
  });

  for (const q of session) {
    assert.equal(q.options.length, 3);
    assert.ok(q.hint?.startsWith('Континент:'), 'есть подсказка континента');
    const country = getCountry(q.countryCode)!;
    assert.ok(country.tier <= 2, `слишком редкая страна для ребёнка: ${q.countryCode}`);
  }
});

test('тренировка страны покрывает все навыки и включает двойников', () => {
  let data = emptyProfileData();
  data = applyAnswer(data, outcome({ countryCode: 'RO', correct: false, chosenCode: 'TD' }), NOW).data;

  const questions = buildCountryTraining('RO', data, SKILLS_ALL);
  const roSkills = questions.filter((q) => q.countryCode === 'RO').map((q) => q.skill);

  assert.ok(roSkills.includes('flagToCountry'));
  assert.ok(roSkills.includes('countryToCapital'));
  assert.ok(roSkills.includes('outlineToCountry'));
  assert.ok(
    questions.some((q) => q.countryCode === 'TD'),
    'двойник Чад включён в тренировку',
  );
});

test('тренировка одного навыка ограничивается этим навыком', () => {
  const questions = buildCountryTraining('KZ', emptyProfileData(), SKILLS_ALL, 'countryToCapital');
  assert.ok(questions.length >= 1);
  for (const q of questions) assert.equal(q.skill, 'countryToCapital');
});

test('fallback: у страны без контура тренировка не содержит outline-вопросов', () => {
  const questions = buildCountryTraining('SG', emptyProfileData(), SKILLS_ALL);
  assert.ok(questions.length > 0, 'Сингапур тренируется по остальным навыкам');
  assert.ok(!questions.some((q) => q.skill === 'outlineToCountry' && q.countryCode === 'SG'));

  // И сравнительная тренировка контуров с такой страной не создаётся.
  assert.deepEqual(buildConfusionDrill('SG', 'MY', 'outlineToCountry'), []);
});
