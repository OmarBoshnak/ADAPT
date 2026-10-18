# /// script
# requires-python = ">=3.11"
# dependencies = ["shapely==2.2.0"]
# ///
"""Draws the ADAPT figures for movements no Workout Guide drawing shows: three frames each, white line art on a
512 × 512 canvas, one even-odd path per frame like the Workout Guide files.

    uv run tools/figures/draw.py packages/data/illustrations/adapt
"""

import math
import sys
from pathlib import Path

from shapely import affinity
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union

GROUND, TOP = 476, 22
STROKE = 5.0
THIGH, SHIN, UPPER_ARM, FOREARM, TORSO, NECK = 104, 100, 72, 66, 126, 14


def step(p, deg, length):
    a = math.radians(deg)
    return p[0] + math.sin(a) * length, p[1] + math.cos(a) * length


def circle(p, r):
    return Point(p).buffer(r, 32)


def limb(a, b, ra, rb):
    return unary_union([circle(a, ra), circle(b, rb)]).convex_hull


def seam(p, deg, half):
    return LineString([step(p, deg + 90, half), step(p, deg - 90, half)]).buffer(STROKE / 2, 8)


def leg(hip, thigh, shin, foot):
    knee = step(hip, thigh, THIGH)
    ankle = step(knee, shin, SHIN)
    calf = step(step(knee, shin, SHIN * 0.3), shin - 90, 6)
    heel, toe = step(ankle, foot + 180, 11), step(ankle, foot, 40)
    lower = unary_union([limb(knee, ankle, 19, 12), circle(calf, 19), limb(heel, toe, 11, 8), circle(ankle, 12.5)])
    upper = limb(hip, knee, 31, 19)
    return [(lower, []), (upper, [seam(step(hip, thigh, THIGH * 0.42), thigh, 40)])]


def arm(shoulder, upper, fore):
    elbow = step(shoulder, upper, UPPER_ARM)
    wrist = step(elbow, fore, FOREARM)
    fill = unary_union([
        circle(shoulder, 20),
        limb(shoulder, elbow, 17, 12.5),
        limb(elbow, wrist, 13, 10),
        circle(step(wrist, fore, 10), 15.5),
    ])
    return fill, []


def body(hip, lean):
    up = 180 - lean
    shoulder = step(hip, up, TORSO)
    chest = step(step(hip, up, TORSO * 0.68), up - 90, 12)
    back = step(step(hip, up, TORSO * 0.72), up + 90, 6)
    belly = step(step(hip, up, TORSO * 0.32), up - 90, 4)
    glute = step(hip, up + 90, 7)
    neck_top = step(shoulder, 180 - lean * 0.5, NECK + 12)
    head = step(neck_top, 180 - lean * 0.3, 25)
    torso = unary_union([limb(hip, shoulder, 30, 28), circle(chest, 32), circle(back, 30), circle(belly, 29), circle(glute, 29)])
    fill = unary_union([torso.convex_hull, limb(shoulder, neck_top, 14, 13), affinity.scale(circle(head, 29), 0.9, 1.05)])
    return fill, [seam(step(hip, up, 26), up, 50)], step(shoulder, 0, 16)


def pose(p):
    """Side view, facing right. Absolute angles in degrees: 0 points down, 90 forward, -90 back, 180 up."""
    hip = (0.0, 0.0)
    trunk, waist, shoulder = body(hip, p.get("lean", 4))
    return [
        arm(step(shoulder, -90, 4), *p["far_arm"]),
        *leg(step(hip, -90, 4), *p["far_leg"]),
        (trunk, waist),
        *leg(step(hip, 90, 4), *p["near_leg"]),
        arm(step(shoulder, 90, 4), *p["near_arm"]),
    ]


def ink(parts):
    """Back to front: each part hides what it covers and adds its own outline and seams."""
    drawn = Polygon()
    for fill, seams in parts:
        lines = [fill.difference(fill.buffer(-STROKE, 32)), *(s.intersection(fill) for s in seams)]
        drawn = drawn.difference(fill).union(unary_union(lines))
    return drawn


def moved(parts, fn):
    return [(fn(fill), [fn(s) for s in seams]) for fill, seams in parts]


def bounds(parts):
    return unary_union([fill for fill, _ in parts]).bounds


def svg_path(geom):
    rings = []
    for poly in getattr(geom, "geoms", [geom]):
        for ring in [poly.exterior, *poly.interiors]:
            rings.append("M" + "L".join(f"{x:.1f} {y:.1f}" for x, y in list(ring.coords)[:-1]) + "Z")
    return "".join(rings)


def frame_svg(parts):
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">'
        f'<path fill="#fff" fill-rule="evenodd" d="{svg_path(ink(parts).simplify(0.35))}"/></svg>\n'
    )


