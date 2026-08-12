import { COUNTRIES } from '../data/countries.ts';
import type { ContinentId, Country } from './types';

export { COUNTRIES };

export const BY_CODE: ReadonlyMap<string, Country> = new Map(
  COUNTRIES.map((c) => [c.code, c]),
);

export function getCountry(code: string): Country | undefined {
  return BY_CODE.get(code);
}

export interface Continent {
  id: ContinentId;
  name: string;
  emoji: string;
  /** Куда летит камера при выборе континента. */
  view: { lat: number; lng: number; altitude: number };
  /** Градиент карточки на главном экране. */
  gradient: string;
}

export const CONTINENTS: Continent[] = [
  {
    id: 'europe',
    name: 'Европа',
    emoji: '🏰',
    view: { lat: 50, lng: 15, altitude: 1.1 },
    gradient: 'from-sky-400 to-indigo-600',
  },
  {
    id: 'asia',
    name: 'Азия',
    emoji: '🏯',
    view: { lat: 34, lng: 90, altitude: 1.5 },
    gradient: 'from-rose-400 to-orange-600',
  },
  {
    id: 'africa',
    name: 'Африка',
    emoji: '🦁',
    view: { lat: 2, lng: 20, altitude: 1.4 },
    gradient: 'from-amber-400 to-yellow-600',
  },
  {
    id: 'north-america',
    name: 'Северная Америка',
    emoji: '🗽',
    view: { lat: 30, lng: -95, altitude: 1.5 },
    gradient: 'from-emerald-400 to-teal-600',
  },
  {
    id: 'south-america',
    name: 'Южная Америка',
    emoji: '🦜',
    view: { lat: -18, lng: -60, altitude: 1.4 },
    gradient: 'from-lime-400 to-green-600',
  },
  {
    id: 'oceania',
    name: 'Океания',
    emoji: '🏄',
    view: { lat: -22, lng: 150, altitude: 1.6 },
    gradient: 'from-cyan-400 to-blue-600',
  },
];

export const CONTINENT_BY_ID: ReadonlyMap<ContinentId, Continent> = new Map(
  CONTINENTS.map((c) => [c.id, c]),
);

export function countriesOf(continent: ContinentId): Country[] {
  return COUNTRIES.filter((c) => c.continent === continent);
}

/**
 * Флаги лежат локально в public/flags (см. scripts/download-flags.mjs) —
 * во время игры приложение не ходит во внешний CDN.
 */
export function flagUrl(code: string): string {
  return `/flags/${code}.png`;
}

/** Государства без контура в наборе 110m — на глобусе показываем точкой. */
export const WITHOUT_POLYGON = new Set([
  'AD', 'AG', 'BB', 'BH', 'CV', 'DM', 'FM', 'GD', 'KI', 'KM', 'KN', 'LC', 'LI',
  'MC', 'MH', 'MT', 'MU', 'MV', 'NR', 'PW', 'SC', 'SG', 'SM', 'ST', 'TO', 'TV',
  'VA', 'VC', 'WS',
]);
