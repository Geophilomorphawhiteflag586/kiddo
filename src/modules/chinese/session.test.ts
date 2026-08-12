import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHARACTERS, canSpeakPinyin, getCharacter } from './characters.ts';
import { OPTION_COUNT, SESSION_LENGTH } from './config.ts';
import {
  cardsOfCharacter,
  characterPercent,
  isLearned,
  skillLevel,
  summarize,
  unlockedCount,
} from './mastery.ts';
import { finalOf, initialOf, soundsSimilar, stripTone } from './pinyin.ts';
import {
  applyChineseAnswer,
  emptyChineseProgress,
  normalizeChineseProgress,
  topCharConfusions,
  topPinyinConfusions,
  weakCharacters,
} from './progress.ts';
import { buildQuestion, buildSession, modesFor } from './session.ts';
import type { ChineseAnswerRecord, ChineseProgress } from './types.ts';

const NOW = Date.UTC(2026, 7, 11, 9);
const ALL_IDS = CHARACTERS.map((c) => c.id);

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

function answer(partial: Partial<ChineseAnswerRecord>): ChineseAnswerRecord {
  return {
    characterId: '你',
    skill: 'pronunciationRecognition',
    mode: 'character-to-pinyin',
    selectedAnswer: 'nǐ',
    correctAnswer: 'nǐ',
    isCorrect: true,
    responseTimeMs: 2500,
    ...partial,
  };
}

function repeat(progress: ChineseProgress, times: number, partial: Partial<ChineseAnswerRecord> = {}) {
  let current = progress;
  for (let i = 0; i < times; i++) {
    current = applyChineseAnswer(current, answer(partial), NOW).progress;
  }
  return current;
}

/* ------------------------------- варианты -------------------------------- */

test('варианты пиньиня строятся из тоновых двойников', () => {
  const target = getCharacter('你')!;
  const question = buildQuestion(
    target,
    'character-to-pinyin',
    emptyChineseProgress(),
    CHARACTERS,
    seeded(1),
  );

  assert.equal(question.options.length, OPTION_COUNT);
  assert.equal(new Set(question.options).size, OPTION_COUNT, 'дубликаты вариантов');
  assert.ok(question.options.includes('nǐ'));
  assert.equal(question.answer, 'nǐ');
  assert.equal(question.skill, 'pronunciationRecognition');

  // Тоновые двойники есть в базе не для каждого чтения (у 你 это только ní),
  // поэтому требуем: хотя бы один двойник и все варианты — созвучные.
  const twins = question.options.filter((p) => p !== 'nǐ' && stripTone(p) === 'ni');
  assert.ok(twins.length >= 1, `нет тонового двойника: ${question.options.join(' ')}`);
  for (const option of question.options) {
    if (option === 'nǐ') continue;
    assert.ok(
      soundsSimilar('nǐ', option),
      `«${option}» не созвучен «nǐ» — как дистрактор бесполезен`,
    );
  }
});

test('созвучность слогов определяется по инициали и финали', () => {
  assert.equal(initialOf('nǐ'), 'n');
  assert.equal(finalOf('nǐ'), 'i');
  assert.equal(initialOf('zhōng'), 'zh');
  assert.equal(finalOf('zhōng'), 'ong');
  assert.equal(initialOf('ér'), '', 'слог без инициали');

  assert.ok(soundsSimilar('nǐ', 'nì'), 'тоновые двойники');
  assert.ok(soundsSimilar('nǐ', 'lǐ'), 'та же финаль');
  assert.ok(soundsSimilar('nǐ', 'nán'), 'та же инициаль');
  assert.ok(!soundsSimilar('nǐ', 'chāo'), 'ничего общего');
  assert.ok(!soundsSimilar('nǐ', 'nǐ'), 'слог не похож сам на себя');
});

