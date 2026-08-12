/**
 * Превращение GeoJSON-контура страны в SVG-путь. Чистые функции без DOM —
 * покрываются тестами в node напрямую по public/data/countries.geojson.
 *
 * Проекция — равнопромежуточная с поправкой ширины на cos(широты центра):
 * для одной страны этого достаточно, а полноценная картографическая проекция
 * не нужна. Контур всегда вписывается в заданный квадрат с сохранением
 * пропорций, поэтому реальный размер страны не подсказывает ответ.
 */

type Ring = number[][];

export interface OutlineFeature {
  type: 'Feature';
  properties: { code: string };
  geometry: { type: string; coordinates: unknown };
}

export interface OutlinePath {
  /** Содержимое атрибута d для <path>. */
  d: string;
  width: number;
  height: number;
}

function ringsOf(geometry: OutlineFeature['geometry']): Ring[] {
  if (geometry.type === 'Polygon') {
    // Только внешние кольца: дырки (озёра) в силуэте не нужны.
    return [(geometry.coordinates as Ring[])[0]];
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates as Ring[][]).map((polygon) => polygon[0]);
  }
  return [];
}

/**
 * Страны, пересекающие антимеридиан (Россия, Фиджи…), в исходных координатах
 * разорваны на -180/+180. Если разброс долгот подозрительно велик, переносим
 * западное полушарие на +360 и склеиваем силуэт.
 */
function unwrapLongitudes(rings: Ring[]): Ring[] {
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const ring of rings) {
    for (const [lng] of ring) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
  }
  if (maxLng - minLng <= 180) return rings;
  return rings.map((ring) => ring.map(([lng, lat]) => [lng < 0 ? lng + 360 : lng, lat]));
}

/**
 * Строит SVG-путь силуэта, вписанный в box×box с полем pad и центрированный.
 * Работает с Polygon и MultiPolygon (островные государства — несколько
 * подпутей внутри одного d).
 */
export function outlinePath(feature: OutlineFeature, box = 100, pad = 6): OutlinePath | null {
  const rings = unwrapLongitudes(ringsOf(feature.geometry));
  if (rings.length === 0) return null;

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }

  // Поправка на сжатие меридианов: без неё северные страны растянуты вширь.
  const stretch = Math.max(0.15, Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180)));
  const spanX = Math.max(1e-9, (maxLng - minLng) * stretch);
  const spanY = Math.max(1e-9, maxLat - minLat);

  const inner = box - pad * 2;
  const scale = Math.min(inner / spanX, inner / spanY);
  const offsetX = pad + (inner - spanX * scale) / 2;
  const offsetY = pad + (inner - spanY * scale) / 2;

  const parts: string[] = [];
  for (const ring of rings) {
    if (ring.length < 3) continue;
    const cmds = ring.map(([lng, lat], i) => {
      const x = offsetX + (lng - minLng) * stretch * scale;
      const y = offsetY + (maxLat - lat) * scale; // SVG-ось Y направлена вниз
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    });
    parts.push(`${cmds.join('')}Z`);
  }
  if (parts.length === 0) return null;

  return { d: parts.join(''), width: box, height: box };
}

/**
 * Контур страны в координатах карты мира (равнопромежуточная проекция,
 * x = lng + 180, y = 90 − lat). Долготы не разворачиваем — на карте мира
 * разрыв России на антимеридиане выглядит нормально.
 */
export function featureWorldPath(feature: OutlineFeature): string {
  const parts: string[] = [];
  for (const ring of ringsOf(feature.geometry)) {
    if (ring.length < 3) continue;
    const cmds = ring.map(([lng, lat], i) => {
      const x = lng + 180;
      const y = 90 - lat;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    });
    parts.push(`${cmds.join('')}Z`);
  }
  return parts.join('');
}

/** Мини-карта мира: все контуры в одном пути + отдельный путь выбранной страны. */
export function worldPaths(features: OutlineFeature[], highlight: string): {
  world: string;
  target: string;
  width: number;
  height: number;
} {
  let world = '';
  let target = '';
  for (const feature of features) {
    if (feature.properties.code === highlight) target += featureWorldPath(feature);
    else world += featureWorldPath(feature);
  }
  return { world, target, width: 360, height: 180 };
}
