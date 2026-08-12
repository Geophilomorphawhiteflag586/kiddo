import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pickVoice, type VoiceLike } from './speech.ts';

const voice = (name: string, lang: string, localService = true, isDefault = false): VoiceLike => ({
  name,
  lang,
  localService,
  default: isDefault,
});

test('точное совпадение языка важнее общего', () => {
  const list = [voice('Generic Chinese', 'zh'), voice('Huihui', 'zh-CN')];
  assert.equal(pickVoice(list, 'zh-CN')?.name, 'Huihui');
});

test('локальный голос предпочитается облачному — он без задержки', () => {
  const list = [voice('Cloud Chinese', 'zh-CN', false), voice('Local Chinese', 'zh-CN', true)];
  assert.equal(pickVoice(list, 'zh-CN')?.name, 'Local Chinese');
});

test('кантонский не берётся для путунхуа, даже если он единственный zh', () => {
  const list = [voice('Sinji', 'zh-HK'), voice('Yaoyao', 'zh-CN', false)];
  assert.equal(pickVoice(list, 'zh-CN')?.name, 'Yaoyao', 'zh-HK читает по-кантонски');

  // Если другого нет — лучше кантонский, чем полное молчание.
  assert.equal(pickVoice([voice('Sinji', 'zh-HK')], 'zh-CN')?.name, 'Sinji');
});

test('тайваньский вариант годится как запасной для zh-CN', () => {
  const list = [voice('Tingting', 'zh-TW'), voice('Milena', 'ru-RU')];
  assert.equal(pickVoice(list, 'zh-CN')?.name, 'Tingting');
});

test('чужой язык не подставляется вместо нужного', () => {
  const list = [voice('Milena', 'ru-RU'), voice('Alex', 'en-US')];
  assert.equal(pickVoice(list, 'zh-CN'), null, 'лучше молчание, чем китайский русским голосом');
});

test('регистр и подчёркивание в коде языка не мешают', () => {
  assert.equal(pickVoice([voice('Huihui', 'ZH_CN')], 'zh-CN')?.name, 'Huihui');
});

test('для английского подходит любой региональный вариант', () => {
  const list = [voice('Daniel', 'en-GB'), voice('Milena', 'ru-RU')];
  assert.equal(pickVoice(list, 'en-US')?.name, 'Daniel');
});

test('пустой список голосов не роняет выбор', () => {
  assert.equal(pickVoice([], 'zh-CN'), null);
});