test('каждый вариант пиньиня можно произнести вслух', () => {
  // Слог без своего иероглифа синтез прочитает как английские буквы —
  // такой вариант в задании бесполезен.
  for (const id of ['你', '人', '水', '大', '学', '不', '天', '月']) {
    const target = getCharacter(id)!;
    for (const mode of ['character-to-pinyin', 'audio-to-pinyin'] as const) {
      const question = buildQuestion(
        target,
        mode,
        emptyChineseProgress(),
        CHARACTERS,
        seeded(id.charCodeAt(0)),
      );
      for (const option of question.options) {
        assert.ok(
          canSpeakPinyin(option),
          `${id}/${mode}: «${option}» нечем озвучить — нет иероглифа с таким чтением`,
        );
      }
    }
  }
});

test('варианты-иероглифы уникальны и содержат правильный ответ', () => {
  for (const id of ['人', '水', '大', '学']) {
    const target = getCharacter(id)!;
    const question = buildQuestion(
      target,
      'pinyin-to-character',
      emptyChineseProgress(),
      CHARACTERS,
      seeded(2),
    );
    assert.equal(question.options.length, OPTION_COUNT, id);
    assert.equal(new Set(question.options).size, OPTION_COUNT, id);
    assert.ok(question.options.includes(id));
    assert.equal(question.skill, 'characterRecognition');
  }
});

test('варианты значений не повторяются', () => {
  const target = getCharacter('人')!;
  for (let i = 0; i < 20; i++) {
    const question = buildQuestion(
      target,
      'character-to-meaning',
      emptyChineseProgress(),
      CHARACTERS,
      seeded(3 + i),
    );
    assert.equal(new Set(question.options).size, question.options.length);
    assert.ok(question.options.includes(target.meaningRu));
    assert.equal(question.skill, 'meaningRecognition');
  }
});

test('перепутанный иероглиф возвращается в варианты', () => {
  let progress = emptyChineseProgress();
  progress = applyChineseAnswer(
    progress,
    answer({
      characterId: '你',
      skill: 'characterRecognition',
      mode: 'pinyin-to-character',
      correctAnswer: '你',
      selectedAnswer: '他',
      isCorrect: false,
    }),
    NOW,
  ).progress;

  const question = buildQuestion(
    getCharacter('你')!,
    'pinyin-to-character',
    progress,
    CHARACTERS,
    seeded(4),
  );
  assert.ok(question.options.includes('他'), 'двойник должен вернуться');
});

/* ------------------------------- путаница -------------------------------- */

test('путаница иероглифов и произношений хранится раздельно', () => {
  let progress = emptyChineseProgress();
  progress = applyChineseAnswer(
    progress,
    answer({
      characterId: '你',
      skill: 'characterRecognition',
      mode: 'pinyin-to-character',
      correctAnswer: '你',
      selectedAnswer: '他',
      isCorrect: false,
    }),
    NOW,
  ).progress;
  progress = applyChineseAnswer(
    progress,
    answer({ correctAnswer: 'nǐ', selectedAnswer: 'nì', isCorrect: false }),
    NOW,
  ).progress;

  assert.equal(progress.charConfusions['你']['他'], 1);
  assert.equal(progress.charConfusions['他']['你'], 1, 'пара симметрична');
  assert.equal(progress.pinyinConfusions['nǐ']['nì'], 1);
  assert.equal(progress.pinyinConfusions['nì']['nǐ'], 1);
  assert.equal(progress.charConfusions['nǐ'], undefined, 'матрицы не смешиваются');

  assert.equal(topCharConfusions(progress)[0].count, 1);
  assert.deepEqual(
    [topPinyinConfusions(progress)[0].a, topPinyinConfusions(progress)[0].b],
    ['nì', 'nǐ'],
  );
});

test('режим значений не пишет путаницу', () => {
  const progress = applyChineseAnswer(
    emptyChineseProgress(),
    answer({
      skill: 'meaningRecognition',
      mode: 'character-to-meaning',
      correctAnswer: 'ты',
      selectedAnswer: 'он',
      isCorrect: false,
    }),
    NOW,
  ).progress;
  assert.deepEqual(progress.charConfusions, {});
  assert.deepEqual(progress.pinyinConfusions, {});
});

/* -------------------------------- навыки --------------------------------- */

