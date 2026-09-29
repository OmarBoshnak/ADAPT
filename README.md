# ADAPT

**Your workout reacts to you.**

An adaptive fitness product for Amazon Fire TV. The TV runs the workout. A phone lies face-up on
the floor beside you and reads motion from its accelerometer and gyroscope. When movement quality
declines, the workout switches to an easier variation on its own — before you ask.

Built for the Amazon Developer Hackathon 2026 · Fire TV track.

---

## The idea in one paragraph

Most fitness apps wait to be told the workout is too hard. ADAPT predicts it. Every movement
carries an intensity value; as a session runs the app accumulates *strain* — intensity multiplied
by time — and weighs it against your profile. When predicted strain crosses a threshold, the
workout adapts on its own. You can still speak up, and when you do, that is not just a command —
it is a correction. The model records that your strain curve is steeper than it assumed and shifts
its threshold for next time.

So there are two distinct moments, and both are visible on screen:

| Moment | What it means |
| --- | --- |
| The system adapts unprompted | **"I noticed"** |
| You correct the system | **"I learned"** |

---

## Project status

| Phase | Scope | State |
| --- | --- | --- |
| 0 | Monorepo, dataset, TV + phone scaffolds, emulator, Vega SDK | ✅ complete |
| 1 | The engine: strain, graph, signal, learning, simulator | ✅ complete |
| 2 | Relay, wire protocol, TV-side session controller | ✅ complete |
| 3 | Vega TV app — all 13 screens | ✅ complete — runs on the Vega Virtual Device |
| 4 | Phone companion — floor sensor, voice, floor mode | ✅ complete — runs natively in the iOS Simulator; the sensor needs a real iPhone |
| 5 | Live integration & tuning | ⬜ next |
| 6 | AWS coach (Bedrock / AgentCore / Strands) | ⬜ |
| 7 | The learning loop on screen | ⬜ |
| 8 | Open source, docs, video, submission | ⬜ |

---

## The engine, and how to watch it think

Everything that makes ADAPT adaptive lives in `packages/core` as pure TypeScript. You can run a
complete session — raw floor-vibration samples through the real estimators, into the real strain
model, out as adaptations and learning — in about a second, with no device:

```bash
npm run graph
```

```bash
npm run sim
```

```bash
npm run sim -- converge
```

`graph` builds and validates the adaptation graph and prints every ladder. `sim` runs the two-session
demo arc and **exits non-zero if it breaks**. `converge` shows the model learning a person it
misjudged by 20%.

What the simulator shows today:

```
   hero moment   Jumping Jacks adapted 65 s in (session 1)  →  21 s in (session 2)
   ✓ Same movement, adapted 68% sooner into it, unprompted, from a lighter plan.

   session   threshold   who acted first        corrections
         1        90.4   person 06:19                    3
         2        70.3   model  06:23                    0     ← the person stops needing to ask
```

**Strain** accumulates as intensity × time, costing more as it builds and as movement degrades,
easing during rests. **The generator** plans each session to reach its threshold about two-thirds
through — *plan to the edge, adapt to stay under*. **Learning** moves the threshold toward the
strain level at which the person actually asked for easier, aiming 3% below it so that once
learned, the model steps in first.

The simulator caught three design flaws along the way: a multiplicative learning rule overshot to
the 0.6 floor and then held people back forever; a plan that absorbed the whole learned bias simply
re-planned the learning away; and without an energy ceiling, short sessions were built from burpees
and split jumps.

### The adaptation graph

| | |
| --- | --- |
| Corpus | 898 exercises — 876 Free Exercise DB + 22 authored |
| Session pool | 29 movements in 9 ladders, 20 of which a session can start on |
| Automatic step-down edges (wider corpus) | 18.5% — deliberately conservative: same pattern, category, equipment and exact muscles, and never "easier" by adding a jump |
| Automatic substitute edges | 82.9% |

Ladders cross sources on purpose — `Star Jump` (dataset) → `Jumping Jacks` → `Step Jacks` →
`Toe-Tap Jacks` — because to the engine they are one graph. Pool intensities are hand-calibrated:
Step Jacks and Toe-Tap Jacks share every field the dataset has, so no formula over those fields
could order them. The formula ranks the rest of the corpus.

### Honest limits

