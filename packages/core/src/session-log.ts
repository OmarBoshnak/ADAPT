import { getExercise } from './graph.js';
import type { SessionContext, SessionState } from './session.js';

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

/** One line per engine decision since `prev`, so a device log shows what was decided and from which numbers. */
export function sessionLog(ctx: SessionContext, prev: SessionState | null, next: SessionState): string[] {
  const name = (id: string) => getExercise(ctx.graph, id).name;
  const lines: string[] = [];

  if (!prev) {
    lines.push(
      `start · ${next.plan.segments.length} movements · threshold ${next.T.toFixed(1)} · learned bias ${ctx.profile.personalBias.toFixed(2)}`,
    );
  }
  for (const a of next.adaptations.slice(prev?.adaptations.length ?? 0)) {
    const to = a.action === 'switch' ? name(a.toExerciseId) : 'rest';
    lines.push(
      `adapt ${clock(a.atSec)} · ${a.trigger} · ${name(a.fromExerciseId)} → ${to} · strain ${a.strainBefore.toFixed(1)} of ${next.T.toFixed(1)}`,
    );
  }
  for (const l of next.learning.slice(prev?.learning.length ?? 0)) {
    const expected = l.predictedAtSec === null ? 'no prediction this session' : `model expected ${clock(l.predictedAtSec)}`;
    lines.push(`learn ${clock(l.atSec)} · ${l.direction} · ${expected} · bias ${l.biasBefore.toFixed(2)} → ${l.biasAfter.toFixed(2)}`);
  }
  if (next.phase === 'complete' && prev?.phase !== 'complete') {
    lines.push(
      `complete ${clock(next.sessionElapsedSec)} · ${next.adaptations.length} adaptations · next session's bias ${next.bias.toFixed(2)}`,
    );
  }
  return lines;
}