test('четыре навыка одного знака независимы', () => {
  let progress = repeat(emptyChineseProgress(), 4);
  const cards = cardsOfCharacter(progress, '你');

  assert.ok(cards.pronunciationRecognition, 'чтение прокачано');
  assert.equal(cards.listeningRecognition, undefined, 'слух не трогали');
  assert.ok(characterPercent(progress, '你') < 100, 'один навык ≠ знание знака');

  progress = repeat(progress, 4, {
    skill: 'listeningRecognition',
    mode: 'audio-to-pinyin',
  });
  assert.ok(cardsOfCharacter(progress, '你').listeningRecognition);
  assert.ok(characterPercent(progress, '你') > 0);
});

test('знак считается выученным при двух уверенных навыках', () => {
  let progress = repeat(emptyChineseProgress(), 3);
  assert.equal(isLearned(progress, '你'), false, 'одного навыка мало');

  progress = repeat(progress, 3, { skill: 'meaningRecognition', mode: 'character-to-meaning' });
  assert.equal(isLearned(progress, '你'), true);
});

test('ошибка сбрасывает серию и возвращает карточку', () => {
  let progress = repeat(emptyChineseProgress(), 4);
  const before = progress.cards['你:pronunciationRecognition'];
  progress = applyChineseAnswer(
    progress,
    answer({ selectedAnswer: 'nì', isCorrect: false }),
    NOW,
  ).progress;
  const after = progress.cards['你:pronunciationRecognition'];

  assert.equal(after.streak, 0);
  assert.equal(after.lapses, 1);
  assert.ok(after.interval < before.interval);
  // Повторения сброшены — знак снова на уровне «знакомство».
  assert.equal(skillLevel(after), 1);
});

test('XP только за верный ответ, быстрый ценнее', () => {
  const fast = applyChineseAnswer(emptyChineseProgress(), answer({ responseTimeMs: 1200 }), NOW);
  const slow = applyChineseAnswer(emptyChineseProgress(), answer({ responseTimeMs: 9000 }), NOW);
  const wrong = applyChineseAnswer(
    emptyChineseProgress(),
    answer({ selectedAnswer: 'nì', isCorrect: false }),
    NOW,
  );
  assert.ok(fast.xpGained > slow.xpGained);
  assert.equal(wrong.xpGained, 0);
});

/* ------------------------------ открытие базы ---------------------------- */

test('база открывается постепенно, а не вся сразу', () => {
  assert.equal(unlockedCount(0, 698), 20, 'новичку — первые 20 знаков');
  assert.equal(unlockedCount(15, 698), 50, 'освоил 14 из 20 — открылись 50');
  assert.ok(unlockedCount(200, 698) > 200);
  assert.equal(unlockedCount(698, 698), 698);
});

test('новичку не выдаются знаки из глубины базы', () => {
  const session = buildSession({ progress: emptyChineseProgress(), now: NOW, rng: seeded(5) });
  for (const question of session) {
    const char = getCharacter(question.characterId)!;
    assert.ok(char.frequency <= 20, `${char.character} (№${char.frequency}) рано показывать`);
  }
});

/* -------------------------------- сессия --------------------------------- */

test('сессия нужной длины, пара «знак × навык» не повторяется', () => {
  const session = buildSession({ progress: emptyChineseProgress(), now: NOW, rng: seeded(6) });
  assert.equal(session.length, SESSION_LENGTH);
  const keys = session.map((q) => `${q.characterId}:${q.skill}`);
  assert.equal(new Set(keys).size, keys.length);
  for (const question of session) {
    assert.equal(new Set(question.options).size, question.options.length);
    assert.ok(question.options.includes(question.answer));
  }
});

test('новому знаку даются только простые режимы', () => {
  assert.deepEqual(modesFor(0), ['character-to-pinyin', 'character-to-meaning']);
  assert.ok(modesFor(40).includes('pinyin-to-character'));
  assert.ok(modesFor(90).includes('audio-to-character'), 'на слух — только освоенным');

  const session = buildSession({ progress: emptyChineseProgress(), now: NOW, rng: seeded(7) });
  for (const question of session) {
    assert.ok(
      !question.mode.startsWith('audio-'),
      `новому знаку не должны давать ${question.mode}`,
    );
  }
});

