/**
 * Сгенерировано `npm run assets:anatomy` — вручную не править.
 *
 * Крупный план структуры для вопросов «Что это?» и «Найди изображение».
 * Два источника: органы нарезаны с анатомического плаката (там они нарисованы
 * изолированно и в цвете), кости — из учебника OpenStax. Структуры, которых
 * здесь нет, показываются базовой иллюстрацией региона с обведённой областью.
 */
export type ImageSource = 'openstax' | 'poster';

export interface StructureImage {
  src: string;
  width: number;
  height: number;
  source: ImageSource;
  /** Номер рисунка в учебнике — только для источника openstax. */
  figure?: string;
}

export const STRUCTURE_IMAGES: Record<string, StructureImage> = {
  biceps: { src: '/anatomy/biceps.webp', width: 900, height: 1149, source: 'openstax', figure: '11.4' },
  brain: { src: '/anatomy/brain.webp', width: 180, height: 187, source: 'poster' },
  carpals: { src: '/anatomy/carpals.webp', width: 274, height: 212, source: 'openstax', figure: '8.7' },
  clavicle: { src: '/anatomy/clavicle.webp', width: 522, height: 231, source: 'openstax', figure: '8.3' },
  deltoid: { src: '/anatomy/deltoid.webp', width: 379, height: 462, source: 'openstax', figure: '11.23' },
  femur: { src: '/anatomy/femur.webp', width: 192, height: 825, source: 'openstax', figure: '8.16' },
  fibula: { src: '/anatomy/fibula.webp', width: 124, height: 1502, source: 'openstax', figure: '8.18' },
  foot_bones: { src: '/anatomy/foot_bones.webp', width: 275, height: 1066, source: 'openstax', figure: '8.19' },
  gallbladder: { src: '/anatomy/gallbladder.webp', width: 86, height: 82, source: 'poster' },
  heart: { src: '/anatomy/heart.webp', width: 124, height: 180, source: 'poster' },
  intestines: { src: '/anatomy/intestines.webp', width: 160, height: 164, source: 'poster' },
  kidneys: { src: '/anatomy/kidneys.webp', width: 192, height: 138, source: 'poster' },
  liver: { src: '/anatomy/liver.webp', width: 161, height: 138, source: 'poster' },
  lungs: { src: '/anatomy/lungs.webp', width: 165, height: 198, source: 'poster' },
  mandible: { src: '/anatomy/mandible.webp', width: 384, height: 273, source: 'openstax', figure: '7.15' },
  pancreas: { src: '/anatomy/pancreas.webp', width: 154, height: 77, source: 'poster' },
  pectoralis: { src: '/anatomy/pectoralis.webp', width: 658, height: 818, source: 'openstax', figure: '11.23' },
  pelvis: { src: '/anatomy/pelvis.webp', width: 663, height: 589, source: 'openstax', figure: '8.12' },
  phalanges_hand: { src: '/anatomy/phalanges_hand.webp', width: 361, height: 511, source: 'openstax', figure: '8.7' },
  quadriceps: { src: '/anatomy/quadriceps.webp', width: 266, height: 914, source: 'openstax', figure: '11.29' },
  rectus_abdominis: { src: '/anatomy/rectus_abdominis.webp', width: 126, height: 345, source: 'openstax', figure: '11.16' },
  ribs: { src: '/anatomy/ribs.webp', width: 395, height: 576, source: 'openstax', figure: '7.32' },
  scapula: { src: '/anatomy/scapula.webp', width: 282, height: 353, source: 'openstax', figure: '8.4' },
  spine: { src: '/anatomy/spine.webp', width: 240, height: 1042, source: 'openstax', figure: '7.20' },
  spleen: { src: '/anatomy/spleen.webp', width: 82, height: 73, source: 'poster' },
  sternum: { src: '/anatomy/sternum.webp', width: 149, height: 580, source: 'openstax', figure: '7.32' },
  stomach: { src: '/anatomy/stomach.webp', width: 169, height: 154, source: 'poster' },
  tibia: { src: '/anatomy/tibia.webp', width: 199, height: 1575, source: 'openstax', figure: '8.18' },
  trapezius: { src: '/anatomy/trapezius.webp', width: 428, height: 536, source: 'openstax', figure: '11.15' },
};

/** Иллюстрация структуры, если она есть. */
export function structureImage(id: string): StructureImage | null {
  return STRUCTURE_IMAGES[id] ?? null;
}

/** Все ли структуры набора показываются фотографией: варианты не должны различаться по виду. */
export function allHaveImages(ids: string[]): boolean {
  return ids.length > 0 && ids.every((id) => id in STRUCTURE_IMAGES);
}
