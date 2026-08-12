import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OPTION_COUNT, SESSION_LENGTH } from './config.ts';
import { applyEnglishAnswer, emptyEnglishProgress } from './progress.ts';
import { buildOptions, buildSession, modesFor, pickMode } from './session.ts';
import type { EnglishAnswerRecord, EnglishProgress } from './types.ts';
import { WORDS, getWord } from './words.ts';

const NOW = Date.UTC(2026, 7, 11, 9);

/** Детерминированный ГПСЧ — тесты не должны мигать. */
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

function answer(partial: Partial<EnglishAnswerRecord>): EnglishAnswerRecord {
  return {
    wordId: 'apple',
    chosenId: 'apple',
    mode: 'image-to-word',
    isCorrect: true,
    responseTimeMs: 2000,
    ...partial,
  };
}

test('варианты: нужное число, без дубликатов, с правильным ответом', () => {
  const rng = seeded(1);
  for (const id of ['apple', 'run', 'elephant', 'ten']) {
    const word = getWord(id)!;
    const options = buildOptions(word, emptyEnglishProgress(), WORDS, OPTION_COUNT, rng);
    assert.equal(options.length, OPTION_COUNT, id);
    assert.equal(new Set(options).size, OPTION_COUNT, `дубликаты для ${id}`);
    assert.ok(options.includes(id), `нет правильного ответа для ${id}`);
  }
});

test('варианты всегда одного типа: к глаголу не подставляется существительное', () => {
  const rng = seeded(2);
  for (const id of ['run', 'eat', 'drive', 'sleep']) {
    const word = getWord(id)!;
    for (let i = 0; i < 20; i++) {
      const options = buildOptions(word, emptyEnglishProgress(), WORDS, OPTION_COUNT, rng);
      for (const option of options) {
        assert.equal(getWord(option)!.type, 'verb', `${id}: среди вариантов существительное`);
      }
    }
  }
});

test('перепутанное слово попадает в варианты первым', () => {
  let progress = emptyEnglishProgress();
  progress = applyEnglishAnswer(
    progress,
    answer({ wordId: 'apple', chosenId: 'orange', isCorrect: false }),
    NOW,
  ).progress;

  const options = buildOptions(getWord('apple')!, progress, WORDS, OPTION_COUNT, seeded(3));
  assert.ok(options.includes('orange'), 'двойник должен вернуться в задание');
});

test('режимы открываются по мере освоения слова', () => {
  assert.deepEqual(modesFor(0), ['image-to-word']);
  assert.deepEqual(modesFor(35), ['image-to-word', 'word-to-image']);
  assert.deepEqual(modesFor(90), ['image-to-word', 'word-to-image', 'audio-to-image']);

  const rng = seeded(4);
  for (let i = 0; i < 50; i++) {
    assert.equal(pickMode(0, rng), 'image-to-word', 'новое слово — только узнавание картинки');
  }
});

test('сессия — 10 вопросов без повторов слова', () => {
  const session = buildSession({ progress: emptyEnglishProgress(), now: NOW, rng: seeded(5) });
  assert.equal(session.length, SESSION_LENGTH);
  assert.equal(new Set(session.map((q) => q.wordId)).size, session.length);
  for (const question of session) {
    assert.equal(question.options.length, OPTION_COUNT);
    assert.ok(question.options.includes(question.wordId));
  }
});

test('новичку сначала дают простые слова', () => {
  const session = buildSession({ progress: emptyEnglishProgress(), now: NOW, rng: seeded(6) });
  for (const question of session) {
    assert.equal(getWord(question.wordId)!.difficulty, 1, `${question.wordId} слишком сложное`);
  }
});

test('ошибки и просроченные повторения идут раньше новых слов', () => {
  let progress = emptyEnglishProgress();
  // Ошиблись в elephant, а dog выучили давно — обе карточки должны вернуться.
  progress = applyEnglishAnswer(
    progress,
    answer({ wordId: 'elephant', chosenId: 'horse', isCorrect: false }),
    NOW - 60 * 60 * 1000,
  ).progress;
  progress = applyEnglishAnswer(
    progress,
    answer({ wordId: 'dog', chosenId: 'dog' }),
    NOW - 30 * 24 * 60 * 60 * 1000,
  ).progress;

  const session = buildSession({ progress, now: NOW, rng: seeded(7) });
  const firstTwo = session.slice(0, 2).map((q) => q.wordId);
  assert.ok(firstTwo.includes('elephant'), `ошибка не в начале: ${firstTwo.join(',')}`);
  assert.ok(firstTwo.includes('dog'), `просроченное повторение не в начале: ${firstTwo.join(',')}`);
});

test('сессия смешивает знакомые слова с новыми', () => {
  let progress: EnglishProgress = emptyEnglishProgress();
  for (const id of ['apple', 'dog', 'car']) {
    progress = applyEnglishAnswer(progress, answer({ wordId: id, chosenId: id }), NOW - 86_400_000)
      .progress;
  }
  const session = buildSession({ progress, now: NOW, rng: seeded(8) });
  const known = session.filter((q) => progress.cards[q.wordId]).length;
  assert.ok(known > 0, 'нет повторения знакомых слов');
  assert.ok(known < session.length, 'нет новых слов');
});

test('режим работы над ошибками берёт только слова с ошибками', () => {
  let progress = emptyEnglishProgress();
  for (const id of ['elephant', 'window']) {
    progress = applyEnglishAnswer(
      progress,
      answer({ wordId: id, chosenId: 'car', isCorrect: false }),
      NOW,
    ).progress;
  }
  progress = applyEnglishAnswer(progress, answer({ wordId: 'apple', chosenId: 'apple' }), NOW)
    .progress;

  const session = buildSession({ progress, now: NOW, mistakesOnly: true, rng: seeded(9) });
  assert.equal(session.length, 2);
  assert.deepEqual(session.map((q) => q.wordId).sort(), ['elephant', 'window']);
});

test('режим повторения пуст, если повторять нечего', () => {
  const progress = applyEnglishAnswer(
    emptyEnglishProgress(),
    answer({ wordId: 'apple', chosenId: 'apple' }),
    NOW,
  ).progress;
  const session = buildSession({ progress, now: NOW, reviewOnly: true, rng: seeded(10) });
  assert.equal(session.length, 0, 'свежая карточка не должна попадать в повторение');
});

test('маленький пул не роняет подбор вариантов', () => {
  const pool = WORDS.filter((w) => w.category === 'drinks');
  const session = buildSession({
    progress: emptyEnglishProgress(),
    pool,
    length: 5,
    now: NOW,
    rng: seeded(11),
  });
  assert.ok(session.length > 0);
  for (const question of session) {
    assert.equal(new Set(question.options).size, question.options.length);
    assert.ok(question.options.includes(question.wordId));
  }
});
