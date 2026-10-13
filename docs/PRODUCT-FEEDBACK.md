# Product Feedback — ADAPT

Required submission field: feedback on every tool, API and SDK used — what we used it for, what
worked, what needs work, how onboarding felt, and whether we would build with it again.

Filled in as we go, so the answers describe what actually happened rather than what we remember in
October.

Status key: ✅ shipped with it · 🚧 in progress · ⬜ not started yet

---

## Amazon

### Fire TV / Fire OS — ✅ as the platform, with Vega as the OS we shipped on

**What we used it for.** Primary track. The TV app is the product: profile capture, workout
generation, the live session, and the adaptation moment all run here. We started on Fire OS and moved
to Vega OS for the reasons below. A working Fire OS build stays in `apps/tv-fireos` as a fallback.

**What worked well.** The 10-foot design guidance is clear and opinionated in a useful way. Designing
for a remote with a D-pad forced every screen to have one obvious next action, which is the right
constraint for something you use mid-workout and out of breath. "Down for easier" turned out to be as
natural a correction as saying it.

**What needs work.** The voice story is the weak point. Three documented voice paths exist and none
of them lets a foreground app hear a custom word, because the devices have no app-accessible
microphone — a fact documented in forums rather than in the voice guide. See FL-001. This forced a
redesign of our headline interaction on day one.

The absence of a Fire OS emulator (FL-002) is the other friction point: the first thing a new
developer wants is to run something without buying hardware, and the answer is an Android TV AVD
that may or may not satisfy a reviewer.

**Onboarding.** Fast to a running app on hardware, slow without hardware. The documentation assumes
a device on the desk.

**Would we build with it again?** Yes. The living room is the right place for this product, and the
remote's constraints made the interface better.

### react-native-tvos — ✅ fallback only

**What we used it for.** The Fire OS fallback app, pinned at `0.83.0-0` — the newest release with a
matching project template (FL-006).

**What worked well.** The focus API transferred to Vega unchanged: `TVFocusGuideView`,
`hasTVPreferredFocus` and `useTVEventHandler` behave the same on both, so the fallback costs nothing
to keep.

**What needs work.** The template lagging the runtime by four minor versions (FL-006) is the one thing
that makes starting a new project harder than it should be.

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

**Building on it (Phase 3).** The TV app is React Native 0.83 on Vega. Porting 13 designed screens went smoothly:
`Pressable` focus events, `hasTVPreferredFocus` and `TVFocusGuideView` with `trapFocusLeft/Right` covered every
navigation need, the ported `react-native-svg` drew the live strain chart unchanged. Custom fonts load by filename from `assets/fonts/` with no configuration. A WebSocket from
inside the app reached a relay on the host at `10.0.2.2` first time. `inputd-cli button_press` made it possible to
drive the entire onboarding-to-workout flow unattended.

**The sharp edges** were a custom Metro resolver silently removing Vega's React Native (FL-008 — a build-time
check would fix it), the lack of any CLI screenshot (FL-009), and the `AsyncStorage` exported by
`react-native-kepler`, which lost the most recent save when the app was stopped (FL-016). That one mattered most:
it silently broke the learning loop across restarts, and only an on-device test that logged each save and load
found it. The supported `async-storage` package fixed it.

**Onboarding.** Good once past the installer (FL-005): the `helloWorld` template builds in under a minute, and a
release package with Hermes bytecode is about 1 MB.

**Would we build with it again?** Yes. The platform itself was never the obstacle — the gaps are all in tooling and
documentation, and each has a small, specific fix.

---

## AWS

### Amazon Bedrock — ✅ calling Claude

**What we used it for.** Claude Sonnet 4.6 (`us.anthropic.claude-sonnet-4-6`) does two short jobs: ordering a
session's movements from a pre-filtered list, and writing the one sentence on the post-session "What changed" card.
Called through the Anthropic SDK's Bedrock client, at low effort. The TV asks while the viewer is still on the setup
screen and waits at most four seconds after Generate.

**What worked well.** The model is used for what it is good at, choosing well among valid options and writing
plainly, and nothing it says can reach the screen unchecked. Keeping it out of the safety path was easy because the
contract is small: candidates in, an ordered list of ids out.

**What needs work.** Model access was the most confusing part of Bedrock. The catalog lists Claude Opus 5.5 as active and
the availability API says the account is authorized, but every call is refused as "not available for this account",
and the same API gives an identical answer for models that do work (FL-014). We found what this account can call only
by probing each model. There are also two ways to call Claude on Bedrock, InvokeModel/Converse and the Messages-API
endpoint (bedrock-mantle), with different IAM actions and different model availability; tooling built for one doesn't
grant the other (FL-011).

### Bedrock AgentCore — ✅ deployed

**What we used it for.** Hosting the coach agent as an HTTP runtime in us-east-1. The relay invokes it with
`InvokeAgentRuntime` and keeps one session warm with a ping every ten minutes. The TV asks while the viewer is still on
the setup screen and falls back to its local generator four seconds after Generate.

**What worked well.** The runtime protocol is simple: `POST /invocations` and `GET /ping`. The same entrypoint runs
locally with `uv run python main.py`, so the whole relay → coach path was tested before any deploy. The AgentCore CLI's
bring-your-own-code path wrapped an existing agent without restructuring it, and `agentcore package` builds the
CodeZip offline. The deploy itself was one command, CDK bootstrap included, and it saves the runtime ARN to a state
file our relay script reads. Warm calls add little: a plan takes five to seven seconds end to end, about what the
model takes locally.

**What needs work.** The starter toolkit and the AgentCore CLI share a binary name and differ in project model, and the
toolkit's deprecation only shows in help output (FL-010). The default runtime role lacks the permission the
Messages-API Claude client needs (FL-011). A call that arrives while a session is still starting gets a bare 502
("check your CloudWatch logs") and never reaches the container, so it leaves no log; we queue calls behind a warm-up
ping (FL-015).

### Strands Agents SDK — ✅

**What we used it for.** The coach agent: a system prompt, one tool (`validate_plan`, so the agent checks its own
answer), and a Pydantic structured-output model. Python, `strands-agents` 1.57.

**What worked well.** Tools are plain decorated functions, and closures give each request its own context with no
global state. Structured output returns a typed Pydantic object, which made the server-side re-check a few lines.

**What needs work.** `AnthropicModel` can't take a client (so no Bedrock), and its structured output forces tool
choice, which current Claude models reject (FL-012). Both fixed in a 15-line subclass.

**Would we build with it again?** Yes. The agent definition is short enough to read in one screen, which matters when
the model sits near a health-adjacent product.

## Open data

### Free Exercise DB (`yuhonas/free-exercise-db`) — ✅

**What we used it for.** The exercise corpus: 876 exercises with real demonstration photographs,
released under the Unlicense, vendored into the repo at commit `a859101`.

**What worked well.** Genuinely excellent for what it is. Public-domain licensing for the data made
it easy to vendor, and the consistent schema and combined `dist/exercises.json` needed no
preprocessing.

**What needs work.** It is a gym corpus, and we needed a home-workout one. Concretely, measured
against the shipped data:

- The photographs' origin is not documented. They came from `wrkout/exercises.json`, which states no source for
  them, so the Unlicense on the repository cannot be taken as a licence for the images. We treat their reuse rights
  as unverified.
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
