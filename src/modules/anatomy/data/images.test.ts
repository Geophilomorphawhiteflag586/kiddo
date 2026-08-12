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
    // Порог по длинной стороне. Он невысокий: жёлчный пузырь и селезёнка на
    // плакате нарисованы мелко, а другого источника для них нет. Всё, что
    // меньше, — почти наверняка промах рамки, а не особенность рисунка.
    assert.ok(
      Math.max(image.width, image.height) >= 80,
      `${id}: слишком мелкая иллюстрация (${image.width}x${image.height})`,
    );
    // Короткая сторона может быть небольшой честно: ключица плоская, фаланги
    // узкие. Проверяем только, что рамка вообще во что-то попала.
    assert.ok(image.width >= 40, `${id}: слишком узкая иллюстрация (${image.width})`);
    assert.ok(image.height >= 40, `${id}: слишком низкая иллюстрация (${image.height})`);
    // Номер рисунка есть только у иллюстраций из учебника.
    if (image.source === 'openstax') assert.match(image.figure ?? '', /^\d+\.\d+$/);
    else assert.equal(image.figure, undefined, `${id}: у плаката не бывает номера рисунка`);
  }
});

test('structureImage возвращает null для структур без иллюстрации', () => {
  assert.equal(structureImage('frontal_bone'), null);
  assert.ok(structureImage('femur'));
});

test('почти всё взято с плаката, остатки из учебника помечены', () => {
  // Плакат — основной источник. Из учебника остались только структуры, которые
  // на плакате нарисованы парой и потому подсказывали бы неверный ответ.
  assert.equal(structureImage('liver')?.source, 'poster');
  assert.equal(structureImage('femur')?.source, 'poster');
  assert.equal(structureImage('quadriceps')?.source, 'poster');
  assert.equal(structureImage('tibia')?.source, 'openstax');

  const poster = Object.values(STRUCTURE_IMAGES).filter((i) => i.source === 'poster').length;
  assert.ok(poster >= 25, `с плаката всего ${poster} — слишком мало`);
});

test('allHaveImages требует иллюстрации у всех вариантов', () => {
  assert.equal(allHaveImages([]), false);
  assert.equal(allHaveImages(['femur', 'tibia', 'fibula']), true);
  assert.equal(allHaveImages(['femur', 'frontal_bone']), false);
});
