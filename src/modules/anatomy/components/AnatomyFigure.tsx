'use client';

import Image from 'next/image';
import { useCallback, useRef } from 'react';
import { BASE_BY_REGION } from '../data/bases.ts';
import { HOTSPOTS, pickHotspot } from '../data/hotspots.ts';
import { getStructure } from '../structures.ts';
import type { RegionId } from '../types.ts';

interface Props {
  region: RegionId;
  /** Структура, обведённая на иллюстрации. Остальное не выделяется. */
  highlight?: string | null;
  /** Режим «покажи на теле»: по картинке можно кликать. */
  onPick?: (structureId: string) => void;
  /** Ошибочный выбор — обводится отдельным цветом рядом с правильным. */
  wrong?: string | null;
  className?: string;
  /** Загружать сразу: для картинки, которую видно первой на экране. */
  priority?: boolean;
  sizes?: string;
}

/**
 * Иллюстрация региона тела.
 *
 * Сам рисунок — настоящая медицинская иллюстрация из учебника; поверх лежит
 * прозрачный слой с областями структур. Области нужны для двух вещей: обвести
 * нужную кость («где находится») и понять, куда ткнул ребёнок («покажи на
 * теле»). Ничего не дорисовываем: пока не нажали и не подсвечиваем, слой
 * полностью невидим.
 *
 * Попадание считает `pickHotspot` по ближайшей области, поэтому мелкие кости
 * на полном скелете тоже нажимаются, а между ними нет мёртвых зон.
 */
export default function AnatomyFigure({
  region,
  highlight = null,
  onPick,
  wrong = null,
  className = '',
  priority = false,
  sizes = '(max-width: 640px) 70vw, 360px',
}: Props) {
  const base = BASE_BY_REGION.get(region);
  const surface = useRef<HTMLDivElement>(null);
  const interactive = Boolean(onPick);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!onPick || !surface.current) return;
      const box = surface.current.getBoundingClientRect();
      // Картинка вписана по contain, поэтому считаем по её реальному кадру.
      const picked = pickHotspot(
        region,
        ((event.clientX - box.left) / box.width) * 100,
        ((event.clientY - box.top) / box.height) * 100,
      );
      if (picked) onPick(picked);
    },
    [onPick, region],
  );

  if (!base) return null;

  const spots = HOTSPOTS[region] ?? [];
  const marked = spots.filter((spot) => spot.structureId === highlight || spot.structureId === wrong);

  return (
    <div
      ref={surface}
      onClick={interactive ? handleClick : undefined}
      className={`relative overflow-hidden rounded-xl bg-white ${
        interactive ? 'cursor-crosshair' : ''
      } ${className}`}
      style={{ aspectRatio: `${base.width} / ${base.height}`, touchAction: 'manipulation' }}
      role={interactive ? 'button' : 'img'}
      aria-label={interactive ? `${base.titleRu}: нажмите на нужное место` : base.titleRu}
    >
      <Image
        src={base.src}
        alt=""
        fill
        sizes={sizes}
        priority={priority}
        className="object-contain"
      />

      {marked.length > 0 && (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          {marked.map((spot) => {
            const isWrong = spot.structureId === wrong && spot.structureId !== highlight;
            const structure = getStructure(spot.structureId);
            return (
              <ellipse
                key={spot.structureId}
                cx={spot.cx}
                cy={spot.cy}
                rx={spot.rx}
                ry={spot.ry}
                fill={isWrong ? 'rgba(245,158,11,0.28)' : 'rgba(244,63,94,0.28)'}
                stroke={isWrong ? '#f59e0b' : '#f43f5e'}
                strokeWidth={0.6}
                vectorEffect="non-scaling-stroke"
              >
                {structure && <title>{structure.nameRu}</title>}
              </ellipse>
            );
          })}
        </svg>
      )}
    </div>
  );
}
