import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyTone, stripTone, toneOf, toneVariants } from './pinyin.ts';

test('тон определяется по диакритике', () => {
  assert.equal(toneOf('mā'), 1);
  assert.equal(toneOf('má'), 2);
  assert.equal(toneOf('mǎ'), 3);
  assert.equal(toneOf('mà'), 4);
  assert.equal(toneOf('ma'), 5, 'без значка — нейтральный');
  assert.equal(toneOf('nǐ'), 3);
  assert.equal(toneOf('xuésheng'), 2);
});

test('снятие тона возвращает чистый слог, ü сохраняется', () => {
  assert.equal(stripTone('nǐ'), 'ni');
  assert.equal(stripTone('lǜ'), 'lü');
  assert.equal(stripTone('zhōng'), 'zhong');
  assert.equal(stripTone('ér'), 'er');
});

test('тон ставится по правилам пиньиня', () => {
  assert.equal(applyTone('ni', 3), 'nǐ');
  assert.equal(applyTone('hao', 3), 'hǎo', 'приоритет у a');
  assert.equal(applyTone('xie', 4), 'xiè', 'приоритет у e');
  assert.equal(applyTone('guo', 2), 'guó', 'приоритет у o');
  assert.equal(applyTone('liu', 4), 'liù', 'в iu знак на последней гласной');
  assert.equal(applyTone('gui', 1), 'guī', 'в ui знак на последней гласной');
  assert.equal(applyTone('lü', 4), 'lǜ');
  assert.equal(applyTone('ma', 5), 'ma', 'нейтральный тон без значка');
});

test('снятие и постановка тона — обратимые операции', () => {
  for (const pinyin of ['nǐ', 'hǎo', 'zhōng', 'guó', 'liù', 'lǜ', 'ér', 'wǒ', 'shì', 'xué']) {
    assert.equal(applyTone(stripTone(pinyin), toneOf(pinyin)), pinyin, pinyin);
  }
});

test('тоновые варианты дают ровно четыре разных слога', () => {
  const variants = toneVariants('nǐ');
  assert.deepEqual(variants, ['nī', 'ní', 'nǐ', 'nì']);
  assert.equal(new Set(variants).size, 4);
  assert.ok(variants.includes('nǐ'), 'исходный слог входит в набор');

  assert.deepEqual(toneVariants('ma'), ['mā', 'má', 'mǎ', 'mà']);
});