**A phone on the floor feels the floor.** Jumps and jacks leave sharp landings and are measured
well; stepping is measured by rhythm; squats and punches barely register and are reported with
reduced confidence; a plank registers nothing at all, and ADAPT never pretends otherwise — holds
run on the strain prediction alone. Thick carpet damps everything; the estimator notices and lowers
its own confidence. Film on a hard floor.

**The signal estimators are tuned on synthetic traces.** Phase 5 records real traces from a real
floor and re-tunes against them.

**The demo uses a fixed seed** (`5`), chosen because its plan puts Jumping Jacks where the model
first reaches its threshold. The seed picks *which* generated plan is filmed; every adaptation in it
is still computed live.

---

## Repository layout

```
packages/core     The engine. Pure TypeScript, zero platform imports (enforced by ESLint).
packages/data     Vendored Free Exercise DB + the authored ADAPT home movement pack.
apps/tv           Vega OS (React Native for Vega) — the Fire TV app. The product.
apps/tv-fireos    react-native-tvos / Fire OS. Kept as a working fallback, not maintained.
apps/phone        Expo SDK 56 (iOS) — the floor sensor, the microphone, and a big Easier button.
apps/relay        Fastify + ws — pairing and message bus.
services/coach    Python — Strands agent on Bedrock AgentCore.
tools/            Graph builder, headless session simulator, fake sensor.
```

### Why Vega OS

Amazon retired the Fire OS emulator and points developers at a generic Android TV AVD, which is
not obviously "the Fire TV/Vega simulator" the hackathon rules name. The **Vega Virtual Device is
the only simulator Amazon actually ships for Fire TV**, so targeting Vega removes that ambiguity
at no cost rather than accepting it.

Everything this product needs is supported there: `react-native-svg` (the strain curve),
`react-native-reanimated` (the reactive field), `async-storage` (the learned profile), native
WebSocket (the phone relay), and a focus API that is a superset of react-native-tvos —
`TVFocusGuideView`, `hasTVPreferredFocus` and `useTVEventHandler`, plus Vega's own `trapFocus`,
`FocusManager` and `Navigable`.

The Fire OS app under `apps/tv-fireos` builds and runs today. It is insurance, not a second
product — it exists so a late blocker on Vega cannot sink the submission.

`packages/core` is deliberately free of `react-native`, `expo` and `node:*` imports. That purity is
what lets a full session be simulated in milliseconds with no emulator, and what would make a Vega
OS port a view-layer swap rather than a rewrite.

---

## Prerequisites

| Requirement | Version | Notes |
| --- | --- | --- |
| Node | ≥ 20 | developed on 24.6 |
| **JDK** | **17 or 21** | **not 26** — Gradle 9 does not support it. `temurin-21` works. |
| Android SDK | platform 34 + 36, `system-images;android-34;android-tv;x86` | |
| Xcode | 26.x | only for the iOS phone build. The phone stays on Expo SDK 56: SDK 57 needs Xcode 27's Swift |

---

## Running it

```bash
npm install
```

### The TV app on the Vega Virtual Device

Install the [Vega SDK](https://developer.amazon.com/docs/vega/latest/install-vega-sdk.html) (use
`vega sdk install --non-interactive` from scripts), then:

```bash
npm install --prefix apps/tv
```

```bash
vega virtual-device start
```

```bash
npm run tv:build
```

```bash
vega run-app apps/tv/build/x86_64-release/adapttv_x86_64.vpkg com.adapt.tv.main
```

Start the relay first (`npm run relay`) if you want the phone; without it the TV runs solo.

The TV app renders `LiveSession` from `packages/core` and contains no session logic of its own. The Fire OS app in
`apps/tv-fireos` is a working fallback scaffold on the same React Native version.

### The phone companion

Plug in the iPhone, then:

```bash
npm install --prefix apps/phone
```

```bash
npm run phone:ios
```

Needs a real device: the whole point is the accelerometer, and the simulator has none. The simulator still
runs the full pairing and control flow. If `pod install` fails with an encoding error, run it with
`LANG=en_US.UTF-8`.

The relay address is baked in when the app is built — the build machine's LAN address, where `npm run relay`
listens. Set `ADAPT_RELAY_URL=ws://<host>:8787/ws` to override it.

What the phone does, and what it deliberately does not:

