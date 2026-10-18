# Submission checklist

Deadline **October 23, 2026**. Everything here needs a person, an account or a camera. The code for all of it is done.

## 0. Release build

- [x] The TV package is ADAPT 1.0.0, build 1, with a 512 px icon (`apps/tv/assets/image/app_icon.png`); arm, arm64
      and x86_64 packages build, and the x86_64 one installs and launches on the Virtual Device (2026-10-15).
- [x] A fresh clone passes `npm run verify` after `npm ci` at the root, in `apps/tv` and in `apps/phone` (2026-10-15).
- [ ] A later upload must raise both the version in `apps/tv/manifest.toml` and `--build-number` in
      `apps/tv/package.json`.

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

- [x] Every movement drawn: 21 from Workout Guide (CC BY-SA 4.0, credited on the Home screen), 8 from figures drawn
      for ADAPT. Unverified dataset photos removed and backed up outside the repo.

## 4. Open source

- [ ] Publish `free-exercise-db-graph` as its own public repository:

      git subtree split --prefix=oss/free-exercise-db-graph -b free-exercise-db-graph

  then push that branch to a new GitHub repository, and `npm publish` from `oss/free-exercise-db-graph` after
  `npm run oss:build`.
- [ ] Open the pull request to `yuhonas/free-exercise-db` from
      [oss/free-exercise-db-schema](../oss/free-exercise-db-schema/PULL_REQUEST.md).

## 5. Video

- [ ] Filmed per [VIDEO-SCRIPT.md](VIDEO-SCRIPT.md), under three minutes, showing the app running on the Vega Virtual
      Device. `demoSeed` reset to `null` afterwards.
- [ ] No copyrighted music and no third-party logos or trademarks you lack permission for.
- [ ] Uploaded to YouTube or Vimeo and publicly visible (unlisted is not enough to be safe).

## 6. On submission day — not before

GitHub invitations expire after seven days. The rules allow either a public repository with an open-source licence
shown in its About section, or a private one shared as below. Private is the plan: the repository includes the AWS
account number in `services/coach/agentcore/.cli/deployed-state.json`.

- [ ] Main repository private.
- [ ] Invite as collaborators: `testing@devpost.com` (by email), `chris-trag`, `knmeiss`, `giolaq`, `anishamalde`,
      `mosesroth`, `emersonsklar`.
- [ ] Devpost form, with the text in [DEVPOST.md](DEVPOST.md): primary track Fire TV; mini challenges AWS Builder and
      Open Source; repository link; video link; product feedback; friction log entries.
- [ ] Open Source fields: contribution URL (the PR, or the fork if it is unmerged), project repository URL
      (`free-exercise-db-graph`), your GitHub username, and the description.
