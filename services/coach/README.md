# ADAPT coach

A [Strands](https://strandsagents.com) agent on **Amazon Bedrock AgentCore Runtime**, calling **Claude on Amazon Bedrock**.
It does two small jobs:

- **plan**: choose and order the movements for a session.
- **narrative**: write the one sentence on the "What changed" card after someone corrected the model.

## The safety boundary

The coach never sees the person. The TV filters the movement pool by the profile's exclusions on the device, and
sends only what is left, plus a strain budget. Age, body measurements, injuries and conditions never leave the TV.

Every answer is checked three times before it reaches a screen:

1. **By the agent itself.** It calls its one tool, `validate_plan`, and fixes what it reports.
2. **Here.** `coach/planner.py` rejects any choice outside the candidates, of the wrong length, repeated back to back,
   or outside the intensity window. Narrative lines must pass the same copy rules the TV applies.
3. **On the TV.** `acceptCoachPlan` in `packages/core` re-runs the choice through the real strain model, and
   `acceptNarrative` re-checks the copy rules.

The TV asks for a plan while the viewer is still choosing on the setup screen, so the agent's two model calls are
usually done by the time Generate is pressed. If any check fails, or the answer is not back four seconds after Generate,
the TV uses its local generator and the built-in sentence. Nothing on screen depends on the cloud.

The request and reply shapes are generated from the zod schemas in `packages/core` (`npm run contract`) into
`contract/`. Python validates against those files, and tests on both sides fail if they drift.

## Run it locally

```bash
uv sync --group dev
```

```bash
uv run --group dev pytest -q
```

```bash
uv run python main.py
```

That serves the AgentCore protocol on `http://127.0.0.1:8080` (`POST /invocations`, `GET /ping`). Point the relay
at it with `COACH_URL=http://127.0.0.1:8080 npm run relay`. Model calls need AWS credentials with Bedrock access.

## Deploy

Needs AWS credentials (`aws configure`), Claude enabled in Bedrock, and the AgentCore CLI.

```bash
npx @aws/agentcore deploy
```

The first deploy asks for an account and region and records them in `agentcore/aws-targets.json`. Claude is called
through the Anthropic SDK's Bedrock client (`InvokeModel`), which the runtime's default role already allows. Then, from
the repository root, run the relay against the deployed runtime (it reads the ARN from `agentcore/.cli/deployed-state.json`):

```bash
npm run relay:coach
```

The relay pings the runtime when it starts and every ten minutes after, to keep a session warm. A call that reaches a
session still starting fails with a 502, so the relay holds calls until that first ping has answered. A cold start
takes six to nine seconds; after that a plan takes five to seven, and a summary sentence under two.

| Setting | Default | |
| --- | --- | --- |
| `COACH_MODEL_ID` | `us.anthropic.claude-sonnet-4-6` | Claude Sonnet 4.6 through the US cross-region inference profile |
| `COACH_EFFORT` | `low` | Short, structured jobs under a four-second deadline |
| `AWS_REGION` | `us-east-1` | |

Sonnet 4.6 returns a plan in about six seconds, against eleven for Opus 4.6, and the job is choosing among options
that are already valid. Any Claude model the account can use works by setting `COACH_MODEL_ID`.
