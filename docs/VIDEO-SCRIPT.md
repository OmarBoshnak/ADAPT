# Demo video — under three minutes

Judges may stop at 3:00, so the strongest material comes first. Two sessions, same person, no input in the second.
The argument is that session two adapts sooner on its own.

## Before filming

- **TV:** Vega Virtual Device, recorded with macOS screen capture (`Cmd-Shift-5`, record the VVD window). Hide the
  Dock, quit notification sources.
- **Plan:** set `demoSeed: 5` in `apps/tv/src/config.ts` and rebuild. Seed 5's 12-minute medium plan puts
  Jumping Jacks where the model first reaches its threshold. With a pinned seed the TV uses the local plan so every
  take is identical; the coach still writes the summary sentence. Reset to `null` after filming.
- **Fresh state:** reinstall the TV app so the profile and learned bias start clean. Onboard with **no injuries** for
  the main arc.
- **Phone:** face up on a hard floor, half a metre beside you, the relay running (`npm run relay`, with
  `COACH_AGENT_ARN` set so the coach is live).
- **Second camera** on you and the phone, for the cutaways.
- **Backup:** `npm run fake-sensor -- --code <code> --replay` plays your recorded traces into the session, so a
  ruined take of session two can be reshot with identical floor data.

## Shot list

| Time | Beat | On screen | Notes |
| --- | --- | --- | --- |
| 0:00–0:20 | **Cold open** | Session 1, Jumping Jacks. The strain curve climbs to the dashed threshold, the screen warms, "Switching to Step Jacks". | No narration needed. This is the hook. |
| 0:20–0:40 | **What it knows** | Setup screen: "Nothing excluded". Then a 5-second cut of a second profile with Knee selected: "jumping movements excluded". | The profile only ever excludes. Say it once. |
| 0:40–1:20 | **I noticed** | Session 1 live. Cut between you doing jumping jacks and the TV. The amber decision panel explains the switch in one plain sentence. | Nobody pressed anything. Let that land. |
| 1:20–1:50 | **I learned** | You say "easier" to the phone on the floor, earlier than the model expected. The listening bar: "easier", "Noted for next time". Summary: "What changed", in the coach's own sentence. | The phone's echo shows the word was heard. |
| 1:50–2:30 | **Session two** | Setup: "Tuned from your last session: starts lighter, adapts sooner". Same movement adapts sooner, unprompted. | The closing argument. Hold on the countdown ring stopping early. |
| 2:30–2:55 | **How** | Architecture card: Fire TV (Vega) + phone + relay + coach on Bedrock AgentCore (Strands, Claude). "The model chooses only from movements already judged safe, and nothing it says reaches the screen unchecked." Free Exercise DB, free-exercise-db-graph. | One card, read aloud. |

## Lines worth saying

- "Most fitness apps wait to be told it's too hard. This one predicts it."
- "When you correct it, that isn't a command. It's a measurement."
- "Same person. Same workout. Nobody said anything. It stepped in sooner."

## Don't

- Don't call the phone a camera, or imply anything watches you. It feels the floor.
- Don't show a number about the person's body anywhere.
- Don't show a terminal mid-demo. Anything that needs one is a bug to fix before filming.
