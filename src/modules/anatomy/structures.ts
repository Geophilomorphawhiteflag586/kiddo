import { STRUCTURES } from './data/structures.ts';
import { BASE_BY_REGION, REGION_BASES } from './data/bases.ts';
import { structuresWithHotspot } from './data/hotspots.ts';
import type { AnatomyStructure, AnatomySystem, RegionId } from './types.ts';

export { STRUCTURES, REGION_BASES, BASE_BY_REGION };

export const STRUCTURE_BY_ID: ReadonlyMap<string, AnatomyStructure> = new Map(
  STRUCTURES.map((structure) => [structure.id, structure]),
);

export function getStructure(id: string): AnatomyStructure | undefined {
  return STRUCTURE_BY_ID.get(id);
}

export function structuresOfSystem(system: AnatomySystem): AnatomyStructure[] {
  return STRUCTURES.filter((structure) => structure.system === system).sort(
    (a, b) => a.order - b.order,
  );
}

export function structuresOfRegion(region: RegionId): AnatomyStructure[] {
  return STRUCTURES.filter((structure) => structure.region === region).sort(
    (a, b) => a.order - b.order,
  );
}

export const TOTAL_STRUCTURES = STRUCTURES.length;

/**
 * Структуры, которые можно показать и нажать на иллюстрации региона.
 * На полном скелете это не все кости: мелкие спрашиваются в своих регионах.
 */
export function structuresDrawnIn(region: RegionId): string[] {
  return structuresWithHotspot(region);
}
