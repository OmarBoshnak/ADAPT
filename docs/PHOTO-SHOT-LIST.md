# Photo shot list — ADAPT home pack

**Superseded on 2026-10-11.** The TV now shows licensed Workout Guide drawings for nine movements and a
lettered tile for the rest, and the Free Exercise DB photographs were removed because their rights could not
be verified. Mixing photographs with the drawings would look inconsistent, so this list is kept only in case
the visual system changes back to photography.

22 demonstration photographs were planned for the movements ADAPT authored.

These are **functional content, not decoration** (design spec, TV-6/7/9). They sit beside the
exercise name, cropped square. Until they exist, every screen shows the defined fallback tile, so
nothing is broken in the meantime — but the hero screens are much stronger with a real photo.

**Budget about an hour.** Needed by Phase 3 (TV screens), not before.

---

## Match the dataset's style

The Free Exercise DB photos are the reference. Put a couple side by side before you start.

| | |
|---|---|
| **Frames per movement** | **2** — `0.jpg` the start position, `1.jpg` the key position. Same as the dataset. |
| **Background** | Plain, light, uncluttered wall. No posters, no windows behind you. |
| **Framing** | Whole body in frame, head to feet, with a little space around. Centre yourself. |
| **Camera** | Phone on a tripod or a stack of books, at **hip height**, landscape, 3–4 m away. Never handheld. |
| **Light** | Even and bright. Face a window or use two lamps; avoid a single hard light from one side. |
| **Clothing** | Plain, fitted, one solid colour. No logos (trademark rule for the demo video). |
| **Same everything** | Same wall, same outfit, same camera spot for all 44 shots. Consistency is what makes them read as one set. |
| **Resolution** | Anything a current phone shoots. They are cropped square and scaled down. |

The design spec forbids stock-photo energy: no dramatic lighting, no posing, no expressions. The
look is "instruction manual", which is exactly what the dataset photos are.

---

## The list

Save each as `packages/data/assets/home-pack/<id>/0.jpg` and `.../1.jpg`.

| # | id | Movement | `0.jpg` — start | `1.jpg` — key position |
|---|---|---|---|---|
| 1 | `adapt_jumping_jacks` | Jumping Jacks | Feet together, arms by sides | Mid-air or landed wide, arms overhead |
| 2 | `adapt_step_jacks` | Step Jacks | Feet together, arms by sides | One foot stepped out, arms overhead |
| 3 | `adapt_toe_tap_jacks` | Toe-Tap Jacks | Standing, weight on one foot | Toe tapped out to side, arms overhead |
| 4 | `adapt_high_knees` | High Knees | Standing tall | One knee at hip height, opposite arm forward |
| 5 | `adapt_high_knee_march` | High Knee March | Standing tall | One knee lifted to hip height, other foot flat |
| 6 | `adapt_standing_march` | Standing March | Standing tall | One knee lifted a little, arms swinging |
| 7 | `adapt_skater_hops` | Skater Hops | Standing on one foot | Landed on the other foot, trailing leg swept behind |
| 8 | `adapt_skater_steps` | Skater Steps | Standing, feet hip-width | Stepped wide, other foot crossed lightly behind |
| 9 | `adapt_side_step_touch` | Side Step Touch | Feet together | Stepped to one side, feet apart |
| 10 | `adapt_burpees` | Burpees | Standing | High plank (hands down, legs back) |
| 11 | `adapt_squat_thrusts` | Squat Thrusts | Squatting, hands on floor | High plank |
| 12 | `adapt_step_back_burpees` | Step-Back Burpees | Squatting, hands on floor | One foot stepped back, the other still in |
| 13 | `adapt_squat_calf_raises` | Squat to Calf Raise | In the squat | Standing tall on tiptoes |
| 14 | `adapt_butt_kicks` | Butt Kicks | Standing | One heel kicked up to glutes, mid-jog |
| 15 | `adapt_butt_kick_march` | Butt Kick March | Standing | One heel curled up behind, other foot flat |
| 16 | `adapt_alternating_reverse_lunge` | Alternating Reverse Lunges | Standing | Bottom of the lunge, back knee low |
| 17 | `adapt_reverse_toe_taps` | Reverse Toe Taps | Standing | One toe tapped behind, shallow front-knee bend |
| 18 | `adapt_slow_climbers` | Slow Mountain Climbers | High plank | One knee drawn in toward chest |
| 19 | `adapt_standing_climbers` | Standing Climbers | Standing, both arms overhead | One knee up, opposite arm pulled down |
| 20 | `adapt_boxer_shuffle` | Boxer Shuffle | Guard up, on balls of feet | Mid-punch, one arm extended |
| 21 | `adapt_step_punch` | Step and Punch | Guard up, feet together | Stepped to side, one arm punching |
| 22 | `adapt_standing_punches` | Standing Punches | Guard up, feet planted | One arm fully extended in a straight punch |

Shoot them in this order: they are grouped by family, so each group needs almost no repositioning.

---

## After the shoot

Drop the files in place and tell Claude — `images` gets filled in for each home-pack movement,
the graph is rebuilt, and the TV bundles them. The photos are yours, so they are licence-clean for
the demo video and the repository.
