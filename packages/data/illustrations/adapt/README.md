# ADAPT figures

Drawn for ADAPT by [tools/figures/draw.py](../../../../tools/figures/draw.py), for movements no
[Workout Guide](../workout-guide/README.md) drawing shows. Each frame is a posed side-view figure rendered as white
line art: one even-odd path on a 512 × 512 canvas, the same format as the Workout Guide files, so the build reads
both the same way.

To change a pose, edit `POSES` in the script and run:

```bash
npm run figures
```

then `npm run graph` to rebuild what the TV bundles.

**Licence:** original work, under the repository's Apache-2.0 licence.

| Figure | Shown for |
| --- | --- |
| `butt-kick` | Butt Kicks, and Butt Kick March played more slowly |
| `double-butt-kick` | Double Leg Butt Kick |
| `boxer-shuffle` | Boxer Shuffle |
| `standing-punches` | Standing Punches |
| `step-punch` | Step and Punch |
| `standing-climber` | Standing Climbers |
| `reverse-toe-tap` | Reverse Toe Taps |
