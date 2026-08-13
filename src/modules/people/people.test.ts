import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { CATEGORY_META, MODE_SKILL, SKILLS } from './config.ts';
import { CREDIT_BY_ID, PERSON_CREDITS } from './data/credits.ts';
import { isLearned, masteryOf, summarize } from './mastery.ts';
import { ALL_ROLES, LEARNING_ORDER, PEOPLE, TOTAL_PEOPLE, getPerson } from './people.ts';
import {
  applyPeopleAnswer,
  emptyPeopleProgress,
  normalizePeopleProgress,
  topConfusions,
  weakPeople,
} from './progress.ts';
import { buildPeopleSession, buildRoleOptions, modesFor } from './session.ts';
import type { PeopleAnswerRecord, PeopleProgress } from './types.ts';

const NOW = Date.UTC(2026, 7, 13, 12);

/** Предсказуемая «случайность» для проверок подбора. */
function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1103515245 + 12345) % 2147483648;
    return value / 2147483648;
  };
}

const answer = (over: Partial<PeopleAnswerRecord> = {}): PeopleAnswerRecord => ({
  personId: PEOPLE[0].id,
  skill: 'photoToName',
  mode: 'photo-to-name',
  chosen: PEOPLE[0].id,
  isCorrect: true,
  responseTimeMs: 2000,
  ...over,
});

function repeat(progress: PeopleProgress, times: number, over: Partial<PeopleAnswerRecord> = {}) {
  let next = progress;
  for (let i = 0; i < times; i += 1) {
    next = applyPeopleAnswer(next, answer(over), NOW + i * 86_400_000).progress;
  }
  return next;
}

/* -------------------------------- данные --------------------------------- */

test('база непуста и без дубликатов', () => {
  assert.ok(TOTAL_PEOPLE >= 100, `в базе всего ${TOTAL_PEOPLE} человек`);
  const ids = PEOPLE.map((person) => person.id);
  assert.equal(new Set(ids).size, ids.length, 'дубликаты id');
  const names = PEOPLE.map((person) => person.nameRu);
  assert.equal(new Set(names).size, names.length, 'дубликаты имён');
});

test('у каждого человека заполнены имя, роль и категория', () => {
  const cyrillic = /[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]/;
  for (const person of PEOPLE) {
    assert.ok(cyrillic.test(person.nameRu), `${person.id}: имя не на кириллице`);
    assert.ok(person.role.length > 1, `${person.id}: пустая роль`);
    assert.ok(CATEGORY_META[person.category], `${person.id}: неизвестная категория`);
    assert.ok([1, 2, 3].includes(person.famousLevel), `${person.id}: странная известность`);
  }
});

test('годы жизни правдоподобны и не перепутаны местами', () => {
  for (const person of PEOPLE) {
    if (person.birthYear) {
      assert.ok(person.birthYear > 1300 && person.birthYear < 2020, `${person.id}: год рождения`);
    }
    if (person.birthYear && person.deathYear) {
      assert.ok(person.deathYear >= person.birthYear, `${person.id}: умер раньше, чем родился`);
      assert.ok(person.deathYear - person.birthYear < 120, `${person.id}: прожил слишком долго`);
    }
  }
});

test('портретом помечены только те, кто не дожил до эпохи фотографии', () => {
  for (const person of PEOPLE) {
    if (person.imageKind !== 'depiction') continue;
    const last = person.deathYear ?? person.birthYear;
    assert.ok(last !== null && last < 1840, `${person.id}: фотография помечена портретом`);
  }
});

test('у каждого есть файл фотографии на диске', () => {
  for (const person of PEOPLE) {
    const file = join(process.cwd(), 'public', 'people', `${person.id}.webp`);
    assert.ok(existsSync(file), `${person.id}: нет файла ${person.id}.webp`);
  }
});

