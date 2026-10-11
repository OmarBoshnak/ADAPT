import type { Exercise, ExerciseGraph, SignalProfile } from '@adapt/core';
import sessionGraph from '@adapt/data/session-graph.json';

const graph = sessionGraph as ExerciseGraph;

const ORDER: SignalProfile[] = ['impact', 'oscillation', 'sustained', 'static'];

export const PROFILE_LABEL: Record<SignalProfile, string> = {
  impact: 'Jumps and landings',
  oscillation: 'Steps and rhythm',
  sustained: 'Squats, lunges, punches',
  static: 'Holds',
};

export function movementsByProfile(): Array<{ profile: SignalProfile; movements: Exercise[] }> {
  const pool = graph.sessionPool.map((id) => graph.exercises[id]).filter((ex): ex is Exercise => !!ex);
  return ORDER.map((profile) => ({
    profile,
    movements: pool.filter((ex) => ex.signalProfile === profile).sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((group) => group.movements.length > 0);
}
