'use client';

import { useMemo } from 'react';
import { useCountryPolygons } from './GlobeView';
import { getCountry } from '@/lib/countries';
import { outlinePath, worldPaths, type OutlineFeature } from '@/lib/outlines';

/**
 * Изолированный силуэт страны: без подписей, соседей и реального масштаба.
 * Контур всегда вписан в квадрат и центрирован.
 */
export function OutlineShape({ code, className = '' }: { code: string; className?: string }) {
  const features = useCountryPolygons();

  const path = useMemo(() => {
    const feature = features.find((f) => f.properties.code === code);
    if (!feature) return null;
    return outlinePath(feature as OutlineFeature, 100, 6);
  }, [features, code]);

  if (features.length === 0) {
    return (
      <div className={`grid place-items-center ${className}`}>
        <div className="h-24 w-24 animate-pulse rounded-3xl bg-slate-800/60" />
      </div>
    );
  }

  if (!path) {
    // Страны без контура исключаются из outline-режима заранее; это страховка.
    if (process.env.NODE_ENV === 'development') {
      console.warn(`OutlineShape: нет контура для ${code}`);
    }
    return null;
  }

  return (
    <svg
      viewBox={`0 0 ${path.width} ${path.height}`}
      className={className}
      role="img"
      aria-label="Контур страны"
    >
      <path
        d={path.d}
        fill="rgba(56, 189, 248, 0.18)"
        stroke="#7dd3fc"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Мини-карта мира с подсветкой одной страны — для разбора ответа. */
export function MiniMap({ code, className = '' }: { code: string; className?: string }) {
  const features = useCountryPolygons();

  const paths = useMemo(() => {
    if (features.length === 0) return null;
    return worldPaths(features as OutlineFeature[], code);
  }, [features, code]);

  const country = getCountry(code);
  if (!paths || !country) return null;

  return (
    <svg
      viewBox={`0 0 ${paths.width} ${paths.height}`}
      className={className}
      role="img"
      aria-label="Расположение страны на карте мира"
    >
      <path d={paths.world} fill="rgba(148, 163, 184, 0.25)" />
      {paths.target && (
        <path d={paths.target} fill="#22c55e" stroke="#bbf7d0" strokeWidth="0.6" />
      )}
      {/* Маркер поверх заливки: маленькие страны на карте мира иначе не видны. */}
      <circle
        cx={country.lng + 180}
        cy={90 - country.lat}
        r="3.5"
        fill="none"
        stroke="#4ade80"
        strokeWidth="1.2"
      />
    </svg>
  );
}
