# Submission checklist

Deadline **October 23, 2026**. Everything here needs a person, an account or a camera. The code for all of it is done.

## 1. Final end-to-end test

- [x] Developer disk image mounted on the iPhone (unlock it, keep it plugged in).
- [x] Phone app installed on the iPhone (`npm run phone:ios`).
- [ ] Floor traces recorded ([TRACE-SESSION.md](TRACE-SESSION.md)); `npm run tune` passes; fixtures committed.
- [x] Two-session arc on the Vega Virtual Device, TV only, with a forced stop between sessions: session two loaded the
      learned bias and adapted sooner, unprompted ([log](evidence/two-session-arc-vvd.log), 2026-10-13).
- [ ] The same arc with the iPhone on the floor.
- [ ] Look at the drawings on the Virtual Device at 1080p (the window cannot be captured from the command line,
      so this needs eyes).
- [ ] "I noticed" (amber, warm field) and "I learned" (volt listening bar) are distinct with the sound off.

## 2. AWS coach

- [x] AWS credentials on this Mac (`aws login`). The account can call Claude Sonnet 4.6, Opus 4.6 and Haiku 4.5, not
      newer models (FL-014); ask AWS Support if Opus 5.5 is wanted, then set `COACH_MODEL_ID`.
- [x] `cd services/coach && npx @aws/agentcore deploy`.
- [ ] `npm run relay:coach`; a generated session shows the coach's title, and the summary card shows its sentence.
- [x] `docs/PRODUCT-FEEDBACK.md` AWS sections updated from 🚧 to ✅ with what the real deploy was like.

## 3. Content

- [x] Licensed drawings for 12 movements (Workout Guide, CC BY-SA 4.0), credited on the Home screen; the other 17
      show a lettered tile. Unverified dataset photos removed and backed up outside the repo.
- [ ] Optional: drawings or film for the uncovered movements, starting with Step Jacks (the demo's key switch).

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
