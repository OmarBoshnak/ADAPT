import type {Exercise, ExerciseGraph} from '@adapt/core';
import sessionGraph from '@adapt/data/session-graph.json';

export const graph = sessionGraph as ExerciseGraph;

export function exercise(id: string): Exercise {
  const found = graph.exercises[id];
  if (!found) throw new Error(`Unknown exercise ${id}`);
  return found;
}

const EQUIPMENT: Record<string, string> = {'body only': 'Body weight'};

export function metaLabels(ex: Exercise): string[] {
  const equipment = ex.equipment ? (EQUIPMENT[ex.equipment] ?? capitalize(ex.equipment)) : 'Body weight';
  return [equipment, capitalize(ex.level)];
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
