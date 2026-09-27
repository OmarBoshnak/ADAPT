# Product Feedback — ADAPT

Required submission field: feedback on every tool, API and SDK used — what we used it for, what
worked, what needs work, how onboarding felt, and whether we would build with it again.

Filled in as we go, so the answers describe what actually happened rather than what we remember in
October.

Status key: ✅ shipped with it · 🚧 in progress · ⬜ not started yet

---

## Amazon

### Fire TV / Fire OS — 🚧

**What we used it for.** Primary track. The TV app is the product: profile capture, workout
generation, the live session, and the adaptation moment all run here.

**What worked well.** *(fill in during Phase 3)*

**What needs work.** The voice story is the weak point. Three documented voice paths exist and none
of them lets a foreground app hear a custom word, because the devices have no app-accessible
microphone — a fact documented in forums rather than in the voice guide. See FL-001. This forced a
redesign of our headline interaction on day one.

The absence of a Fire OS emulator (FL-002) is the other friction point: the first thing a new
developer wants is to run something without buying hardware, and the answer is an Android TV AVD
that may or may not satisfy a reviewer.

**Onboarding.** *(fill in)*

**Would we build with it again?** *(fill in)*

### react-native-tvos — 🚧

**What we used it for.** The Fire OS fallback app, pinned at `0.83.0-0` — the newest release with a
matching project template (FL-006).

*(fill in during Phase 3: focus engine, `TVFocusGuideView`, `useTVEventHandler`, how well the
10-foot focus model held up.)*

### Vega OS / Vega Developer Tools — 🚧 adopted as the primary TV target

**What we are using it for.** The TV app. We moved from Fire OS to Vega because the Vega Virtual
Device is the only simulator Amazon ships for Fire TV — the Android TV AVD recommended for Fire OS
is not obviously what the hackathon rules mean by "the Fire TV/Vega simulator" (FL-002).

**What worked well.** The installer handles Intel Macs explicitly, and the Vega Virtual Device
booted in 36 seconds on a 2018 Intel i7.
Every React Native library we need is already ported: `react-native-svg`, `reanimated`,
`async-storage`, `gesture-handler`, `safe-area-context`. The focus API is a superset of
react-native-tvos (`trapFocus`, `FocusManager`, `Navigable`), so D-pad work transfers.

**What needs work.** The installer and `vega sdk install` hang or half-fail in non-interactive
shells, and the `--non-interactive` flag that fixes it is undocumented in the install guide
(FL-005). The API overview omits whole capability categories such as networking (FL-003).

**Onboarding.** *(fill in during Phase 3)*

---

## AWS

### Amazon Bedrock — ⬜

**Planned use.** Claude generates the session plan by selecting and sequencing from a
pre-filtered candidate set, and writes the post-session narrative from the real strain trace.

### Bedrock AgentCore — ⬜

**Planned use.** Hosting the coach agent.

### Strands Agents SDK — ⬜

**Planned use.** Agent definition and tool wiring (`get_eligible_exercises`,
`get_strain_budget`, `validate_plan`), pinned at `1.56.0` (Python).

---

## Open data

### Free Exercise DB (`yuhonas/free-exercise-db`) — ✅

**What we used it for.** The exercise corpus: 876 exercises with real demonstration photographs,
released under the Unlicense, vendored into the repo at commit `a859101`.

**What worked well.** Genuinely excellent for what it is. Public-domain licensing made it safe to
vendor and to show on video with no attribution burden. Consistent schema, real photography, and a
combined `dist/exercises.json` that needed no preprocessing.

**What needs work.** It is a gym corpus, and we needed a home-workout one. Concretely, measured
against the shipped data:

- 584 of 876 entries are `strength`; only 14 are `cardio` and 61 `plyometrics`.
- Only 111 entries are `body only`, of which just 13 are cardio or plyometrics.
- Of those 111, only **18 have a strictly-easier peer** sharing their muscles and category — so a
  difficulty ladder cannot be derived from the `level` field for the great majority of them.
- `equipment` is unreliable: `Flat Bench Leg Pull-In` and `Decline Crunch` are filed `body only`
  despite requiring a bench.
- `force`, `mechanic` and `equipment` are `null` on 30, 87 and 77 entries respectively.
- Common household movements are simply absent — no jumping jacks, burpees, high knees, or
  marching, verified by searching names *and* instruction text.

**How we responded.** Kept the dataset for breadth, metadata and imagery, and authored a small
supplementary pack of no-equipment rhythmic movements with hand-authored adaptation edges. Both
sources are tagged so provenance is always visible.

**Would we use it again?** Yes, without hesitation, for breadth and imagery — with the expectation
of supplementing it for any home-workout use case.
