/**
 * Сгенерировано `npm run assets:anatomy` — вручную не править.
 *
 * Иллюстрации из учебника OpenStax «Anatomy and Physiology 2e» (CC BY-NC-SA 4.0),
 * обрезанные под структуры модуля. Структуры, которых здесь нет, показываются
 * схемой SVG: для них в учебнике нет отдельного чистого рисунка.
 */
export interface StructureImage {
  src: string;
  width: number;
  height: number;
  /** Номер рисунка в учебнике — для указания источника. */
  figure: string;
}

export const IMAGE_CREDIT = {
  source: 'Anatomy and Physiology 2e',
  publisher: 'OpenStax, Rice University',
  url: 'https://openstax.org/details/books/anatomy-and-physiology-2e',
  license: 'CC BY-NC-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
} as const;

export const STRUCTURE_IMAGES: Record<string, StructureImage> = {
  brain: { src: '/anatomy/brain.webp', width: 317, height: 432, figure: '13.6' },
  heart: { src: '/anatomy/heart.webp', width: 826, height: 1019, figure: '19.6' },
  lungs: { src: '/anatomy/lungs.webp', width: 900, height: 976, figure: '22.13' },
  stomach: { src: '/anatomy/stomach.webp', width: 628, height: 637, figure: '23.15' },
  intestines: { src: '/anatomy/intestines.webp', width: 394, height: 513, figure: '23.18' },
  kidneys: { src: '/anatomy/kidneys.webp', width: 820, height: 1095, figure: '25.8' },
  mandible: { src: '/anatomy/mandible.webp', width: 384, height: 273, figure: '7.15' },
  spine: { src: '/anatomy/spine.webp', width: 240, height: 1042, figure: '7.20' },
  sternum: { src: '/anatomy/sternum.webp', width: 149, height: 580, figure: '7.32' },
  ribs: { src: '/anatomy/ribs.webp', width: 395, height: 576, figure: '7.32' },
  clavicle: { src: '/anatomy/clavicle.webp', width: 522, height: 231, figure: '8.3' },
  scapula: { src: '/anatomy/scapula.webp', width: 282, height: 353, figure: '8.4' },
  carpals: { src: '/anatomy/carpals.webp', width: 274, height: 212, figure: '8.7' },
  phalanges_hand: { src: '/anatomy/phalanges_hand.webp', width: 361, height: 511, figure: '8.7' },
  pelvis: { src: '/anatomy/pelvis.webp', width: 663, height: 589, figure: '8.12' },
  femur: { src: '/anatomy/femur.webp', width: 192, height: 825, figure: '8.16' },
  tibia: { src: '/anatomy/tibia.webp', width: 199, height: 1575, figure: '8.18' },
  fibula: { src: '/anatomy/fibula.webp', width: 124, height: 1502, figure: '8.18' },
  foot_bones: { src: '/anatomy/foot_bones.webp', width: 275, height: 1066, figure: '8.19' },
  trapezius: { src: '/anatomy/trapezius.webp', width: 428, height: 536, figure: '11.15' },
  deltoid: { src: '/anatomy/deltoid.webp', width: 379, height: 462, figure: '11.23' },
  pectoralis: { src: '/anatomy/pectoralis.webp', width: 658, height: 818, figure: '11.23' },
  biceps: { src: '/anatomy/biceps.webp', width: 900, height: 1149, figure: '11.4' },
  rectus_abdominis: { src: '/anatomy/rectus_abdominis.webp', width: 126, height: 345, figure: '11.16' },
  quadriceps: { src: '/anatomy/quadriceps.webp', width: 266, height: 914, figure: '11.29' },
};

/** Иллюстрация структуры, если она есть. */
export function structureImage(id: string): StructureImage | null {
  return STRUCTURE_IMAGES[id] ?? null;
}

/** Все ли структуры набора показываются фотографией: варианты не должны различаться по виду. */
export function allHaveImages(ids: string[]): boolean {
  return ids.length > 0 && ids.every((id) => id in STRUCTURE_IMAGES);
}
