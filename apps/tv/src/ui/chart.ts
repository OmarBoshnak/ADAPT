export type Point = {t: number; s: number};

export type Scale = {width: number; height: number; tMax: number; sMax: number};

export const toX = (t: number, sc: Scale) => (Math.min(t, sc.tMax) / sc.tMax) * sc.width;
export const toY = (s: number, sc: Scale) => sc.height - (Math.min(s, sc.sMax) / sc.sMax) * sc.height;

export function linePath(points: Point[], sc: Scale): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.t, sc).toFixed(1)},${toY(p.s, sc).toFixed(1)}`).join(' ');
}

export function areaPath(points: Point[], sc: Scale): string {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return '';
  return `${linePath(points, sc)} L${toX(last.t, sc).toFixed(1)},${sc.height} L${toX(first.t, sc).toFixed(1)},${sc.height} Z`;
}

/** Cuts a forecast at the first point where it reaches `limit`, interpolating the crossing. */
export function untilLimit(points: Point[], limit: number): {points: Point[]; crossing: Point | null} {
  const out: Point[] = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (p.s >= limit) {
      if (!prev) return {points: [{t: p.t, s: limit}], crossing: {t: p.t, s: limit}};
      const f = (limit - prev.s) / (p.s - prev.s || 1);
      const crossing = {t: prev.t + f * (p.t - prev.t), s: limit};
      return {points: [...out, crossing], crossing};
    }
    out.push(p);
  }
  return {points: out, crossing: null};
}
