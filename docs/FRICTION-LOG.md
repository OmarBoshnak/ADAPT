# Friction Log — ADAPT

Kept live from day one of the build, not reconstructed at submission. Each entry records
a task we actually attempted, what we expected, what happened, and what would have saved
us the time.

Severity scale: **blocker** (stopped work until resolved) · **major** (cost hours, or forced
a design change) · **minor** (cost minutes, or was merely confusing).

---

## FL-001 — Discovering that Fire TV apps cannot access a microphone

- **Date:** 2026-09-20
- **Platform/tool:** Fire TV — voice input
- **Severity:** blocker (forced a core product redesign)

**Task attempted.** Our product's headline interaction is the user saying "easier" mid-workout
and the app adapting. We set out to find which Fire TV API delivers a custom spoken word to a
foreground app.

**Steps taken.** Read *Overview for Voice-enabling Your App and Content on Fire TV*, then the
Video Skills Kit, Media Session API, and In-App Voice Scrolling and Selection pages. When none
of them described custom utterances, searched the developer forums.

**Expected.** That at least one documented path would let a foreground app receive an arbitrary
spoken word, or that a single prominent sentence would tell us it is impossible.

**Actual.** All three documented paths accept only predefined utterances — transport controls,
content search, or directional navigation. The decisive fact, that *Fire TV devices have no
microphone and apps cannot access the remote's mic*, was found in a forum answer, not in the
voice documentation. We had already designed a screen around the assumption.

**Workaround.** Moved voice capture to the paired phone (on-device `SFSpeechRecognizer` via
`expo-speech-recognition`) and made a D-pad press an equally first-class correction input, so the
TV-only experience stays complete.

**Suggestion.** Put one sentence at the top of the voice-enablement overview: *"Fire TV devices
do not expose a microphone to apps. The remote's microphone is reserved for Alexa. Apps cannot
receive custom spoken commands."* It would have saved us a day and a design rewrite. A short
"Voice options and what they cannot do" comparison table would help further.

---

## FL-002 — No Fire OS emulator; unclear whether an Android TV AVD satisfies submission rules

- **Date:** 2026-09-20
- **Platform/tool:** Fire TV — local development / hackathon submission rules
- **Severity:** major

**Task attempted.** Set up a local Fire TV testing target without buying hardware. The hackathon
rules accept "an actual Fire TV device or the Fire TV/Vega simulator."

**Steps taken.** Searched for a Fire OS emulator image. Found Amazon's own documentation directing
developers to create a generic **Android TV** AVD instead.

**Expected.** A downloadable Fire OS system image, or an explicit statement that Android TV AVDs
are the supported substitute and are acceptable for demonstrating a Fire TV app.

**Actual.** No Fire OS emulator exists. Amazon documents the Android TV AVD as the substitute, but
that AVD is not branded or behaviourally identical to Fire TV — and the hackathon rules name "the
Fire TV/Vega simulator," leaving genuine ambiguity about whether an Android TV AVD qualifies.

**Workaround.** Budgeting for a physical Fire TV Stick rather than risk a compliance question on
the submission.

**Suggestion.** Either ship a Fire OS emulator image, or state plainly in both the Fire TV docs and
the hackathon rules that an Android TV AVD is an accepted stand-in. The ambiguity pushes a hardware
purchase onto developers evaluating the platform for the first time — exactly the audience least
likely to absorb it.

---

## FL-003 — Vega API overview omits whole capability categories

- **Date:** 2026-09-20
- **Platform/tool:** Vega OS — API documentation
- **Severity:** minor (at evaluation stage; would be major if we had committed to Vega first)

**Task attempted.** Decide between Fire OS and Vega OS by checking whether Vega supports the
capabilities our app needs: outbound WebSocket, local network access, and persistent storage.

**Steps taken.** Read the Vega APIs overview page and the supported-libraries page.

**Expected.** A capability matrix, or at least a networking section.

**Actual.** The overview enumerates media playback, file system, audio, parental controls,
identifiers and graphics — with no networking entry at all. Confirming that standard React Native
`fetch` and `WebSocket` work required a third-party blog post rather than Amazon's documentation.

**Suggestion.** Add a "what's supported / what isn't" capability matrix to the Vega API overview,
covering networking, storage, sensors and background execution. Teams choosing between Fire OS and
Vega make that call early and on incomplete information.

---

## FL-004 — Fire TV design guidance is in pixels; React Native lays out in dp, with no bridge documented

- **Date:** 2026-09-21
- **Platform/tool:** Fire TV — design guidelines vs react-native-tvos
- **Severity:** major

**Task attempted.** Render our first TV screen using the measurements from our 1920×1080 design
spec — 96px safe area, 76px headings, 240px imagery.

**Steps taken.** Wrote the spec's values directly as React Native style values and ran the app on
an Android TV AVD built from the 1080p profile.

**Expected.** That a 1920×1080 TV surface would give a 1920×1080 layout space, or that the Fire TV
design documentation would say what it actually gives you.

**Actual.** The device reports density 320, so React Native sees **960×540 dp**. Every measurement
rendered at exactly double its intended size, and a three-card row that should fit comfortably
overflowed the screen with the third card entirely invisible. Nothing in the Fire TV design
guidance or the React Native for Fire OS getting-started material mentions this conversion, even
though Amazon's own design guidance is expressed in pixels against a 1920×1080 canvas.

**Workaround.** A scaling helper that converts design pixels to dp against the live window width:
`px(n) => n * windowWidth / 1920`. Scaling against the real window rather than a hardcoded divisor
means the same code is correct on a 720p stick, a 1080p stick and a 4K Cube.

**Suggestion.** Add a short "design pixels vs density pixels" section to the React Native for Fire
OS guide, with exactly this helper and the density values of the current Fire TV device range. This
is the first thing every developer hits when translating a design into a Fire TV app, it silently
produces a plausible-looking but wrong layout, and it is three lines of documentation to prevent.

---

<!--
Template for new entries:

## FL-00N — <one-line title>

- **Date:**
- **Platform/tool:**
- **Severity:** blocker | major | minor

**Task attempted.**
**Steps taken.**
**Expected.**
**Actual.**
**Workaround.**
**Suggestion.**
-->
