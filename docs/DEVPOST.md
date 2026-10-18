# Devpost submission text

Paste-ready answers for the submission form. Fill the links marked **[link]** on submission day.

## Name and tagline

**ADAPT** — Your workout reacts to you.

## Tracks

- Primary track: **Fire TV**
- Mini challenges: **AWS Builder**, **Open Source**

## Description

Most fitness apps wait to be told a workout is too hard. ADAPT predicts it.

ADAPT is a home workout app for Fire TV, built on Vega OS. Every movement carries an intensity value, and as the
session runs the TV accumulates strain: intensity multiplied by time, rising faster as the session goes on and easing
during rests. It weighs that against a threshold set from the person's profile. A live chart shows the strain so far,
where it is heading, and when it will cross the threshold. When it gets there, the workout switches to an easier
variation of the same movement on its own, and the screen turns warm to say so: "I noticed".

The person can still ask for easier, with the remote's Down button or by saying "easier" to a phone on the floor.
That is treated as a correction, not just a command. The model records that this person's strain curve is steeper than
it assumed and lowers their threshold, "I learned", and the next session steps in sooner without being asked.

On the Vega Virtual Device, with the TV alone:

- In session one, the model switched Jumping Jacks to Step Jacks at 7:40.
- A remote press asked for easier at 8:44, 69 seconds before the model expected, and the learned bias moved from
  1.00 to 0.81.
- After the app was force-stopped and relaunched, session two loaded 0.81, made the same switch at 6:49, and made
  the switch the person had asked for at 9:01 by itself, with no input.

What else it does:

- **The profile only ever excludes.** Six injuries and five conditions each remove movements, or keep
  high-intensity bursts short, and Setup says what was removed in plain words ("jumping movements excluded"). Nothing
  about the person's body is ever shown back to them.
- **The phone is optional.** Face up on the floor, it feels steps and landings through the floor with the
  accelerometer and gyroscope, so the TV can adapt when movement fades. It listens for four words with on-device
  recognition only, and dims itself while on the floor. Without it, the TV and remote are a complete product.
- **A coach on AWS.** A Strands agent on Amazon Bedrock AgentCore asks Claude Sonnet 4.6 on Bedrock to order the
  session's movements and to write the sentence on the post-session "What changed" card. It only ever sees
  movements the TV has already judged safe, never the person. Its answer is checked by the agent's own tool, by the
  service, and by the TV's strain model. If it fails a check or takes more than four seconds after Generate, the
  TV uses its local generator instead.

How it is built: the engine is pure TypeScript with no platform imports, so the TV, the phone, the relay and a
headless simulator all run the same code. 305 tests cover the engine, relay and tools, with 28 more for the TV app,
21 for the phone and 24 for the coach. The simulator asserts the two-session learning arc on every run.

## Built with

Vega OS · React Native for Vega · react-native-svg · TypeScript · zod · Fastify · WebSocket · Expo (iOS) · Amazon
Bedrock · Claude Sonnet 4.6 · Amazon Bedrock AgentCore · Strands Agents SDK · Python · Free Exercise DB · Workout
Guide illustrations (CC BY-SA 4.0)

## Repository

https://github.com/OmarBoshnak/ADAPT (public, Apache-2.0). Setup and run instructions are in the README.

## Testing instructions

The TV app needs only the Vega SDK and the Vega Virtual Device. No accounts or credentials are needed.

```
npm install
npm install --prefix apps/tv
vega virtual-device start
npm run tv:build
vega run-app apps/tv/build/x86_64-release/adapttv_x86_64.vpkg com.adapt.tv.main
```

1. Complete onboarding with the remote, then choose **Continue without phone**.
2. On Setup, pick the time and energy level and press **Generate workout**.
3. During a session: **Down** asks for easier, **Up** for harder, **Play/Pause** or **Menu** opens the pause menu,
   **Fast-forward** skips.
4. In a 12-minute medium session the first unprompted switch usually comes six to eight minutes in. Press Down a
   little before it to teach the model. Then run a second session to see it step in sooner.

To see the whole engine without a device, `npm run sim` runs both sessions headlessly in about a second.

## Video

**[link]**

## Open Source mini challenge

**Project repository URL:** **[link]** (`free-exercise-db-graph`)

**Contribution URL:** **[link]** (the pull request to `yuhonas/free-exercise-db`, or the fork if it is unmerged)

**Description.** Two contributions built around Free Exercise DB, the public-domain dataset of 876 exercises.

*free-exercise-db-graph* is a new MIT-licensed npm package, extracted from ADAPT's engine. It turns the dataset into
an adaptation graph. Each exercise gets an intensity score from 0 to 10, derived from the dataset's own fields, and
mechanical tags such as `plyometric` or `overhead` for filtering. It also gets two edges: `adaptsDownTo`, a strictly
easier version of the same movement, and `substituteWith`, a different movement for the same muscles. "Too hard" and
"doesn't suit me" are different problems, so they get different answers. It ships a CLI and tests, including one over
the full dataset (157 step-down edges, 723 substitutes). Anyone building a workout app on this dataset can use it to
offer an easier option or a swap without hand-authoring progressions.

The pull request adds a JSON Schema for the dataset's records. It pins down the allowed values of every enum field,
the 17 muscle names, the image path shape, and the `id` rule. Validated against all 876 records, it found two empty
instruction strings. It also documents where `force`, `mechanic` and `equipment` are null. Downstream projects can then
validate the dataset in CI when they update their copy.

## Product feedback and friction log

- Product feedback, per tool, with the AWS services and how they are used: [PRODUCT-FEEDBACK.md](PRODUCT-FEEDBACK.md)
- Friction log entries: [FRICTION-LOG.md](FRICTION-LOG.md)
