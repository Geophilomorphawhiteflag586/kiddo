import type { RegionId } from '../types.ts';

/**
 * Сгенерировано `npm run assets:anatomy` — вручную не править.
 *
 * Базовая иллюстрация региона: настоящий рисунок из учебника OpenStax, на
 * который накладываются зоны из hotspots.ts. Размеры нужны, чтобы держать
 * пропорции без скачка вёрстки при загрузке.
 */
export interface RegionBase {
  id: RegionId;
  titleRu: string;
  src: string;
  width: number;
  height: number;
  /** Номер рисунка в учебнике — для указания источника. */
  figure: string;
}

export const REGION_BASES: RegionBase[] = [
  {
    id: 'organs_main',
    titleRu: 'Главные органы',
    src: '/anatomy/base/organs_main.webp',
    width: 693,
    height: 1587,
    figure: '26.2',
  },
  {
    id: 'organs_digestive',
    titleRu: 'Органы пищеварения',
    src: '/anatomy/base/organs_digestive.webp',
    width: 840,
    height: 1827,
    figure: '23.2',
  },
  {
    id: 'skull',
    titleRu: 'Череп',
    src: '/anatomy/base/skull.webp',
    width: 1000,
    height: 923,
    figure: '7.5',
  },
  {
    id: 'arm',
    titleRu: 'Рука',
    src: '/anatomy/base/arm.webp',
    width: 188,
    height: 1077,
    figure: '7.2',
  },
  {
    id: 'leg',
    titleRu: 'Нога',
    src: '/anatomy/base/leg.webp',
    width: 265,
    height: 1395,
    figure: '7.2',
  },
  {
    id: 'torso_bones',
    titleRu: 'Кости туловища',
    src: '/anatomy/base/torso_bones.webp',
    width: 529,
    height: 795,
    figure: '7.2',
  },
  {
    id: 'skeleton',
    titleRu: 'Весь скелет',
    src: '/anatomy/base/skeleton.webp',
    width: 736,
    height: 2200,
    figure: '7.2',
  },
  {
    id: 'muscles',
    titleRu: 'Мышцы',
    src: '/anatomy/base/muscles.webp',
    width: 493,
    height: 1309,
    figure: '11.5',
  },
];

export const BASE_BY_REGION: ReadonlyMap<RegionId, RegionBase> = new Map(
  REGION_BASES.map((base) => [base.id, base]),
);
