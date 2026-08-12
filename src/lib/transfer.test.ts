import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialPersistedState, makeProfile, type PersistedState } from './migrate.ts';
import { applyAnswer, emptyProfileData } from './progress.ts';
import {
  BackupError,
  buildBackup,
  isEmptyProfileData,
  mergeBackup,
  parseBackup,
} from './transfer.ts';

const NOW = Date.UTC(2026, 7, 11, 12);

/** Профиль с реальным прогрессом — как у пользователя в другом браузере. */
function played(name: string, id: string): PersistedState {
  const state = initialPersistedState(NOW);
  state.profiles[id] = makeProfile(id, name, NOW);
  state.data[id] = applyAnswer(
    emptyProfileData(),
    { correct: true, countryCode: 'KZ', skill: 'flagToCountry', elapsedMs: 1500 },
    NOW,
  ).data;
  state.activeProfileId = id;
  return state;
}

test('копия содержит все профили и их прогресс', () => {
  const state = played('Ян', 'yan');
  const backup = buildBackup(state, NOW);

  assert.equal(backup.app, 'mapapp');
  assert.ok(backup.profiles.yan);
  assert.ok(backup.data.yan.xp > 0);
  assert.equal(backup.exportedAt, new Date(NOW).toISOString());
});

test('копия переживает JSON-сериализацию', () => {
  const backup = buildBackup(played('Ян', 'yan'), NOW);
  const restored = parseBackup(JSON.parse(JSON.stringify(backup)));
  assert.deepEqual(restored.profiles, backup.profiles);
  assert.equal(restored.data.yan.xp, backup.data.yan.xp);
});

test('чужой или битый файл отклоняется с понятным сообщением', () => {
  for (const bad of [null, 42, {}, { app: 'other' }, { app: 'mapapp' }]) {
    assert.throws(() => parseBackup(bad), BackupError);
  }
});

test('импорт в пустой браузер переносит профили и делает активным нагулянный', () => {
  const backup = buildBackup(played('Ян', 'yan'), NOW);
  const fresh = initialPersistedState(NOW); // свежий Edge: только «Гость»

  const result = mergeBackup(fresh, backup, NOW);

  assert.ok(result.state.profiles.yan, 'профиль перенесён');
  assert.ok(result.state.data.yan.xp > 0, 'прогресс перенесён');
  assert.equal(result.state.activeProfileId, 'yan', 'активным стал профиль с прогрессом');
  assert.ok(result.imported.includes('Ян'));
});

test('пустой «Гость» заменяется, а не дублируется', () => {
  const source = initialPersistedState(NOW);
  source.data.guest = applyAnswer(
    emptyProfileData(),
    { correct: true, countryCode: 'FR', skill: 'flagToCountry', elapsedMs: 1200 },
    NOW,
  ).data;

  const result = mergeBackup(initialPersistedState(NOW), buildBackup(source, NOW), NOW);

  assert.equal(Object.keys(result.state.profiles).length, 1, 'два гостя не появились');
  assert.ok(result.state.data.guest.xp > 0);
  assert.deepEqual(result.replaced, ['Гость']);
});

test('существующий прогресс не затирается импортом', () => {
  const local = played('Анна', 'shared-id');
  const localXp = local.data['shared-id'].xp;

  // Копия с тем же id, но это другой человек с другим прогрессом.
  const other = played('Ян', 'shared-id');
  other.data['shared-id'] = applyAnswer(
    other.data['shared-id'],
    { correct: true, countryCode: 'DE', skill: 'flagToCountry', elapsedMs: 1000 },
    NOW,
  ).data;

  const result = mergeBackup(local, buildBackup(other, NOW), NOW);

  assert.equal(result.state.data['shared-id'].xp, localXp, 'местный профиль не тронут');
  assert.equal(result.state.profiles['shared-id'].name, 'Анна');
  const importedId = Object.keys(result.state.profiles).find(
    (id) => id.startsWith('imported-'),
  );
  assert.ok(importedId, 'импортированный профиль добавлен рядом');
  assert.equal(result.state.profiles[importedId].name, 'Ян');
  assert.equal(result.state.profiles[importedId].id, importedId, 'id внутри профиля обновлён');
});

test('повторный импорт того же файла ничего не ломает', () => {
  const backup = buildBackup(played('Ян', 'yan'), NOW);
  const once = mergeBackup(initialPersistedState(NOW), backup, NOW);
  const twice = mergeBackup(once.state, backup, NOW);

  // Профиль с таким id уже есть и он непустой — копия ляжет рядом, но
  // исходные данные останутся нетронутыми.
  assert.ok(twice.state.profiles.yan);
  assert.equal(twice.state.data.yan.xp, once.state.data.yan.xp);
});

test('пустота профиля определяется по всем модулям', () => {
  assert.equal(isEmptyProfileData(emptyProfileData()), true);
  assert.equal(isEmptyProfileData(undefined), true);

  const withFlags = applyAnswer(
    emptyProfileData(),
    { correct: true, countryCode: 'KZ', skill: 'flagToCountry', elapsedMs: 1000 },
    NOW,
  ).data;
  assert.equal(isEmptyProfileData(withFlags), false);

  const withMath = emptyProfileData();
  withMath.math.addition.single_digit.solved = 3;
  assert.equal(isEmptyProfileData(withMath), false, 'математика тоже считается');

  const withChinese = emptyProfileData();
  withChinese.chinese.cards['你:pronunciationRecognition'] = {
    characterId: '你',
    skill: 'pronunciationRecognition',
    ease: 2.5,
    interval: 1,
    streak: 1,
    repetitions: 1,
    lapses: 0,
    due: 0,
    lastReviewed: 0,
    correct: 1,
    wrong: 0,
    avgMs: 1000,
  };
  assert.equal(isEmptyProfileData(withChinese), false, 'китайский тоже считается');
});
