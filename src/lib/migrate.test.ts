import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GUEST_ID, initialPersistedState, migrateStore } from './migrate.ts';

const NOW = Date.UTC(2026, 0, 1);

/** Настоящий срез v1-состояния, каким его писал старый store. */
function v1State() {
  return {
    cards: {
      'KZ:flag-to-country': {
        countryCode: 'KZ',
        mode: 'flag-to-country',
        ease: 2.6,
        interval: 6,
        streak: 3,
        repetitions: 3,
        lapses: 1,
        due: NOW + 1000,
        lastReviewed: NOW - 1000,
      },
      'FR:capital': {
        countryCode: 'FR',
        mode: 'capital',
        ease: 2.5,
        interval: 1,
        streak: 1,
        repetitions: 1,
        lapses: 0,
        due: NOW,
        lastReviewed: NOW,
      },
      'DE:find-on-globe': {
        countryCode: 'DE',
        mode: 'find-on-globe',
        ease: 2.5,
        interval: 0.04,
        streak: 0,
        repetitions: 0,
        lapses: 2,
        due: NOW,
        lastReviewed: NOW,
      },
    },
    progress: {
      KZ: { countryCode: 'KZ', correct: 5, wrong: 2, confusedWith: { UZ: 2 }, discoveredAt: NOW },
      FR: { countryCode: 'FR', correct: 1, wrong: 0, confusedWith: {}, discoveredAt: NOW },
    },
    xp: 320,
    coins: 44,
    stars: 0,
    hotStreak: 2,
    bestHotStreak: 7,
    dayStreak: 3,
    lastPlayedDay: '2025-12-31',
    ageMode: 'kid',
    unlocked: ['first-steps'],
    answersToday: 12,
  };
}

test('миграция v1 создаёт профиль «Игрок» и переносит прогресс', () => {
  const state = migrateStore(v1State(), 1, NOW);

  const migrated = Object.values(state.profiles).find((p) => !p.guest);
  assert.ok(migrated, 'создан профиль по умолчанию');
  assert.equal(migrated.name, 'Игрок');
  assert.equal(migrated.ageMode, 'kid', 'возрастной режим сохранён');
  assert.equal(state.activeProfileId, migrated.id, 'старый прогресс становится активным');

  const data = state.data[migrated.id];
  assert.equal(data.xp, 320);
  assert.equal(data.coins, 44);
  assert.deepEqual(data.unlocked, ['first-steps']);
});

test('режимы v1 переезжают в соответствующие навыки', () => {
  const state = migrateStore(v1State(), 1, NOW);
  const data = state.data[state.activeProfileId];

  assert.ok(data.cards['KZ:flagToCountry'], 'flag-to-country → flagToCountry');
  assert.ok(data.cards['FR:countryToCapital'], 'capital → countryToCapital');
  assert.ok(data.cards['DE:countryLocation'], 'find-on-globe → countryLocation');
  assert.equal(Object.keys(data.cards).length, 3, 'ничего лишнего не появилось');

  const kz = data.cards['KZ:flagToCountry'];
  assert.equal(kz.interval, 6, 'параметры SM-2 сохранены');
  assert.equal(kz.streak, 3);
  assert.equal(kz.avgMs, null, 'новые поля заполнены значениями по умолчанию');

  // outlineToCountry начинается с нуля — карточек по нему нет.
  assert.ok(!Object.keys(data.cards).some((k) => k.endsWith(':outlineToCountry')));
});

test('старая путаница без навыка попадает в flagToCountry', () => {
  const state = migrateStore(v1State(), 1, NOW);
  const data = state.data[state.activeProfileId];
  assert.deepEqual(data.progress.KZ.confusedWith, { flagToCountry: { UZ: 2 } });
  assert.deepEqual(data.progress.FR.confusedWith, {});
});

test('пустое или отсутствующее v1-состояние даёт чистого гостя', () => {
  for (const persisted of [undefined, null, {}, { xp: 0, cards: {} }]) {
    const state = migrateStore(persisted, 1, NOW);
    assert.equal(state.activeProfileId, GUEST_ID);
    assert.ok(state.profiles[GUEST_ID].guest);
    assert.deepEqual(state.data[GUEST_ID].cards, {});
  }
});

test('повреждённые данные не роняют миграцию', () => {
  const broken = [
    { cards: 'мусор', xp: 'много' },
    { cards: { 'XX:???': { mode: 42 } }, xp: 10 },
    { cards: { 'KZ:flag-to-country': null }, xp: 10 },
    42,
    'строка',
  ];
  for (const persisted of broken) {
    const state = migrateStore(persisted, 1, NOW);
    assert.ok(state.profiles, `не упало на ${JSON.stringify(persisted)}`);
    assert.ok(state.data[state.activeProfileId]);
  }
});

test('состояние текущей версии проходит без изменений', () => {
  const current = initialPersistedState(NOW);
  assert.equal(migrateStore(current, 3, NOW), current);
});

test('v2 → v3: данные профиля получают историю и xpToday', () => {
  const v2 = initialPersistedState(NOW);
  // Симулируем v2-запись без новых полей.
  const legacy = { ...v2.data[GUEST_ID] } as Record<string, unknown>;
  delete legacy.history;
  delete legacy.xpToday;
  v2.data[GUEST_ID] = legacy as never;

  const state = migrateStore(v2, 2, NOW);
  assert.deepEqual(state.data[GUEST_ID].history, {});
  assert.equal(state.data[GUEST_ID].xpToday, 0);
});

test('persisted-состояние переживает JSON-сериализацию', () => {
  const state = migrateStore(v1State(), 1, NOW);
  const restored = JSON.parse(JSON.stringify(state));
  assert.deepEqual(restored, state);
});
