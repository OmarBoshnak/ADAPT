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

## FL-005 — Vega SDK installer hangs silently in a non-interactive shell

- **Date:** 2026-09-22
- **Platform/tool:** Vega Developer Tools — `get_vvm.sh` installer and `vega sdk install`
- **Severity:** major

**Task attempted.** Install the Vega SDK from a scripted, non-interactive shell — the way CI,
provisioning scripts and AI coding agents run commands.

**Steps taken.** Ran the documented one-line installer, then `vega sdk install`.

**Expected.** A completed install, or a clear failure naming the missing input.

**Actual.** Two separate problems. The installer's setup step prompted for an SDK directory and,
receiving no terminal, failed with `failed to get SDK path: failed to read input: EOF` — after the
CLI itself had already installed, leaving a half-configured state. Then `vega sdk install` produced
**zero bytes of output for several minutes** while blocked on an invisible prompt, indistinguishable
from a slow download. The `--non-interactive` flag that fixes both exists, but is only discoverable
through `vega sdk install --help`; the install guide never mentions it.

**Workaround.** `vega sdk install --non-interactive`, which then completed cleanly.

**Suggestion.** Detect a non-TTY stdin and either default to non-interactive mode or fail
immediately with "stdin is not a terminal — re-run with --non-interactive". Document the flag in the
install guide. A silent hang is the worst possible failure mode: it costs the time it takes someone
to decide it is not just slow.

**What worked well, for balance.** Once installed, it was excellent. The installer handles Intel
Macs explicitly (`Darwin x86_64`), and the Vega Virtual Device booted in **36 seconds** on a 2018
Intel i7.

---

## FL-006 — The react-native-tvos project template lags the runtime by four minor versions

