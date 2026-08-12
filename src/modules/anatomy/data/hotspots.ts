import type { RegionId } from '../types.ts';

/**
 * Зоны структур на базовых иллюстрациях регионов.
 *
 * Координаты — проценты от базовой картинки (`public/anatomy/base/<регион>.webp`),
 * зона задана эллипсом: центр (cx, cy) и радиусы (rx, ry). Эллипс, а не контур,
 * выбран сознательно: обводить кость по краю поверх готового рисунка — это
 * снова рисовать схему, а для «покажи на теле» и подсветки достаточно области.
 *
 * Попадание считается по ближайшему центру (см. `pickHotspot`), поэтому мелкие
 * зоны — рёбра на полном скелете, малоберцовая кость — остаются нажимаемыми:
 * мёртвых зон между ними нет.
 *
 * ВАЖНО: числа привязаны к кадру. Изменили crop в scripts/anatomy-crops.mjs —
 * перечитайте зоны через `node scripts/anatomy-hotspots-preview.mjs <регион>`:
 * скрипт рисует поверх картинки сетку с шагом 5 % и текущие зоны.
 */
export interface Hotspot {
  structureId: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export const HOTSPOTS: Record<RegionId, Hotspot[]> = {
  organs_main: [
    { structureId: 'brain', cx: 44, cy: 5, rx: 14, ry: 4 },
    { structureId: 'lungs', cx: 31, cy: 35, rx: 10, ry: 8 },
    { structureId: 'heart', cx: 51, cy: 37, rx: 8, ry: 6 },
    { structureId: 'liver', cx: 37, cy: 53, rx: 15, ry: 5 },
    { structureId: 'kidneys', cx: 61, cy: 52, rx: 6, ry: 4 },
  ],
  organs_digestive: [
    { structureId: 'gallbladder', cx: 40, cy: 62, rx: 8, ry: 2 },
    { structureId: 'stomach', cx: 68, cy: 60, rx: 13, ry: 5 },
    { structureId: 'spleen', cx: 81, cy: 62.5, rx: 4.5, ry: 2.5 },
    { structureId: 'pancreas', cx: 57, cy: 66.5, rx: 12, ry: 2 },
    { structureId: 'intestines', cx: 52, cy: 82, rx: 26, ry: 12 },
  ],
  skull: [
    { structureId: 'parietal_bone', cx: 25, cy: 30, rx: 14, ry: 16 },
    { structureId: 'frontal_bone', cx: 82, cy: 20, rx: 9, ry: 11 },
    { structureId: 'temporal_bone', cx: 43, cy: 47, rx: 11, ry: 11 },
    { structureId: 'occipital_bone', cx: 13, cy: 60, rx: 8, ry: 12 },
    { structureId: 'mandible', cx: 78, cy: 87, rx: 17, ry: 8 },
  ],
  arm: [
    { structureId: 'humerus', cx: 68, cy: 20, rx: 10, ry: 15 },
    { structureId: 'radius', cx: 37, cy: 57, rx: 5, ry: 10 },
    { structureId: 'ulna', cx: 50, cy: 57, rx: 5, ry: 10 },
    { structureId: 'carpals', cx: 42, cy: 74, rx: 9, ry: 3 },
    { structureId: 'phalanges_hand', cx: 28, cy: 86, rx: 20, ry: 7 },
  ],
  leg: [
    { structureId: 'femur', cx: 48, cy: 25, rx: 10, ry: 14 },
    { structureId: 'patella', cx: 66, cy: 43, rx: 11, ry: 3.5 },
    { structureId: 'tibia', cx: 66, cy: 62, rx: 8, ry: 14 },
    { structureId: 'fibula', cx: 46, cy: 62, rx: 5, ry: 13 },
    { structureId: 'foot_bones', cx: 57, cy: 89, rx: 25, ry: 7 },
  ],
  torso_bones: [
    { structureId: 'clavicle', cx: 24, cy: 5, rx: 13, ry: 2.5 },
    { structureId: 'scapula', cx: 10, cy: 11, rx: 6, ry: 7 },
    { structureId: 'sternum', cx: 51, cy: 23, rx: 3.5, ry: 16 },
    { structureId: 'ribs', cx: 25, cy: 30, rx: 10, ry: 14 },
    { structureId: 'spine', cx: 51, cy: 58, rx: 7, ry: 12 },
    { structureId: 'pelvis', cx: 52, cy: 84, rx: 25, ry: 12 },
  ],
  muscles: [
    { structureId: 'trapezius', cx: 26, cy: 16.5, rx: 6, ry: 2.5 },
    { structureId: 'deltoid', cx: 17, cy: 21, rx: 6, ry: 3.5 },
    { structureId: 'pectoralis', cx: 31, cy: 25.5, rx: 9, ry: 4 },
    { structureId: 'biceps', cx: 10, cy: 31, rx: 5, ry: 4 },
    { structureId: 'rectus_abdominis', cx: 41, cy: 36, rx: 10, ry: 5 },
    { structureId: 'quadriceps', cx: 30, cy: 60, rx: 11, ry: 7 },
  ],
  /**
   * Итоговая проверка на целом скелете. Костей черепа, лучевой и локтевой здесь
   * нет намеренно: в масштабе всей фигуры они занимают считаные пиксели, и
   * попасть по ним было бы вопросом меткости, а не знания. Их спрашивают в
   * своих регионах — «Череп» и «Рука».
   */
  skeleton: [
    { structureId: 'mandible', cx: 44, cy: 8.8, rx: 6, ry: 1.5 },
    { structureId: 'clavicle', cx: 34, cy: 16, rx: 7, ry: 1.2 },
    { structureId: 'scapula', cx: 19, cy: 19, rx: 5, ry: 3 },
    { structureId: 'sternum', cx: 46, cy: 24, rx: 3, ry: 6 },
    { structureId: 'ribs', cx: 30, cy: 25, rx: 7, ry: 6 },
    { structureId: 'spine', cx: 47, cy: 34, rx: 4, ry: 4 },
    { structureId: 'pelvis', cx: 45, cy: 44, rx: 20, ry: 5 },
    { structureId: 'humerus', cx: 15, cy: 24, rx: 4, ry: 7 },
    { structureId: 'carpals', cx: 85, cy: 47, rx: 4, ry: 2 },
    { structureId: 'phalanges_hand', cx: 84, cy: 52, rx: 5, ry: 3 },
    { structureId: 'femur', cx: 26, cy: 56, rx: 5, ry: 6 },
    { structureId: 'patella', cx: 26, cy: 63.5, rx: 4, ry: 1.5 },
    { structureId: 'tibia', cx: 29, cy: 75, rx: 3, ry: 9 },
    { structureId: 'fibula', cx: 23.5, cy: 75, rx: 2.5, ry: 9 },
    { structureId: 'foot_bones', cx: 26, cy: 91, rx: 8, ry: 4 },
  ],
};

/** Зона конкретной структуры в регионе. */
export function hotspotFor(region: RegionId, structureId: string): Hotspot | null {
  return HOTSPOTS[region]?.find((spot) => spot.structureId === structureId) ?? null;
}

/** Структуры, которые вообще можно спросить на иллюстрации региона. */
export function structuresWithHotspot(region: RegionId): string[] {
  return (HOTSPOTS[region] ?? []).map((spot) => spot.structureId);
}

/**
 * Что выбрал ребёнок, ткнув в точку (проценты от картинки).
 *
 * Берётся ближайшая зона в нормированных радиусах, а не строгое попадание
 * внутрь эллипса: между костями не остаётся мёртвых зон, а промах дальше двух
 * радиусов от всего сразу не засчитывается ни за что.
 */
export function pickHotspot(region: RegionId, x: number, y: number): string | null {
  let best: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const spot of HOTSPOTS[region] ?? []) {
    const dx = (x - spot.cx) / spot.rx;
    const dy = (y - spot.cy) / spot.ry;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = spot.structureId;
    }
  }
  return bestDistance <= 4 ? best : null;
}
