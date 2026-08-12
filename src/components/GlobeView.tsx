'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GlobeMethods, GlobeProps } from 'react-globe.gl';
import { COUNTRIES, WITHOUT_POLYGON, getCountry } from '@/lib/countries';

/** Полигон страны из public/data/countries.geojson. */
export interface CountryFeature {
  type: 'Feature';
  properties: { code: string };
  geometry: object;
}

interface MicroPoint {
  code: string;
  lat: number;
  lng: number;
}

type GlobeRef = React.MutableRefObject<GlobeMethods | undefined>;

/**
 * globe.gl трогает window при импорте, поэтому загружаем его только на клиенте.
 * Обёртка нужна, чтобы протащить ref через next/dynamic.
 */
const Globe = dynamic(
  async () => {
    const mod = await import('react-globe.gl');
    const Component = mod.default;
    const Wrapped = ({ globeRef, ...props }: GlobeProps & { globeRef?: GlobeRef }) => (
      <Component ref={globeRef} {...props} />
    );
    Wrapped.displayName = 'GlobeWithRef';
    return Wrapped;
  },
  { ssr: false },
);

let polygonsPromise: Promise<CountryFeature[]> | null = null;

/** Контуры стран грузятся один раз на всё приложение. */
export function useCountryPolygons(): CountryFeature[] {
  const [features, setFeatures] = useState<CountryFeature[]>([]);
  useEffect(() => {
    polygonsPromise ??= fetch('/data/countries.geojson')
      .then((res) => res.json())
      .then((json: { features: CountryFeature[] }) => json.features);
    let alive = true;
    polygonsPromise.then((data) => {
      if (alive) setFeatures(data);
    });
    return () => {
      alive = false;
    };
  }, []);
  return features;
}

const MICRO_POINTS: MicroPoint[] = COUNTRIES.filter((c) => WITHOUT_POLYGON.has(c.code)).map(
  (c) => ({ code: c.code, lat: c.lat, lng: c.lng }),
);

export interface GlobeViewProps {
  /** Цвет заливки страны. Вернуть null — страна остаётся нейтральной. */
  colorFor?: (code: string) => string | null;
  /** Приподнимаем страну над поверхностью — например, выбранную или найденную. */
  raised?: Set<string>;
  onSelect?: (code: string) => void;
  onHover?: (code: string | null) => void;
  /** Куда смотрит камера. Изменение пропса запускает плавный перелёт. */
  focus?: { lat: number; lng: number; altitude: number } | null;
  autoRotate?: boolean;
  /** Подпись при наведении. По умолчанию — название страны. */
  labelFor?: (code: string) => string | null;
  className?: string;
}

const NEUTRAL = 'rgba(148, 163, 184, 0.22)';

export default function GlobeView({
  colorFor,
  raised,
  onSelect,
  onHover,
  focus,
  autoRotate = false,
  labelFor,
  className,
}: GlobeViewProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [ready, setReady] = useState(false);
  const polygons = useCountryPolygons();

  // globe.gl не умеет ресайзиться сам — сообщаем размеры контейнера руками.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || !ready) return;
    const controls = globe.controls();
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.35;
    controls.enableDamping = true;
    controls.minDistance = 140;
    controls.maxDistance = 600;
  }, [autoRotate, ready]);

  useEffect(() => {
    if (!focus || !ready) return;
    globeRef.current?.pointOfView(focus, 1200);
  }, [focus, ready]);

  const capColor = useMemo(
    () => (obj: object) => {
      const code = (obj as CountryFeature).properties.code;
      return colorFor?.(code) ?? NEUTRAL;
    },
    [colorFor],
  );

  const altitude = useMemo(
    () => (obj: object) => {
      const code = (obj as CountryFeature).properties.code;
      return raised?.has(code) ? 0.06 : 0.008;
    },
    [raised],
  );

  const label = useMemo(
    () => (obj: object) => {
      const code = (obj as CountryFeature).properties.code;
      const text = labelFor ? labelFor(code) : getCountry(code)?.name;
      if (!text) return '';
      return `<div class="globe-tooltip">${text}</div>`;
    },
    [labelFor],
  );

  return (
    <div ref={containerRef} className={className ?? 'h-full w-full'}>
      {size.width > 0 && (
        <Globe
          globeRef={globeRef}
          width={size.width}
          height={size.height}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="/textures/earth-blue-marble.jpg"
          bumpImageUrl="/textures/earth-topology.png"
          showAtmosphere
          atmosphereColor="#7dd3fc"
          atmosphereAltitude={0.18}
          onGlobeReady={() => setReady(true)}
          polygonsData={polygons}
          polygonCapColor={capColor}
          polygonSideColor={() => 'rgba(56, 189, 248, 0.15)'}
          polygonStrokeColor={() => 'rgba(226, 232, 240, 0.55)'}
          polygonAltitude={altitude}
          polygonLabel={label}
          polygonsTransitionDuration={300}
          onPolygonClick={(polygon) =>
            onSelect?.((polygon as CountryFeature).properties.code)
          }
          onPolygonHover={(polygon) =>
            onHover?.(polygon ? (polygon as CountryFeature).properties.code : null)
          }
          pointsData={MICRO_POINTS}
          pointLat="lat"
          pointLng="lng"
          pointAltitude={0.02}
          pointRadius={0.55}
          pointColor={(obj: object) => colorFor?.((obj as MicroPoint).code) ?? '#e2e8f0'}
          pointLabel={(obj: object) => {
            const code = (obj as MicroPoint).code;
            const text = labelFor ? labelFor(code) : getCountry(code)?.name;
            return text ? `<div class="globe-tooltip">${text}</div>` : '';
          }}
          onPointClick={(obj: object) => onSelect?.((obj as MicroPoint).code)}
        />
      )}
    </div>
  );
}
