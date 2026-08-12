'use client';

import { useMemo, useState } from 'react';
import { COUNTRIES, WITHOUT_POLYGON, getCountry } from '@/lib/countries';
import { featureWorldPath, type OutlineFeature } from '@/lib/outlines';
import { useCountryPolygons } from './GlobeView';

/** Микрогосударства без полигона — точки по координатам. */
const MICRO = COUNTRIES.filter((c) => WITHOUT_POLYGON.has(c.code));

interface Props {
  /** Цвет заливки страны. null — нейтральный «не изучено». */
  colorFor?: (code: string) => string | null;
  onSelect?: (code: string) => void;
  selected?: string | null;
  className?: string;
}

const NEUTRAL = '#39404f';

/**
 * Плоская интерактивная карта мира — вид «Общего прогресса» из макета.
 * Рисуется из тех же контуров, что и глобус; Антарктиды в датасете нет,
 * поэтому вьюбокс обрезан по 85°N…60°S.
 */
export default function WorldMap({ colorFor, onSelect, selected, className = '' }: Props) {
  const features = useCountryPolygons();
  const [hovered, setHovered] = useState<string | null>(null);

  const paths = useMemo(
    () =>
      features.map((feature) => ({
        code: feature.properties.code,
        d: featureWorldPath(feature as OutlineFeature),
      })),
    [features],
  );

  if (features.length === 0) {
    return <div className={`animate-pulse rounded-xl bg-ink-700 ${className}`} />;
  }

  const hoveredCountry = hovered ? getCountry(hovered) : null;

  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox="0 5 360 145"
        className="h-full w-full"
        role="img"
        aria-label="Карта мира с уровнем освоения стран"
      >
        {paths.map(({ code, d }) => {
          const active = code === selected || code === hovered;
          return (
            <path
              key={code}
              d={d}
              fill={colorFor?.(code) ?? NEUTRAL}
              stroke={active ? '#e5e9f2' : '#0a0e17'}
              strokeWidth={active ? 0.6 : 0.35}
              className="cursor-pointer"
              onClick={() => onSelect?.(code)}
              onPointerEnter={() => setHovered(code)}
              onPointerLeave={() => setHovered((h) => (h === code ? null : h))}
            >
              <title>{getCountry(code)?.name ?? code}</title>
            </path>
          );
        })}
        {MICRO.map((c) => {
          const active = c.code === selected || c.code === hovered;
          return (
            <circle
              key={c.code}
              cx={c.lng + 180}
              cy={90 - c.lat}
              r={active ? 1.6 : 1.1}
              fill={colorFor?.(c.code) ?? NEUTRAL}
              stroke={active ? '#e5e9f2' : '#0a0e17'}
              strokeWidth={0.3}
              className="cursor-pointer"
              onClick={() => onSelect?.(c.code)}
              onPointerEnter={() => setHovered(c.code)}
              onPointerLeave={() => setHovered((h) => (h === c.code ? null : h))}
            >
              <title>{c.name}</title>
            </circle>
          );
        })}
      </svg>

      {hoveredCountry && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-line bg-ink-950/90 px-3 py-1.5 text-sm font-bold">
          {hoveredCountry.name}
        </div>
      )}
    </div>
  );
}
