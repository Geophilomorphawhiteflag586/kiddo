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
    // Порог невысокий: жёлчный пузырь, селезёнка и поджелудочная на плакате
    // нарисованы мелко, а другого источника для них нет. Всё, что меньше, —
    // почти наверняка промах рамки, а не особенность рисунка.
    assert.ok(image.width >= 70, `${id}: слишком узкая иллюстрация (${image.width})`);
    assert.ok(image.height >= 70, `${id}: слишком низкая иллюстрация (${image.height})`);
    // Номер рисунка есть только у иллюстраций из учебника.
    if (image.source === 'openstax') assert.match(image.figure ?? '', /^\d+\.\d+$/);
    else assert.equal(image.figure, undefined, `${id}: у плаката не бывает номера рисунка`);
  }
});

test('structureImage возвращает null для структур без иллюстрации', () => {
  assert.equal(structureImage('frontal_bone'), null);
  assert.ok(structureImage('femur'));
});

test('органы взяты с плаката, кости — из учебника', () => {
  assert.equal(structureImage('liver')?.source, 'poster');
  assert.equal(structureImage('heart')?.source, 'poster');
  assert.equal(structureImage('femur')?.source, 'openstax');
});

test('allHaveImages требует иллюстрации у всех вариантов', () => {
  assert.equal(allHaveImages([]), false);
  assert.equal(allHaveImages(['femur', 'tibia', 'fibula']), true);
  assert.equal(allHaveImages(['femur', 'frontal_bone']), false);
});
