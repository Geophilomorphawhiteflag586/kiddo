import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STRUCTURES } from './structures.ts';
import { STRUCTURE_IMAGES, allHaveImages, structureImage } from './images.ts';

const ids = new Set(STRUCTURES.map((structure) => structure.id));

test('каждая иллюстрация относится к существующей структуре', () => {
  for (const id of Object.keys(STRUCTURE_IMAGES)) {
    assert.ok(ids.has(id), `иллюстрация ${id} не соответствует ни одной структуре`);
  }
});

test('путь и размеры заполнены', () => {
  for (const [id, image] of Object.entries(STRUCTURE_IMAGES)) {
    assert.equal(image.src, `/anatomy/${id}.webp`);
    assert.ok(image.width >= 100, `${id}: слишком узкая иллюстрация (${image.width})`);
    assert.ok(image.height >= 100, `${id}: слишком низкая иллюстрация (${image.height})`);
    assert.match(image.figure, /^\d+\.\d+$/);
  }
});

test('structureImage возвращает null для структур без иллюстрации', () => {
  assert.equal(structureImage('frontal_bone'), null);
  assert.ok(structureImage('femur'));
});

test('allHaveImages требует иллюстрации у всех вариантов', () => {
  assert.equal(allHaveImages([]), false);
  assert.equal(allHaveImages(['femur', 'tibia', 'fibula']), true);
  assert.equal(allHaveImages(['femur', 'frontal_bone']), false);
});
