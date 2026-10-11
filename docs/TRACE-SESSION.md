# Recording real floor traces

The movement-quality estimators were tuned on synthetic vibration. This session replaces that with real
recordings from your floor, which `npm run tune` scores and which then become permanent regression tests.

About 15 minutes, most of it moving.

## Setup

1. Hard floor if you have one (tile, wood, laminate). Film on the same kind of floor you record on.
2. On the Mac:

   ```bash
   npm run relay:record
   ```

3. iPhone on the same Wi-Fi, ADAPT Sensor installed (`npm run phone:ios` with the phone plugged in).
4. On the phone's pairing screen, tap **Record floor traces**. The button only appears while the relay is
   recording.

## Each take

Pick the take, the floor and the movement, then tap **Record**. Put the phone face up about half a metre to the
side of where you'll move. It counts you in once it's lying still. Start moving on **Go** and follow the prompt
on screen. It saves by itself and tells you how many samples a second it got.

- **Steady**: 45 s at your normal pace the whole way.
- **Fading**: 75 s. Strong for the first 30 s, then, when the prompt changes, let it get slower, softer and
  sloppier, like you're tired.
- **Pick-up**: 30 s of movement. When the screen says **Pick me up now**, lift the phone for about 3 seconds,
  then put it back and keep going.

## The list

| # | Movement | Take | Why |
| --- | --- | --- | --- |
| 1 | Jumping Jacks | Steady | The hero movement of the demo |
| 2 | Jumping Jacks | Fading | Must notice the fade before the strain model does |
| 3 | Jumping Jacks | Pick-up | Must stop trusting a handled phone |
| 4 | Step Jacks | Steady | What Jumping Jacks adapt down to |
| 5 | Step Jacks | Fading | Stepping is measured by rhythm, not landings |
| 6 | High Knees | Steady | A faster impact rhythm |
| 7 | Standing March | Steady | The softest rhythmic signal in the pool |
| 8 | Bodyweight Squat | Steady | Should report reduced confidence, not a score |
| 9 | Jumping Jacks | Steady, **Carpet or mat** | Only if you have one; checks the damped-floor path |

Record a second Steady and Fading of Jumping Jacks if you have the energy. Two takes of the hero movement are
worth more than one of everything else.

## After

```bash
npm run tune
```

Every trace is saved to `packages/data/fixtures/`. Commit them: they become test fixtures, and
`npm run fake-sensor -- --code <code> --replay` replays them into a real session, so a demo take can be repeated
exactly.
