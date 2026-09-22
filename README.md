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

Phase 0 complete — foundations and platform de-risking. See [the build plan](docs/) for phases.

| Phase | Scope | State |
| --- | --- | --- |
| 0 | Monorepo, dataset, TV + phone scaffolds, emulator | ✅ complete |
| 1 | The engine: strain, graph, signal, learning | ⬜ next |
| 2 | Relay + wire protocol | ⬜ |
| 3 | TV app — 13 screens | ⬜ |
| 4 | Phone companion | ⬜ |
| 5 | Live integration & tuning | ⬜ |
| 6 | AWS coach (Bedrock / AgentCore / Strands) | ⬜ |
| 7 | The learning loop on screen | ⬜ |
| 8 | Open source, docs, video, submission | ⬜ |

---

## Repository layout

```
packages/core     The engine. Pure TypeScript, zero platform imports (enforced by ESLint).
packages/data     Vendored Free Exercise DB + the authored ADAPT home movement pack.
apps/tv           react-native-tvos — the Fire OS app. The product.
apps/phone        Expo — the floor sensor and microphone.
apps/relay        Fastify + ws — pairing and message bus.
services/coach    Python — Strands agent on Bedrock AgentCore.
tools/            Graph builder, headless session simulator, fake sensor.
```

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
| Xcode | 26.x | only for the iOS phone build |

---

## Running it

### 1. The TV app

```bash
npm install
```

Create the Android TV emulator once:

```bash
$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager create avd -n AdaptFireTV -k "system-images;android-34;android-tv;x86" -d tv_1080p
```

Boot it, then build and run:

```bash
$ANDROID_HOME/emulator/emulator -avd AdaptFireTV -gpu auto
```

```bash
cd apps/tv && JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home npx react-native run-android
```

Drive it with the arrow keys — the AVD is configured with `hw.keyboard=yes`, so host arrows act as
the D-pad.

### 2. The phone companion

```bash
cd apps/phone && npx expo run:ios --device
```

Needs a real device: the whole point is the accelerometer, and the simulator has none.

---

## Networking, and the one thing that will confuse you

The relay runs on your development machine. The two clients reach it at **different addresses**:

| Client | Address | Why |
| --- | --- | --- |
| TV (Android emulator) | `ws://10.0.2.2:8787` | `10.0.2.2` is the AVD's alias for the host loopback |
| TV (real Fire TV) | `ws://<your-lan-ip>:8787` | |
| Phone (real iPhone) | `ws://<your-lan-ip>:8787` | over the same WiFi |

Both hit the same process. If the relay is unreachable the TV runs standalone — a Fire TV and a
remote alone is a complete product, and the phone only adds automatic adaptation on top of it.

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
