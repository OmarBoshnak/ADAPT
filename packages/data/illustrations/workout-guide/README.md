# Workout Guide illustrations

Exercise drawings from [Workout Guide](https://github.com/bryllim/workout-guide) by
[Bryl Lim](https://bryllim.com), downloaded at commit
[`aac5992`](https://github.com/bryllim/workout-guide/tree/aac599224bb9780305239607ef98540b7e0ce389/packages/workout-guide/assets).

**Licence:** [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The full notice is in
[LICENSE-ASSETS](LICENSE-ASSETS), and upstream attribution in [UPSTREAM-ATTRIBUTION.md](UPSTREAM-ATTRIBUTION.md).
Per-frame records for the eight drawings used here, copied from the upstream manifest, are in
[manifest.json](manifest.json). All 24 frames are Bryl Lim's own work; none is derived from Everkinetic.

**Changes:** none. The SVG files are stored exactly as published. At build time `tools/build-graph`
reads each frame's single path so the TV can draw it with `react-native-svg`, in the same white fill.

| Drawing | Shown for |
| --- | --- |
| `jumping-jack` | Jumping Jacks |
| `high-knees` | High Knees |
| `burpee` | Burpees |
| `squat-thrust` | Squat Thrusts |
| `skater-hop` | Skater Hops |
| `mountain-climber` | Mountain Climbers, and Slow Mountain Climbers played more slowly |
| `bodyweight-squat` | Bodyweight Squat |
| `jump-squat` | Freehand Jump Squat |

The TV credits the drawings on its Home screen. Every other movement shows a lettered tile until a licensed drawing
exists for it.
