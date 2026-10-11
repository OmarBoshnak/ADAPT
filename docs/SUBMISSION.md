# Submission checklist

Deadline **October 23, 2026**. Everything here needs a person, an account or a camera. The code for all of it is done.

## 1. Final end-to-end test

- [ ] Developer disk image mounted on the iPhone (unlock it, keep it plugged in).
- [ ] Phone app installed on the iPhone (`npm run phone:ios`).
- [ ] Floor traces recorded ([TRACE-SESSION.md](TRACE-SESSION.md)); `npm run tune` passes; fixtures committed.
- [ ] Two-session arc on the Vega Virtual Device with the iPhone on the floor: session two adapts sooner, unprompted.
- [ ] "I noticed" (amber, warm field) and "I learned" (volt listening bar) are distinct with the sound off.

## 2. AWS coach

- [ ] AWS credentials on this Mac (`aws configure`), Claude enabled in Bedrock.
- [ ] `cd services/coach && npx @aws/agentcore deploy`.
- [ ] Relay started with `COACH_AGENT_ARN=<arn> AWS_REGION=<region> npm run relay`; a generated session shows the
      coach's title, and the summary card shows its sentence.
- [ ] `docs/PRODUCT-FEEDBACK.md` AWS sections updated from 🚧 to ✅ with what the real deploy was like.

## 3. Content

- [ ] 22 home-pack photos shot ([PHOTO-SHOT-LIST.md](PHOTO-SHOT-LIST.md)).

## 4. Open source

- [ ] Publish `free-exercise-db-graph` as its own public repository:

      git subtree split --prefix=oss/free-exercise-db-graph -b free-exercise-db-graph

  then push that branch to a new GitHub repository, and `npm publish` from `oss/free-exercise-db-graph` after
  `npm run oss:build`.
- [ ] Open the pull request to `yuhonas/free-exercise-db` from
      [oss/free-exercise-db-schema](../oss/free-exercise-db-schema/PULL_REQUEST.md).

## 5. Video

- [ ] Filmed per [VIDEO-SCRIPT.md](VIDEO-SCRIPT.md), under three minutes, `demoSeed` reset to `null` afterwards.

## 6. On submission day — not before

GitHub invitations expire after seven days.

- [ ] Main repository private.
- [ ] Invite as collaborators: `chris-trag`, `knmeiss`, `giolaq`, `anishamalde`, `mosesroth`, `emersonsklar`.
- [ ] Submit: repository link, video, open-source repository link, and the friction log and product feedback
      (`docs/FRICTION-LOG.md`, `docs/PRODUCT-FEEDBACK.md`).
