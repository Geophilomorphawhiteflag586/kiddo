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
  biceps: { src: '/anatomy/biceps.webp', width: 63, height: 148, source: 'poster' },
  brain: { src: '/anatomy/brain.webp', width: 180, height: 187, source: 'poster' },
  carpals: { src: '/anatomy/carpals.webp', width: 274, height: 212, source: 'openstax', figure: '8.7' },
  clavicle: { src: '/anatomy/clavicle.webp', width: 124, height: 47, source: 'poster' },
  deltoid: { src: '/anatomy/deltoid.webp', width: 66, height: 146, source: 'poster' },
  femur: { src: '/anatomy/femur.webp', width: 66, height: 229, source: 'poster' },
  fibula: { src: '/anatomy/fibula.webp', width: 124, height: 1502, source: 'openstax', figure: '8.18' },
  foot_bones: { src: '/anatomy/foot_bones.webp', width: 127, height: 139, source: 'poster' },
  gallbladder: { src: '/anatomy/gallbladder.webp', width: 110, height: 102, source: 'poster' },
  heart: { src: '/anatomy/heart.webp', width: 124, height: 180, source: 'poster' },
  humerus: { src: '/anatomy/humerus.webp', width: 61, height: 173, source: 'poster' },
  intestines: { src: '/anatomy/intestines.webp', width: 160, height: 164, source: 'poster' },
  kidneys: { src: '/anatomy/kidneys.webp', width: 192, height: 138, source: 'poster' },
  liver: { src: '/anatomy/liver.webp', width: 161, height: 138, source: 'poster' },
  lungs: { src: '/anatomy/lungs.webp', width: 165, height: 198, source: 'poster' },
  mandible: { src: '/anatomy/mandible.webp', width: 112, height: 65, source: 'poster' },
  pancreas: { src: '/anatomy/pancreas.webp', width: 154, height: 77, source: 'poster' },
  pectoralis: { src: '/anatomy/pectoralis.webp', width: 110, height: 157, source: 'poster' },
  pelvis: { src: '/anatomy/pelvis.webp', width: 151, height: 117, source: 'poster' },
  phalanges_hand: { src: '/anatomy/phalanges_hand.webp', width: 57, height: 82, source: 'poster' },
  quadriceps: { src: '/anatomy/quadriceps.webp', width: 87, height: 113, source: 'poster' },
  rectus_abdominis: { src: '/anatomy/rectus_abdominis.webp', width: 77, height: 89, source: 'poster' },
  ribs: { src: '/anatomy/ribs.webp', width: 138, height: 157, source: 'poster' },
  scapula: { src: '/anatomy/scapula.webp', width: 66, height: 117, source: 'poster' },
  spine: { src: '/anatomy/spine.webp', width: 61, height: 220, source: 'poster' },
  spleen: { src: '/anatomy/spleen.webp', width: 82, height: 73, source: 'poster' },
  sternum: { src: '/anatomy/sternum.webp', width: 149, height: 580, source: 'openstax', figure: '7.32' },
  stomach: { src: '/anatomy/stomach.webp', width: 169, height: 154, source: 'poster' },
  tibia: { src: '/anatomy/tibia.webp', width: 199, height: 1575, source: 'openstax', figure: '8.18' },
  trapezius: { src: '/anatomy/trapezius.webp', width: 103, height: 82, source: 'poster' },
};

/** Иллюстрация структуры, если она есть. */
export function structureImage(id: string): StructureImage | null {
  return STRUCTURE_IMAGES[id] ?? null;
}

/** Все ли структуры набора показываются фотографией: варианты не должны различаться по виду. */
export function allHaveImages(ids: string[]): boolean {
  return ids.length > 0 && ids.every((id) => id in STRUCTURE_IMAGES);
}