- **Date:** 2026-09-21
- **Platform/tool:** Fire TV — React Native for Fire OS (react-native-tvos, as recommended by Amazon's docs)
- **Severity:** minor

**Task attempted.** Scaffold a Fire OS app on the current react-native-tvos release, `0.87.1-1`.

**Steps taken.** `npx @react-native-community/cli init --version npm:react-native-tvos@0.87.1-1`.

**Expected.** A project on 0.87.

**Actual.** `Unable to find a template for react-native version`. The TV template is a separate
package, `@react-native-tvos/template-tv`, whose newest release is `0.83.0-0`. The runtime and the
template are four minor versions apart, and the Fire TV getting-started guide does not name the
template package at all.

**Workaround.** Pinned the matched `0.83` pair rather than mixing a 0.83 template with a 0.87
runtime, which is a reliable source of native build errors.

**Suggestion.** Name `@react-native-tvos/template-tv` in the Fire TV React Native guide, with the
exact `init` command, and note which runtime version it currently pairs with.

---

## FL-007 — How the Vega Virtual Device reaches the development machine is not documented

- **Date:** 2026-09-28
- **Platform/tool:** Vega Virtual Device — networking
- **Severity:** minor

**Task attempted.** Point the TV app at a WebSocket relay running on the development machine — the
first thing any app with a companion device or a local backend needs.

**Steps taken.** Looked for the host address in the *Run your app on Vega Virtual Device or Fire TV
Stick* guide. Found nothing, so tested empirically: `vega device run-cmd` with `curl` against
`10.0.2.2` (QEMU's conventional host alias), then `vega device start-port-forwarding --forward
false` against `127.0.0.1`.

**Expected.** One sentence in the run guide naming the address.

**Actual.** Both work — `10.0.2.2` with no setup, `127.0.0.1` after reverse forwarding — but
neither is mentioned in the run guide, so each developer has to rediscover it.

**What worked well.** Verifying it was genuinely pleasant: the device image ships `curl`, `wget` and
`busybox`, and `run-cmd` plus reverse port forwarding (Vega's `adb reverse`) made it a two-minute
check rather than a guessing game.

**Suggestion.** Add a "Reaching your development machine" note to the run guide: `10.0.2.2` from the
Virtual Device, reverse port forwarding for a device over USB, and the machine's LAN IP for Wi-Fi.

---

## FL-008 — A custom Metro `resolveRequest` silently removes Vega's React Native, and the app crashes on launch

- **Date:** 2026-09-28
- **Platform/tool:** Vega — Metro configuration / `build-vega`
- **Severity:** blocker

**Task attempted.** Add a `~/` import alias to a Vega app, the most common Metro customisation there is.

**Steps taken.** Added a `resolver.resolveRequest` to `metro.config.js`, merged over `getDefaultConfig()` exactly as
the React Native docs describe.

**Expected.** Either a working build, or a build-time error.

**Actual.** The build succeeded with zero manifest errors. The app installed, launched, and died instantly with
SIGABRT on the JS thread. The cause was only visible after pulling the crash tombstone with `vega device copy-logs
--artifact SYSTEM_TOMBSTONE/acr`: `TypeError: Cannot read property 'select' of undefined` deep inside React Native's
`UIManager`. Vega's `react-native` → `@amazon-devices/react-native-kepler` redirect is installed as the *framework
default* `resolveRequest` inside `getDefaultConfig()`; any app-level `resolveRequest` replaces it, the stock
`react-native` gets bundled instead, and its `Platform` has no Vega implementation. Nothing in the build output
hints at this — the only visible sign is the app bundle being twice its correct size (3.9 MB instead of 1.8 MB).

**Workaround.** Capture `getDefaultConfig().resolver.resolveRequest` and delegate to it from the custom resolver.

**Suggestion.** Either wrap app resolvers rather than being replaced by them, or fail the build when stock
`react-native` modules end up in a Vega bundle — a one-line check that would have turned an hour of tombstone
archaeology into an immediate, readable error. A note in the Metro section of the Vega docs would help too.

**What worked well, for balance.** The tombstone itself was excellent: a full, symbolicated JavaScript stack in the
crash report, one CLI command away.

---

## FL-009 — No way to screenshot the Vega Virtual Device from the CLI

- **Date:** 2026-09-28
- **Platform/tool:** Vega Virtual Device — development tooling
- **Severity:** major

**Task attempted.** Capture the screen of the Virtual Device to verify UI, for automated checks and for the demo
video's still frames.

**Steps taken.** Looked for a `vega device screenshot` command (there is none). Tried the device's own
`screenshooter` over `vda shell` (fails: `creating a buffer file for 8294400 B failed: Permission denied` as
`app_user`; `vda root` is refused on production images). Tried QEMU's QMP `screendump` on the exposed socket (returns a
correct 1920×1080 frame that is entirely black — the display is GPU-composited). macOS window capture works only
after granting the host app Screen Recording permission.

**Update, 2026-10-11.** With Screen Recording granted, a full-screen capture shows the desktop where the Virtual Device
window is, and `screencapture -l <window id>` fails with "could not create image from window": the window is excluded
from capture. On the device, `gwsi-tool-screenshooter` segfaults for `app_user`. We verify on-device behaviour through
the app's own log lines instead, which `loggingctl log -f -v <package>` shows as long as the log session is started
after the app is installed.

**Expected.** `vega device screenshot out.png`, as `adb exec-out screencap` provides on Android.

**Actual.** No supported path. Everything else needed for automated UI testing exists — `inputd-cli button_press
KEY_DOWN` injects remote presses perfectly — which makes the missing screenshot the single gap.

**Suggestion.** Add `vega device screenshot`, or let `screenshooter` run for dev-mode shells. It would make automated
visual checks possible, and every developer recording a submission video needs it.

---

## FL-010 — The AgentCore starter toolkit announces it is unsupported, after you have built on it

- **Date:** 2026-10-05
- **Platform/tool:** Amazon Bedrock AgentCore — `bedrock-agentcore-starter-toolkit` 0.3.13 vs `@aws/agentcore` CLI 0.31
- **Severity:** minor

**Task attempted.** Deploy a Python Strands agent to AgentCore Runtime.

**Steps taken.** Followed the widely linked starter-toolkit flow (`pip install bedrock-agentcore-starter-toolkit`,
`agentcore configure`, `agentcore launch`). Running `agentcore configure --help` printed: "The Starter Toolkit CLI is no
longer supported. Please use the AgentCore CLI (@aws/agentcore)". Moved to the npm CLI: `agentcore create --no-agent`,
then `agentcore add agent --type byo --code-location . --entrypoint main.py`.

**Expected.** One documented path, or the deprecation surfaced at install time.

**Actual.** Two CLIs with the same binary name (`agentcore`), different project models (YAML vs `agentcore.json` +
CDK), and the deprecation only visible in help output. `agentcore create` also runs `git init`, which is a surprise
inside an existing monorepo.

**Workaround.** Created the project in a scratch directory and moved only `agentcore/` into the service. The BYO path
itself worked well: `agentcore package` produced a correct 30 MB CodeZip with no AWS credentials needed.

**Suggestion.** Deprecate the PyPI package with a warning on install, and let `agentcore create` skip `git init` when
run inside a repository.

---

## FL-011 — The AgentCore Runtime role cannot call Claude through Bedrock's Messages-API endpoint

- **Date:** 2026-10-05
- **Platform/tool:** `@aws/agentcore-cdk` runtime construct; Amazon Bedrock (bedrock-mantle)
- **Severity:** major (found before deploy, by reading the construct)

**Task attempted.** Call Claude from the agent with the Anthropic SDK's Bedrock client (`AnthropicBedrockMantle`),
which Anthropic recommends for new code and which is how current Claude models are addressed on Bedrock
(`anthropic.claude-opus-5-5`).

**Steps taken.** Read the generated execution role in `AgentCoreRuntime.js`. It grants `bedrock:InvokeModel`,
`InvokeModelWithResponseStream` and `CountTokens` on foundation models and inference profiles, but not
`bedrock-mantle:CreateInference`. The harness role in the same package does grant it, but only for its own
Responses/ChatCompletions modes.

**Expected.** A runtime that is created with "model access" can reach the model through either Bedrock endpoint.

**Actual.** It would have failed at the first model call after a successful deploy.

**Workaround.** Added the statement to the project's `cdk-stack.ts` for every runtime role. (Later removed: the coach moved to the
InvokeModel endpoint, which the default role covers. See FL-014.)

**Suggestion.** Include `bedrock-mantle:CreateInference` in the runtime role by default, or add a `modelAccess` option
to `agentcore.json`.

---

## FL-012 — Strands structured output forces a tool choice that current Claude models reject

- **Date:** 2026-10-05
- **Platform/tool:** Strands Agents 1.57 — `AnthropicModel`; Claude Opus 5.5
- **Severity:** major

**Task attempted.** Get a Pydantic-typed answer from a Strands agent (`structured_output_model=PlanReply`) running on
Claude Opus 5.5.

**Steps taken.** Read `AnthropicModel._format_tool_choice`: Strands sends `tool_choice: {"type": "any"}` or
`{"type": "tool"}` when it needs the structured-output tool called. Claude Opus 5.5, Sonnet 5.5 and Fable 5.1 return
400 for forced tool choice. Separately, `AnthropicModel` always builds a first-party `AsyncAnthropic` client, so there is
no supported way to point it at Bedrock.

**Expected.** A provider option for forced-choice support, and a way to pass a client.

**Actual.** Both had to be worked around in a 15-line subclass: replace `self.client` with
the SDK's Bedrock client, and map forced choices to `auto` (the system prompt already asks for the tool).

**Suggestion.** Accept a `client=` argument on `AnthropicModel`, and fall back to `auto` plus an instruction when the
model rejects forced tool use.

---

## FL-013 — Expo SDK 57 requires Xcode 27, and the failure surfaces as Swift errors in a nested build

- **Date:** 2026-09-29
- **Platform/tool:** Expo SDK 57 (`expo-modules-jsi` 57.1), Xcode 26.3 on an Intel Mac
- **Severity:** blocker (resolved by downgrading)

**Task attempted.** Build the phone companion for the iOS Simulator.

**Actual.** `Build ExpoModulesJSI xcframework` failed: first on `SWIFT_RETURNS_RETAINED` on constructors, then on
Swift 6 region-isolation errors, then on syntax only Swift 6.3 accepts. The changelog shows these were Xcode 27 fixes.
Nothing in `expo doctor` or the SDK release notes said Xcode 27 was required, and this Mac cannot run it.

**Workaround.** Stayed on Expo SDK 56, which builds cleanly on Xcode 26.3. React Native 0.86's prebuilt core tarball
also failed checksum twice when fetched over a flaky connection; pre-fetching with `curl -C - --retry` into
`~/Library/Caches/ReactNative` fixed it.

**Suggestion.** State the minimum Xcode per SDK in `expo doctor`, and retry downloads before verifying checksums.

---

## FL-014 — Claude models listed as active and authorized, then refused as "not available for this account"

- **Date:** 2026-10-11
- **Platform/tool:** Amazon Bedrock — Claude model access, us-east-1
- **Severity:** major (forced a model change twelve days before the deadline)

**Task attempted.** The coach's first real call to Claude Opus 5.5 on Bedrock, after signing in with `aws login`.

**Steps taken.** `list-foundation-models` lists `anthropic.claude-opus-5-5` as `ACTIVE`, and
`get-foundation-model-availability` reports it `AUTHORIZED`, entitlement `AVAILABLE`, region `AVAILABLE`. Every call
returned 403: "anthropic.claude-opus-5-5 is not available for this account … contact AWS Sales". We then probed each
Claude model with a one-line request. Through InvokeModel and Converse, Opus 4.6, Opus 4.5, Sonnet 4.6 and Haiku 4.5
answered; Opus 4.7 and later, Sonnet 5 and later, Haiku 5.5 and Fable were refused. Through the Messages-API endpoint
(bedrock-mantle) every model was refused or not found, including Haiku 4.5, which works through Converse.

**Expected.** The catalog or the availability API says which models this account can call, or the error names what is
missing (an agreement, a quota, an account requirement) and how to get it.

**Actual.** The availability API returns the same answer for Haiku 4.5, which works, and Opus 5.5, which is refused.
The only path offered is contacting sales.

**Workaround.** Moved the coach to the Anthropic SDK's InvokeModel client and Claude Sonnet 4.6
(`us.anthropic.claude-sonnet-4-6`), which the default AgentCore role already allows, and removed the FL-011 grant. The
model is a setting, so a newer one is a configuration change once the account has access.

**Suggestion.** Return an explicit reason from `get-foundation-model-availability` when invocation will be refused, and
show it beside the model in the console's catalog.

---

## FL-015 — A call to an AgentCore session that is still starting fails with a 502 and leaves no log

- **Date:** 2026-10-11
- **Platform/tool:** Bedrock AgentCore Runtime — `InvokeAgentRuntime`
- **Severity:** major (the first coach call after every relay start failed)

**Task attempted.** Keep the coach warm: when the relay starts, it pings the runtime with the session id it will use
for real calls.

**Steps taken.** Started the relay and sent a request about a second later. The relay's call failed with
`RuntimeClientError: Received error (502) from runtime. Please check your CloudWatch logs for more information.` The
runtime's log group had no trace of it: only the ping, which completed two seconds after the failure. The same request
sent once the ping had answered succeeded, and so did later ones.

**Expected.** A second call to a session that is starting waits for it, or is rejected with a retryable error that
says the session is initializing.

**Actual.** A 502 that points at CloudWatch, where nothing was logged because the call never reached the container.

**Workaround.** The relay holds coach calls until its warm-up ping has answered, within the call's own timeout. Three
cold restarts in a row then answered in 7.7–9.5 seconds.

**Suggestion.** Queue calls to a starting session, or return a typed, retryable error for them, and log rejected calls
in the runtime's log group.

---

## FL-016 — The built-in AsyncStorage lost the last save when the app was stopped

- **Date:** 2026-10-13
- **Platform/tool:** Vega OS — `AsyncStorage` exported by `@amazon-devices/react-native-kepler`
- **Severity:** major (the learning loop is the product's core claim)

**Task attempted.** Prove on the Virtual Device that what a session learned survives an app restart: session one
saves the learned bias, the app is stopped, and session two must start from that bias.

**Steps taken.** Logged every save after `setItem` resolved, and the bias each session started with. Session one
logged `saved · bias 0.81`; after `vega device terminate-app` and a relaunch, session two started with bias 1.00.
The profile saved during onboarding, thirteen minutes earlier, had survived; the save from five seconds before the
stop had not.

**Expected.** A write whose promise has resolved is on disk.

**Actual.** Recent writes were lost when the process was stopped.

**Workaround.** Switched to the system-deployed `@amazon-devices/react-native-async-storage__async-storage`
(imported as `@react-native-async-storage/async-storage` 1.23.1), which the Vega docs describe as persistent. With it,
a save made five seconds before a forced stop was loaded by the next process.

**Suggestion.** Deprecate the `AsyncStorage` export in `react-native-kepler` with a pointer to the supported package,
or document that its writes are not durable until some later flush. It still type-checks and works until the app
is stopped, so nothing warns you.

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
