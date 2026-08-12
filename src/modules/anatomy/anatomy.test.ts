import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SKILLS, SYSTEMS } from './config.ts';
import { BASE_BY_REGION, REGION_BASES } from './data/bases.ts';
import { HOTSPOTS, pickHotspot } from './data/hotspots.ts';
import {
  cardsOf,
  isLearned,
  isSkeletonUnlocked,
  isSystemUnlocked,
  masteryOf,
  structurePercent,
  summarize,
} from './mastery.ts';
import {
  applyAnatomyAnswer,
  emptyAnatomyProgress,
  markSeen,
  normalizeAnatomyProgress,
  topConfusions,
  weakStructures,
} from './progress.ts';
import { buildOptions, buildSession, modesFor } from './session.ts';
import {
  STRUCTURES,
  TOTAL_STRUCTURES,
  getStructure,
  structuresDrawnIn,
  structuresOfSystem,
} from './structures.ts';
import type { AnatomyAnswerRecord, AnatomyProgress } from './types.ts';

const NOW = Date.UTC(2026, 7, 11, 10);
const ALL_IDS = STRUCTURES.map((s) => s.id);

function seeded(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function answer(partial: Partial<AnatomyAnswerRecord>): AnatomyAnswerRecord {
  return {
    structureId: 'heart',
    skill: 'recognition',
    mode: 'what-is-this',
    chosenId: 'heart',
    isCorrect: true,
    responseTimeMs: 2500,
    ...partial,
  };
}

function repeat(progress: AnatomyProgress, times: number, partial: Partial<AnatomyAnswerRecord> = {}) {
  let current = progress;
  for (let i = 0; i < times; i++) {
    current = applyAnatomyAnswer(current, answer(partial), NOW).progress;
  }
  return current;
}

/* --------------------------------- данные -------------------------------- */

test('каталог структур целостен и на русском', () => {
  assert.ok(TOTAL_STRUCTURES >= 25, `структур всего ${TOTAL_STRUCTURES}`);
  assert.equal(new Set(ALL_IDS).size, ALL_IDS.length, 'дубликаты id');

  const cyrillic = /[А-Яа-яЁё]/;
  for (const structure of STRUCTURES) {
    assert.ok(cyrillic.test(structure.nameRu), `${structure.id}: название не на русском`);
    assert.ok(cyrillic.test(structure.factRu), `${structure.id}: пояснение не на русском`);
    assert.ok(BASE_BY_REGION.has(structure.region), `${structure.id}: неизвестный регион`);
  }
});

test('в названиях и пояснениях нет эмодзи — только слова и рисунки', () => {
  const emoji = /\p{Extended_Pictographic}/u;
  for (const structure of STRUCTURES) {
    assert.ok(!emoji.test(structure.nameRu), `${structure.id}: эмодзи в названии`);
    assert.ok(!emoji.test(structure.factRu), `${structure.id}: эмодзи в пояснении`);
  }
});

test('каждая структура отмечена на иллюстрации своего региона', () => {
  for (const structure of STRUCTURES) {
    const ids = (HOTSPOTS[structure.region] ?? []).map((spot) => spot.structureId);
    assert.ok(ids.includes(structure.id), `${structure.id}: нет зоны в регионе ${structure.region}`);
  }
});

test('зоны не ссылаются на несуществующие структуры', () => {
  const known = new Set(ALL_IDS);
  for (const [region, spots] of Object.entries(HOTSPOTS)) {
    for (const spot of spots) {
      assert.ok(known.has(spot.structureId), `${region}: лишняя зона ${spot.structureId}`);
    }
  }
});

test('у каждого региона есть базовая иллюстрация', () => {
  for (const region of Object.keys(HOTSPOTS)) {
    const base = BASE_BY_REGION.get(region as (typeof REGION_BASES)[number]['id']);
    assert.ok(base, `${region}: нет базовой картинки`);
    assert.match(base!.src, /^\/anatomy\/base\/.+\.webp$/);
    assert.ok(base!.width > 100 && base!.height > 100, `${region}: подозрительный размер`);
  }
});

test('зоны лежат внутри картинки и не совпадают центрами', () => {
  for (const [region, spots] of Object.entries(HOTSPOTS)) {
    const seen = new Set<string>();
    for (const spot of spots) {
      assert.ok(spot.rx > 0 && spot.ry > 0, `${region}/${spot.structureId}: нулевой радиус`);
      assert.ok(
        spot.cx - spot.rx >= -2 && spot.cx + spot.rx <= 102,
        `${region}/${spot.structureId}: зона вышла за кадр по горизонтали`,
      );
      assert.ok(
        spot.cy - spot.ry >= -2 && spot.cy + spot.ry <= 102,
        `${region}/${spot.structureId}: зона вышла за кадр по вертикали`,
      );
      const key = `${Math.round(spot.cx)}:${Math.round(spot.cy)}`;
      assert.ok(!seen.has(key), `${region}: две зоны в одной точке (${key})`);
      seen.add(key);
    }
  }
});

test('клик в центр зоны выбирает свою структуру', () => {
  for (const [region, spots] of Object.entries(HOTSPOTS)) {
    for (const spot of spots) {
      assert.equal(
        pickHotspot(region as (typeof REGION_BASES)[number]['id'], spot.cx, spot.cy),
        spot.structureId,
        `${region}: центр ${spot.structureId} отдал чужую структуру`,
      );
    }
  }
});

test('клик далеко от всего не засчитывается', () => {
  assert.equal(pickHotspot('skull', 99, 1), null);
});

test('на полном скелете спрашиваются крупные кости', () => {
  const drawn = structuresDrawnIn('skeleton');
  for (const bone of ['femur', 'pelvis', 'ribs', 'spine', 'tibia', 'foot_bones']) {
    assert.ok(drawn.includes(bone), `${bone} не попала на полный скелет`);
  }
  // Мелкие кости черепа спрашиваются в своём регионе, а не на всей фигуре.
  assert.ok(!drawn.includes('parietal_bone'));
});

test('сессия по полному скелету собирается — регион берётся из зон', () => {
  const steps = buildSession({
    progress: emptyAnatomyProgress(),
    regions: ['skeleton'],
    length: 8,
    now: NOW,
    rng: seeded(3),
  });
  assert.ok(steps.length > 0, 'на полном скелете нечего спрашивать');
  const drawn = new Set(structuresDrawnIn('skeleton'));
  for (const step of steps) {
    assert.ok(drawn.has(step.structureId), `${step.structureId}: нет зоны на скелете`);
  }
});

/* -------------------------------- навыки --------------------------------- */

test('три навыка структуры независимы', () => {
  let progress = repeat(emptyAnatomyProgress(), 4);
  const cards = cardsOf(progress, 'heart');
  assert.ok(cards.recognition, 'узнавание прокачано');
  assert.equal(cards.location, undefined, 'расположение не трогали');
  assert.ok(structurePercent(progress, 'heart') < 100, 'один навык ≠ знание структуры');

  progress = repeat(progress, 4, { skill: 'location', mode: 'find-on-body' });
  assert.ok(cardsOf(progress, 'heart').location);
});

test('структура считается изученной при двух уверенных навыках', () => {
  let progress = repeat(emptyAnatomyProgress(), 3);
  assert.equal(isLearned(progress, 'heart'), false, 'одного навыка мало');
  progress = repeat(progress, 3, { skill: 'name', mode: 'find-image' });
  assert.equal(isLearned(progress, 'heart'), true);
});

test('разбивка по навыкам видна в mastery', () => {
  const progress = repeat(emptyAnatomyProgress(), 5);
  const mastery = masteryOf(progress, 'heart');
  assert.ok(mastery.bySkill.recognition > 0);
  assert.equal(mastery.bySkill.location, 0, 'нетронутый навык — ноль, а не среднее');
  for (const skill of SKILLS) assert.ok(mastery.bySkill[skill] >= 0);
});

/* -------------------------------- прогресс -------------------------------- */

test('ошибка пишет путаницу в обе стороны', () => {
  const progress = applyAnatomyAnswer(
    emptyAnatomyProgress(),
    answer({ structureId: 'parietal_bone', chosenId: 'temporal_bone', isCorrect: false }),
    NOW,
  ).progress;

  assert.equal(progress.confusions['parietal_bone']['temporal_bone'], 1);
  assert.equal(progress.confusions['temporal_bone']['parietal_bone'], 1);
  assert.equal(topConfusions(progress).length, 1, 'пара не задваивается');
});

test('XP только за верный ответ, ошибка ничего не отнимает', () => {
  const right = applyAnatomyAnswer(emptyAnatomyProgress(), answer({ responseTimeMs: 1000 }), NOW);
  const slow = applyAnatomyAnswer(emptyAnatomyProgress(), answer({ responseTimeMs: 9000 }), NOW);
  const wrong = applyAnatomyAnswer(
    emptyAnatomyProgress(),
    answer({ chosenId: 'liver', isCorrect: false }),
    NOW,
  );
  assert.ok(right.xpGained > slow.xpGained);
  assert.equal(wrong.xpGained, 0);
});

test('показ структуры отмечается и не дублируется', () => {
  let progress = markSeen(emptyAnatomyProgress(), 'heart');
  progress = markSeen(progress, 'heart');
  assert.deepEqual(progress.seen, ['heart']);
});

test('слабые структуры сортируются по числу ошибок', () => {
  let progress = emptyAnatomyProgress();
  for (let i = 0; i < 3; i++) {
    progress = applyAnatomyAnswer(
      progress,
      answer({ structureId: 'spleen', chosenId: 'liver', isCorrect: false }),
      NOW,
    ).progress;
  }
  progress = applyAnatomyAnswer(
    progress,
    answer({ structureId: 'pancreas', chosenId: 'liver', isCorrect: false }),
    NOW,
  ).progress;
  assert.deepEqual(weakStructures(progress, 2), ['spleen', 'pancreas']);
});

/* ------------------------------- путь обучения ---------------------------- */

test('кости и мышцы закрыты, пока не освоено предыдущее', () => {
  const fresh = emptyAnatomyProgress();
  assert.equal(isSystemUnlocked(fresh, 'organs'), true, 'органы открыты сразу');
  assert.equal(isSystemUnlocked(fresh, 'bones'), false);
  assert.equal(isSystemUnlocked(fresh, 'muscles'), false);
  assert.equal(isSkeletonUnlocked(fresh), false, 'полный скелет — не первый экран');
});

test('кости открываются после освоения органов', () => {
  let progress = emptyAnatomyProgress();
  for (const organ of structuresOfSystem('organs')) {
    for (const skill of ['recognition', 'name'] as const) {
      progress = repeat(progress, 3, { structureId: organ.id, skill });
    }
  }
  assert.equal(isSystemUnlocked(progress, 'bones'), true);
  assert.equal(isSystemUnlocked(progress, 'muscles'), false, 'мышцы ждут костей');
});

test('порядок систем задан и не зациклен', () => {
  assert.equal(SYSTEMS[0].unlockAfter, null, 'первая система открыта сразу');
  for (let i = 1; i < SYSTEMS.length; i++) {
    assert.equal(SYSTEMS[i].unlockAfter, SYSTEMS[i - 1].id);
  }
});

/* --------------------------------- сессия --------------------------------- */

test('новичку сессия сначала показывает структуры, потом спрашивает', () => {
  const steps = buildSession({
    progress: emptyAnatomyProgress(),
    regions: ['organs_main'],
    now: NOW,
    rng: seeded(1),
  });

  assert.ok(steps.length > 0);
  assert.equal(steps[0].kind, 'learn', 'первый шаг — знакомство');
  assert.ok(steps.some((s) => s.kind === 'quiz'), 'дальше идут вопросы');
});

test('новой структуре даётся только простой режим', () => {
  assert.deepEqual(modesFor(0), ['what-is-this']);
  assert.ok(modesFor(40).includes('find-image'));
  assert.ok(modesFor(80).includes('find-on-body'), 'поиск на теле — для освоенных');

  const steps = buildSession({
    progress: emptyAnatomyProgress(),
    regions: ['organs_main'],
    now: NOW,
    rng: seeded(2),
  });
  for (const step of steps) {
    if (step.kind === 'quiz') {
      assert.equal(step.question!.mode, 'what-is-this', 'новичку — только «что это?»');
    }
  }
});

test('варианты ответа берутся из того же региона и не дублируются', () => {
  const target = getStructure('parietal_bone')!;
  for (let i = 0; i < 20; i++) {
    const options = buildOptions(target, STRUCTURES, emptyAnatomyProgress(), 4, seeded(3 + i));
    assert.equal(options.length, 4);
    assert.equal(new Set(options).size, 4);
    assert.ok(options.includes('parietal_bone'));
    const sameRegion = options.filter((id) => getStructure(id)?.region === 'skull');
    assert.ok(sameRegion.length >= 3, `слишком разнородные варианты: ${options.join(',')}`);
  }
});

test('перепутанная структура возвращается в варианты', () => {
  const progress = applyAnatomyAnswer(
    emptyAnatomyProgress(),
    answer({ structureId: 'parietal_bone', chosenId: 'occipital_bone', isCorrect: false }),
    NOW,
  ).progress;
  const options = buildOptions(getStructure('parietal_bone')!, STRUCTURES, progress, 4, seeded(9));
  assert.ok(options.includes('occipital_bone'));
});

test('в режиме поиска на теле вариантов нет — ребёнок кликает по схеме', () => {
  let progress = emptyAnatomyProgress();
  progress = repeat(progress, 6, { structureId: 'heart', skill: 'location', mode: 'find-on-body' });
  progress = repeat(progress, 6, { structureId: 'heart', skill: 'recognition' });

  const steps = buildSession({
    progress,
    regions: ['organs_main'],
    now: NOW + 40 * 24 * 60 * 60 * 1000,
    rng: seeded(4),
  });
  for (const step of steps) {
    if (step.question?.mode === 'find-on-body') {
      assert.deepEqual(step.question.options, []);
      assert.equal(step.question.skill, 'location');
    }
  }
});

test('режим работы над ошибками берёт только структуры с ошибками', () => {
  let progress = emptyAnatomyProgress();
  progress = applyAnatomyAnswer(
    progress,
    answer({ structureId: 'kidneys', chosenId: 'liver', isCorrect: false }),
    NOW,
  ).progress;
  progress = repeat(progress, 2, { structureId: 'heart' });

  const steps = buildSession({
    progress,
    regions: ['organs_main'],
    now: NOW,
    mistakesOnly: true,
    rng: seeded(5),
  });
  assert.equal(steps.length, 1);
  assert.equal(steps[0].structureId, 'kidneys');
});

/* ------------------------------- сохранность ------------------------------ */

test('applyAnatomyAnswer не мутирует исходный прогресс', () => {
  const before = emptyAnatomyProgress();
  const snapshot = JSON.stringify(before);
  applyAnatomyAnswer(before, answer({ chosenId: 'liver', isCorrect: false }), NOW);
  assert.equal(JSON.stringify(before), snapshot);
});

test('нормализация чинит частичные данные и отбрасывает мусор', () => {
  assert.deepEqual(normalizeAnatomyProgress(undefined), emptyAnatomyProgress());

  const fixed = normalizeAnatomyProgress({
    cards: {
      'heart:recognition': { correct: 2 },
      'сломанный ключ': { correct: 1 },
      'heart:неизвестный': { correct: 1 },
    },
    seen: ['heart', 42],
  } as never);

  assert.equal(Object.keys(fixed.cards).length, 1);
  assert.equal(fixed.cards['heart:recognition'].structureId, 'heart');
  assert.deepEqual(fixed.seen, ['heart'], 'мусор из списка убран');
});

test('сводка считает освоение от всего каталога', () => {
  const progress = repeat(emptyAnatomyProgress(), 6);
  const summary = summarize(progress, ALL_IDS);
  assert.equal(summary.seen, 1);
  assert.ok(summary.mastery < 10, `одна структура не может дать ${summary.mastery}%`);
  assert.equal(summary.bySkill.location, 0);
});

test('прогресс переживает JSON-сериализацию', () => {
  const progress = repeat(emptyAnatomyProgress(), 3);
  assert.deepEqual(JSON.parse(JSON.stringify(progress)), progress);
});
