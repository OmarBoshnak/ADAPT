import type { RelayStatus, SensorSnapshot } from '@adapt/core';

export const status = (patch: Partial<RelayStatus> = {}): RelayStatus => ({
  connection: 'open',
  code: '4821',
  peer: 'present',
  attempt: 0,
  rejectedReason: null,
  ...patch,
});

export const snapshot = (patch: Partial<SensorSnapshot> = {}): SensorSnapshot => ({
  phase: 'idle',
  exercise: null,
  onFloor: true,
  trace: [],
  adapted: null,
  ...patch,
});

export const jumpingJacks = { seq: 1, name: 'Jumping Jacks', profile: 'impact', expectedCadence: 70 } as const;