test('ошибки и просроченные повторения идут раньше новых знаков', () => {
  let progress = emptyChineseProgress();
  progress = applyChineseAnswer(
    progress,
    answer({ characterId: '人', selectedAnswer: 'rèn', correctAnswer: 'rén', isCorrect: false }),
    NOW - 60 * 60 * 1000,
  ).progress;
  // 五 входит в стартовую двадцатку, поэтому попадает в открытый пул.
  progress = applyChineseAnswer(
    progress,
    answer({ characterId: '五', correctAnswer: 'wǔ', selectedAnswer: 'wǔ' }),
    NOW - 30 * 24 * 60 * 60 * 1000,
  ).progress;

  const session = buildSession({ progress, now: NOW, rng: seeded(8) });
  const firstTwo = session.slice(0, 2).map((q) => q.characterId);
  assert.ok(firstTwo.includes('人'), `ошибка не в начале: ${firstTwo.join(',')}`);
  assert.ok(firstTwo.includes('五'), `повторение не в начале: ${firstTwo.join(',')}`);
});

test('режим работы над ошибками берёт только знаки с ошибками', () => {
  let progress = emptyChineseProgress();
  progress = applyChineseAnswer(
    progress,
    answer({ characterId: '人', selectedAnswer: 'rèn', correctAnswer: 'rén', isCorrect: false }),
    NOW,
  ).progress;
  progress = applyChineseAnswer(progress, answer({ characterId: '大' }), NOW).progress;

  const session = buildSession({ progress, now: NOW, mistakesOnly: true, rng: seeded(9) });
  assert.equal(session.length, 1);
  assert.equal(session[0].characterId, '人');
});

test('слабые знаки суммируют ошибки по всем навыкам', () => {
  let progress = emptyChineseProgress();
  for (const skill of ['pronunciationRecognition', 'meaningRecognition'] as const) {
    progress = applyChineseAnswer(
      progress,
      answer({ characterId: '学', skill, selectedAnswer: 'x', isCorrect: false }),
      NOW,
    ).progress;
  }
  progress = applyChineseAnswer(
    progress,
    answer({ characterId: '水', selectedAnswer: 'x', isCorrect: false }),
    NOW,
  ).progress;

  assert.deepEqual(weakCharacters(progress, 2), ['学', '水']);
});

/* ------------------------------- сохранность ------------------------------ */

test('applyChineseAnswer не мутирует исходный прогресс', () => {
  const before = emptyChineseProgress();
  const snapshot = JSON.stringify(before);
  applyChineseAnswer(before, answer({ selectedAnswer: 'nì', isCorrect: false }), NOW);
  assert.equal(JSON.stringify(before), snapshot);
});

test('нормализация чинит частичные данные и отбрасывает мусор', () => {
  assert.deepEqual(normalizeChineseProgress(undefined), emptyChineseProgress());

  const fixed = normalizeChineseProgress({
    cards: {
      '你:pronunciationRecognition': { correct: 3 },
      'сломанный ключ': { correct: 1 },
      '你:неизвестныйНавык': { correct: 1 },
    },
    charConfusions: { '你': { '他': 2 } },
  } as never);

  assert.equal(fixed.cards['你:pronunciationRecognition'].correct, 3);
  assert.equal(fixed.cards['你:pronunciationRecognition'].wrong, 0, 'поля добиты');
  assert.equal(Object.keys(fixed.cards).length, 1, 'мусорные ключи отброшены');
  assert.equal(fixed.charConfusions['你']['他'], 2);
});

test('состояние переживает JSON-сериализацию', () => {
  const progress = repeat(emptyChineseProgress(), 3);
  assert.deepEqual(JSON.parse(JSON.stringify(progress)), progress);
});

test('сводка считает освоение от всей базы', () => {
  const progress = repeat(emptyChineseProgress(), 6);
  const summary = summarize(progress, ALL_IDS);
  assert.equal(summary.seen, 1);
  assert.ok(summary.mastery < 2, `один знак из 698 не может дать ${summary.mastery}%`);
  assert.ok(summary.bySkill.pronunciationRecognition >= 0);
  assert.equal(summary.bySkill.listeningRecognition, 0);
});
