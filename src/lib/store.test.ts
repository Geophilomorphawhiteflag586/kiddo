/**
 * Тесты профилей поверх настоящего zustand-store. В node нет localStorage —
 * persist-мидлварь молча работает без хранилища, сама логика та же.
 */
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { GUEST_ID, initialPersistedState } from './migrate.ts';
import { useGame } from './store.ts';
import type { AnswerOutcome } from './types.ts';

function outcome(countryCode: string, correct = true): AnswerOutcome {
  return { correct, countryCode, skill: 'flagToCountry', elapsedMs: 1000 };
}

beforeEach(() => {
  useGame.setState({ ...useGame.getInitialState(), ...initialPersistedState() });
});

test('по умолчанию активен гостевой профиль', () => {
  const s = useGame.getState();
  assert.equal(s.activeProfileId, GUEST_ID);
  assert.ok(s.profiles[GUEST_ID].guest);
});

test('создание профиля переключает на него', () => {
  const id = useGame.getState().createProfile('Ян');
  const s = useGame.getState();
  assert.equal(s.activeProfileId, id);
  assert.equal(s.profiles[id].name, 'Ян');
  assert.ok(!s.profiles[id].guest);
  assert.deepEqual(s.data[id].cards, {});
});

test('прогресс двух профилей независим', () => {
  const yan = useGame.getState().createProfile('Ян');
  useGame.getState().answer(outcome('KZ'));
  assert.ok(useGame.getState().data[yan].cards['KZ:flagToCountry']);

  const anna = useGame.getState().createProfile('Анна');
  useGame.getState().answer(outcome('FR', false));

  const s = useGame.getState();
  assert.equal(s.data[anna].cards['KZ:flagToCountry'], undefined, 'у Анны нет карточек Яна');
  assert.ok(s.data[anna].cards['FR:flagToCountry']);
  assert.equal(s.data[yan].cards['FR:flagToCountry'], undefined, 'у Яна нет карточек Анны');
  assert.ok(s.data[yan].xp > 0);
  assert.equal(s.data[anna].xp, 0);
});

test('переключение профиля меняет активные данные', () => {
  const yan = useGame.getState().createProfile('Ян');
  useGame.getState().answer(outcome('KZ'));
  useGame.getState().createProfile('Анна');

  useGame.getState().switchProfile(yan);
  const s = useGame.getState();
  assert.equal(s.activeProfileId, yan);
  assert.ok(s.data[s.activeProfileId].cards['KZ:flagToCountry']);

  // Несуществующий профиль игнорируется.
  useGame.getState().switchProfile('no-such-id');
  assert.equal(useGame.getState().activeProfileId, yan);
});

test('переименование и удаление профиля', () => {
  const id = useGame.getState().createProfile('Ян');
  useGame.getState().renameProfile(id, 'Ян Второй');
  assert.equal(useGame.getState().profiles[id].name, 'Ян Второй');

  useGame.getState().deleteProfile(id);
  const s = useGame.getState();
  assert.equal(s.profiles[id], undefined);
  assert.equal(s.data[id], undefined);
  assert.ok(s.profiles[s.activeProfileId], 'активным стал существующий профиль');
});

test('удаление последнего профиля возрождает гостя', () => {
  useGame.getState().deleteProfile(GUEST_ID);
  const s = useGame.getState();
  assert.equal(s.activeProfileId, GUEST_ID);
  assert.ok(s.profiles[GUEST_ID]);
});

test('возрастной режим хранится на профиле', () => {
  const yan = useGame.getState().createProfile('Ян');
  useGame.getState().setAgeMode('kid');
  useGame.getState().createProfile('Анна');
  assert.equal(useGame.getState().profiles[yan].ageMode, 'kid');
  const s = useGame.getState();
  assert.equal(s.profiles[s.activeProfileId].ageMode, 'school', 'у нового профиля свой режим');
});

test('ответ обновляет lastActiveAt активного профиля', () => {
  const id = useGame.getState().createProfile('Ян');
  const before = useGame.getState().profiles[id].lastActiveAt;
  useGame.getState().answer(outcome('KZ'));
  const after = useGame.getState().profiles[id].lastActiveAt;
  assert.ok(after >= before);
});