test('у каждого изображения указаны лицензия и источник', () => {
  for (const person of PEOPLE) {
    const credit = CREDIT_BY_ID.get(person.id);
    assert.ok(credit, `${person.id}: нет записи о происхождении`);
    assert.ok(credit!.license && credit!.license !== 'не указана', `${person.id}: лицензия`);
    assert.match(credit!.sourceUrl, /^https:\/\/commons\.wikimedia\.org\//);
    assert.match(credit!.dataSource, /^https:\/\/www\.wikidata\.org\/wiki\/Q\d+$/);
  }
});

test('одно изображение не приписано двум людям', () => {
  const files = PERSON_CREDITS.map((credit) => credit.file);
  assert.equal(new Set(files).size, files.length, 'один файл у нескольких персон');
});

test('ролей достаточно, чтобы собрать четыре варианта', () => {
  assert.ok(ALL_ROLES.length >= 4, `всего ролей ${ALL_ROLES.length}`);
});

test('знакомство начинается с самых известных', () => {
  assert.equal(LEARNING_ORDER[0].famousLevel, 3);
  assert.ok(LEARNING_ORDER.length === TOTAL_PEOPLE);
});

/* -------------------------------- навыки --------------------------------- */

test('четыре навыка человека независимы', () => {
  const progress = repeat(emptyPeopleProgress(), 4);
  const mastery = masteryOf(progress, PEOPLE[0].id);
  assert.ok(mastery.bySkill.photoToName > 0, 'тренированный навык не вырос');
  assert.equal(mastery.bySkill.nameToRole, 0, 'нетронутый навык вырос сам');
  assert.ok(mastery.percent < 100, 'общий процент собран не по всем навыкам');
});

test('человек считается изученным только когда подтянуты все навыки', () => {
  let progress = emptyPeopleProgress();
  for (const skill of SKILLS.slice(0, 3)) progress = repeat(progress, 6, { skill });
  assert.equal(isLearned(progress, PEOPLE[0].id), false, 'изучен без четвёртого навыка');
  progress = repeat(progress, 6, { skill: 'nameToRole' });
  assert.equal(isLearned(progress, PEOPLE[0].id), true);
});

test('ошибка сбрасывает прогресс карточки и не даёт XP', () => {
  const trained = repeat(emptyPeopleProgress(), 5);
  const before = trained.cards[`${PEOPLE[0].id}:photoToName`].interval;
  const result = applyPeopleAnswer(
    trained,
    answer({ chosen: PEOPLE[1].id, isCorrect: false }),
    NOW,
  );
  assert.equal(result.xpGained, 0);
  assert.ok(result.progress.cards[`${PEOPLE[0].id}:photoToName`].interval < before);
});

test('быстрый верный ответ ценнее медленного', () => {
  const fast = applyPeopleAnswer(emptyPeopleProgress(), answer({ responseTimeMs: 1200 }), NOW);
  const slow = applyPeopleAnswer(emptyPeopleProgress(), answer({ responseTimeMs: 9000 }), NOW);
  assert.ok(fast.xpGained > slow.xpGained);
});

/* ------------------------------- путаница -------------------------------- */

test('путаница пишется в обе стороны', () => {
  const result = applyPeopleAnswer(
    emptyPeopleProgress(),
    answer({ chosen: PEOPLE[1].id, isCorrect: false }),
    NOW,
  );
  assert.equal(result.progress.confusions[PEOPLE[0].id][PEOPLE[1].id], 1);
  assert.equal(result.progress.confusions[PEOPLE[1].id][PEOPLE[0].id], 1);
});

test('ошибка в вопросе о роли не создаёт путаницу между людьми', () => {
  // Перепутать «поэт» и «геолог» — не то же самое, что перепутать двух людей.
  const result = applyPeopleAnswer(
    emptyPeopleProgress(),
    answer({ mode: 'photo-to-role', skill: 'photoToRole', chosen: 'Геолог', isCorrect: false }),
    NOW,
  );
  assert.deepEqual(result.progress.confusions, {});
});

test('путаемая пара не задваивается в отчёте', () => {
  let progress = emptyPeopleProgress();
  progress = applyPeopleAnswer(progress, answer({ chosen: PEOPLE[1].id, isCorrect: false }), NOW)
    .progress;
  progress = applyPeopleAnswer(
    progress,
    answer({ personId: PEOPLE[1].id, chosen: PEOPLE[0].id, isCorrect: false }),
    NOW,
  ).progress;
  assert.equal(topConfusions(progress).length, 1);
});

test('слабые люди отсортированы по числу ошибок', () => {
  let progress = emptyPeopleProgress();
  for (let i = 0; i < 3; i += 1) {
    progress = applyPeopleAnswer(progress, answer({ chosen: PEOPLE[1].id, isCorrect: false }), NOW)
      .progress;
  }
  progress = applyPeopleAnswer(
    progress,
    answer({ personId: PEOPLE[2].id, chosen: PEOPLE[0].id, isCorrect: false }),
    NOW,
  ).progress;
  assert.equal(weakPeople(progress)[0], PEOPLE[0].id);
});

/* -------------------------------- сессия --------------------------------- */

test('новичку сначала показывают лица, потом спрашивают', () => {
  const steps = buildPeopleSession({ progress: emptyPeopleProgress(), now: NOW, rng: seeded(1) });
  assert.equal(steps.length, 10);
  assert.equal(steps[0].kind, 'learn');
  assert.ok(steps.some((step) => step.kind === 'quiz'));
});

test('новому человеку достаётся только простой режим', () => {
  const steps = buildPeopleSession({ progress: emptyPeopleProgress(), now: NOW, rng: seeded(2) });
  for (const step of steps) {
    if (step.kind === 'quiz') assert.equal(step.question!.mode, 'photo-to-name');
  }
});

test('режимы открываются по мере освоения', () => {
  assert.deepEqual(modesFor(0), ['photo-to-name']);
  assert.ok(modesFor(50).includes('photo-to-role'));
  assert.equal(modesFor(100).length, 4);
});

test('в каждом вопросе четыре варианта и среди них верный', () => {
  const steps = buildPeopleSession({ progress: emptyPeopleProgress(), now: NOW, rng: seeded(3) });
  for (const step of steps) {
    if (step.kind !== 'quiz') continue;
    const question = step.question!;
    assert.equal(question.options.length, 4, `${question.mode}: не четыре варианта`);
    assert.equal(new Set(question.options).size, 4, `${question.mode}: повторы вариантов`);
    const person = getPerson(step.personId)!;
    const expected = question.mode.endsWith('role') ? person.role : person.id;
    assert.ok(question.options.includes(expected), `${question.mode}: нет верного варианта`);
  }
});

test('варианты ролей не повторяют одну и ту же роль', () => {
  const person = PEOPLE[0];
  const options = buildRoleOptions(person, PEOPLE, 4, seeded(7));
  assert.equal(new Set(options).size, 4);
  assert.ok(options.includes(person.role));
});

test('перепутанный человек возвращается в варианты', () => {
  const progress = applyPeopleAnswer(
    emptyPeopleProgress(),
    answer({ chosen: PEOPLE[5].id, isCorrect: false }),
    NOW,
  ).progress;
  const steps = buildPeopleSession({ progress, now: NOW, rng: seeded(4) });
  const question = steps.find(
    (step) => step.personId === PEOPLE[0].id && step.question?.mode === 'photo-to-name',
  );
  assert.ok(question, 'ошибочная карточка не вернулась');
  assert.ok(question!.question!.options.includes(PEOPLE[5].id), 'перепутанного нет в вариантах');
});

test('режим работы над ошибками берёт только ошибочные карточки', () => {
  let progress = applyPeopleAnswer(
    emptyPeopleProgress(),
    answer({ personId: PEOPLE[3].id, chosen: PEOPLE[4].id, isCorrect: false }),
    NOW,
  ).progress;
  progress = repeat(progress, 2, { personId: PEOPLE[0].id });

  const steps = buildPeopleSession({ progress, now: NOW, mistakesOnly: true, rng: seeded(5) });
  assert.ok(steps.length > 0);
  for (const step of steps) assert.equal(step.personId, PEOPLE[3].id);
});

test('фильтр по категории не выпускает за её пределы', () => {
  const steps = buildPeopleSession({
    progress: emptyPeopleProgress(),
    categories: ['sport'],
    now: NOW,
    rng: seeded(6),
  });
  assert.ok(steps.length > 0);
  for (const step of steps) assert.equal(getPerson(step.personId)!.category, 'sport');
});

test('каждый режим тренирует свой навык', () => {
  const steps = buildPeopleSession({
    progress: repeat(emptyPeopleProgress(), 8),
    now: NOW,
    rng: seeded(8),
  });
  for (const step of steps) {
    if (step.kind !== 'quiz') continue;
    assert.equal(step.question!.skill, MODE_SKILL[step.question!.mode]);
  }
});

/* ------------------------------ сохранность ------------------------------ */

test('applyPeopleAnswer не мутирует исходный прогресс', () => {
  const progress = emptyPeopleProgress();
  const snapshot = JSON.stringify(progress);
  applyPeopleAnswer(progress, answer(), NOW);
  assert.equal(JSON.stringify(progress), snapshot);
});

test('нормализация чинит частичные данные и отбрасывает мусор', () => {
  const restored = normalizePeopleProgress({
    cards: {
      [`${PEOPLE[0].id}:photoToName`]: { correct: 3 },
      'битый-ключ': { correct: 1 },
      [`${PEOPLE[0].id}:неизвестныйНавык`]: { correct: 1 },
    },
    seen: [PEOPLE[0].id, 42],
    confusions: { [PEOPLE[0].id]: { [PEOPLE[1].id]: 2 } },
  } as never);

  assert.equal(Object.keys(restored.cards).length, 1);
  assert.equal(restored.cards[`${PEOPLE[0].id}:photoToName`].correct, 3);
  assert.deepEqual(restored.seen, [PEOPLE[0].id]);
  assert.equal(restored.confusions[PEOPLE[0].id][PEOPLE[1].id], 2);
});

test('прогресс переживает JSON-сериализацию', () => {
  const progress = repeat(emptyPeopleProgress(), 3);
  const restored = normalizePeopleProgress(JSON.parse(JSON.stringify(progress)));
  assert.deepEqual(restored, progress);
});

test('сводка считает освоение от всей базы, а не от увиденных', () => {
  const progress = repeat(emptyPeopleProgress(), 8);
  const summary = summarize(progress, PEOPLE.map((person) => person.id));
  assert.ok(summary.mastery < 5, 'один человек не может дать заметный процент от всей базы');
});

test('знакомство не съедает всю сессию: остаётся место на повторение', () => {
  // Пять новых лиц плюс пять вопросов о них — это вся сессия целиком, и
  // тогда режимы за пределами «кто это?» не открываются никогда.
  let progress = emptyPeopleProgress();
  progress = { ...progress, seen: [PEOPLE[0].id] };
  const steps = buildPeopleSession({ progress, now: NOW, rng: seeded(11) });
  const learnSteps = steps.filter((step) => step.kind === 'learn').length;
  assert.ok(learnSteps <= 2, `новых лиц в обычной сессии: ${learnSteps}`);
});

test('режимы открываются от узнавания лица, а не от среднего по навыкам', () => {
  // Среднее не вырастет, пока три навыка закрыты, — получался замкнутый круг.
  let progress = emptyPeopleProgress();
  for (const person of PEOPLE.slice(0, 3)) {
    progress = repeat(progress, 8, { personId: person.id, skill: 'photoToName' });
  }
  const steps = buildPeopleSession({ progress, now: NOW, rng: seeded(12) });
  const modes = new Set(
    steps.filter((step) => step.kind === 'quiz').map((step) => step.question!.mode),
  );
  assert.ok(modes.size > 1, `остался один режим: ${[...modes].join(', ')}`);
});
