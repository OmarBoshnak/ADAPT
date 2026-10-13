#!/usr/bin/env bash
# Runs the relay against the coach deployed with `npx @aws/agentcore deploy`.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

STATE=services/coach/agentcore/.cli/deployed-state.json
if [ ! -f "$STATE" ]; then
  echo "No deployed coach yet. Deploy it first: cd services/coach && npx @aws/agentcore deploy" >&2
  exit 1
fi

COACH_AGENT_ARN="$(node -p "require('./$STATE').targets.default.resources.runtimes.adapt_coach.runtimeArn")"
REGION="${COACH_AGENT_ARN#arn:aws:bedrock-agentcore:}"
export COACH_AGENT_ARN AWS_REGION="${REGION%%:*}"

npx tsc --build
exec node apps/relay/dist/main.js "$@"