def write(out, slug, frames):
    posed = []
    for f in frames:
        parts = pose(f)
        dy = GROUND - bounds(parts)[3] - f.get("lift", 0)
        posed.append(moved(parts, lambda g, dy=dy: affinity.translate(g, 0, dy)))
    x0 = min(bounds(p)[0] for p in posed)
    x1 = max(bounds(p)[2] for p in posed)
    y0 = min(bounds(p)[1] for p in posed)
    k = min(1.0, (GROUND - TOP) / (GROUND - y0), 464 / (x1 - x0))
    cx = (x0 + x1) / 2
    (out / slug).mkdir(parents=True, exist_ok=True)
    for i, parts in enumerate(posed, 1):
        fit = lambda g: affinity.translate(affinity.scale(g, k, k, origin=(cx, GROUND)), 256 - cx, 0)
        (out / slug / f"frame-{i}.svg").write_text(frame_svg(moved(parts, fit)))


GUARD = (24, 166)
JAB = (88, 90)
KICK = (16, 208, -100)
RUN_FWD = (40, 148)
RUN_BACK = (-44, 50)
PLANTED = {"far_leg": (6, -5, 90), "near_leg": (3, -3, 90)}

POSES = {
    "butt-kick": [
        {"far_leg": (5, -3, 70), "near_leg": KICK, "far_arm": RUN_FWD, "near_arm": RUN_BACK, "lean": 7},
        {"far_leg": (9, -7, 78), "near_leg": (6, -4, 78), "far_arm": (0, 92), "near_arm": (0, 88), "lean": 6},
        {"far_leg": KICK, "near_leg": (5, -3, 70), "far_arm": RUN_BACK, "near_arm": RUN_FWD, "lean": 7},
    ],
    "double-butt-kick": [
        {"far_leg": (8, -6, 90), "near_leg": (5, -4, 90), "far_arm": (-6, 8), "near_arm": (-3, 10), "lean": 5},
        {"far_leg": (62, -22, 90), "near_leg": (58, -25, 90), "far_arm": (-55, -35), "near_arm": (-50, -30), "lean": 32},
        {
            "far_leg": (34, 214, -95),
            "near_leg": (18, 206, -100),
            "far_arm": (75, 125),
            "near_arm": (62, 112),
            "lean": 10,
            "lift": 64,
        },
    ],
    "boxer-shuffle": [
        {"far_leg": (16, 4, 82), "near_leg": (-14, -10, 62), "far_arm": JAB, "near_arm": GUARD, "lean": 9},
        {"far_leg": (14, 2, 70), "near_leg": (-16, -12, 60), "far_arm": GUARD, "near_arm": GUARD, "lean": 8, "lift": 8},
        {"far_leg": (12, 6, 66), "near_leg": (-12, -6, 80), "far_arm": GUARD, "near_arm": JAB, "lean": 11},
    ],
    "standing-punches": [
        {**PLANTED, "far_arm": JAB, "near_arm": GUARD, "lean": 6},
        {**PLANTED, "far_arm": GUARD, "near_arm": GUARD, "lean": 4},
        {**PLANTED, "far_arm": GUARD, "near_arm": JAB, "lean": 8},
    ],
    "step-punch": [
        {"far_leg": (5, -3, 90), "near_leg": (32, 4, 76), "far_arm": JAB, "near_arm": GUARD, "lean": 6},
        {**PLANTED, "far_arm": GUARD, "near_arm": GUARD, "lean": 4},
        {"far_leg": (32, 4, 76), "near_leg": (5, -3, 90), "far_arm": GUARD, "near_arm": JAB, "lean": 6},
    ],
    "standing-climber": [
        {"far_leg": (96, 6, 80), "near_leg": (2, 0, 90), "far_arm": (174, 178), "near_arm": (14, 168), "lean": 3},
        {"far_leg": (3, 0, 90), "near_leg": (-2, 0, 90), "far_arm": (172, 176), "near_arm": (168, 174), "lean": 2},
        {"far_leg": (2, 0, 90), "near_leg": (96, 6, 80), "far_arm": (14, 168), "near_arm": (174, 178), "lean": 3},
    ],
    "reverse-toe-tap": [
        {"far_leg": (8, -6, 90), "near_leg": (-30, -34, 40), "far_arm": (-8, 80), "near_arm": (10, 100), "lean": 6},
        {"far_leg": (3, 0, 90), "near_leg": (-2, 0, 90), "far_arm": (0, 88), "near_arm": (2, 92), "lean": 3},
        {"far_leg": (-30, -34, 40), "near_leg": (8, -6, 90), "far_arm": (10, 100), "near_arm": (-8, 80), "lean": 6},
    ],
}

if __name__ == "__main__":
    out = Path(sys.argv[1])
    for slug, frames in POSES.items():
        write(out, slug, frames)