- **Reads the floor.** Accelerometer and gyroscope at 50 Hz go through the same `QualityEstimator` the
  simulator uses, inside `SensorSession` from `packages/core` — the fake sensor runs that class too. The
  phone sends a scored frame twice a second, never raw samples.
- **Knows where it is.** It reports when it is lying flat and still, and notices when it is picked up, so the
  TV never adapts on the noise of someone handling it.
- **Listens for four words** — *easier*, *harder*, *swap this*, *pause* — in short rolling windows, and only
  while a session runs. Recognition is on-device only; a phone that cannot do that keeps voice off rather
  than send audio anywhere. Every word also has a button.
- **Stays dark.** While it lies on the floor during a session the screen drops to minimum brightness, and
  comes back the moment it is picked up.

---

## Networking, and the one thing that will confuse you

The relay runs on your development machine. The TV and the phone reach it at **different
addresses**, and the relay prints all of them when it starts:

| Client | Address | Verified |
| --- | --- | --- |
| TV — Vega Virtual Device | `ws://10.0.2.2:8787/ws` | ✅ from inside the device; no setup needed |
| TV — Android TV emulator (Fire OS fallback) | `ws://10.0.2.2:8787/ws` | same alias |
| TV — physical Fire TV over USB | `ws://127.0.0.1:8787/ws` | ✅ after `vega device start-port-forwarding --port 8787 --forward false` |
| Phone on the same Wi-Fi | `ws://<your-lan-ip>:8787/ws` | |

`10.0.2.2` is QEMU's alias for the machine running the emulator. The Vega Virtual Device is QEMU
underneath, so one address works for both TV targets.

If the relay is unreachable, or the phone drops mid-workout, the TV carries on solo without
pausing — a Fire TV and a remote alone is a complete product, and the phone only adds automatic
adaptation on top of it.

### Run the whole loop without a TV or a phone

Three terminals:

```bash
npm run relay
```

```bash
npm run console-tv
```

```bash
npm run fake-sensor -- --code <the code console-tv shows>
```

`console-tv` runs the same `LiveSession` class the Vega app renders, and `fake-sensor` the same
`SensorSession` the phone runs, so pairing, the per-exercise sequence numbers, solo fallback and
learning from a spoken "easier" are the real behaviour, printed instead of drawn. In `fake-sensor`,
press `e` to say "easier", `s` for "swap this", `p` to pause, `r` to resume, and `d` to drop off the
network for eight seconds. Both take `--speed 6` to run a 12-minute session in two.

---

## Design constraints worth knowing before you read the code

**There is no camera.** Movement quality comes from phone accelerometer and gyroscope signal only.
Nothing in this product observes the user visually, and nothing in the interface implies it does.

**Fire TV has no microphone.** Confirmed during Phase 0 — the devices ship none, and the remote's
mic is reserved for Alexa at system level. Voice capture therefore lives on the phone, and a D-pad
press is an equally first-class correction. See [FL-001](docs/FRICTION-LOG.md).

**Design pixels are not density pixels.** The design spec is written against a 1920×1080 canvas;
React Native sees 960×540 dp on a 320-density TV. All measurements go through a `px()` scaler. See
[FL-004](docs/FRICTION-LOG.md).

**The profile only excludes.** Age, height, weight, injuries and conditions narrow which movements
are eligible. They are never shown back, never scored, never interpreted. `npm run audit:copy`
fails the build on body-composition language, clinical language, alarm framing, camera claims, or
any red in the palette.

---

## Verification

```bash
npm run verify
```

Runs typecheck, lint, unit tests and the copy audit.

---

## Data

Exercise content comes from [Free Exercise DB](https://github.com/yuhonas/free-exercise-db)
(Unlicense, public domain), vendored at commit `a859101`. It supplies 876 exercises with real
demonstration photographs.

It is a gym corpus, not a home-workout one — only 111 entries are equipment-free, and just 18 of
those have a strictly-easier peer to step down to. ADAPT therefore supplements it with a small
authored pack of no-equipment rhythmic movements carrying hand-authored adaptation edges. Every
record declares its `source`, so provenance is always visible. Details in
[PRODUCT-FEEDBACK.md](docs/PRODUCT-FEEDBACK.md).

---

## Licence

Apache-2.0. The vendored dataset retains its own Unlicense terms.
