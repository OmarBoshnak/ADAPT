"""AgentCore Runtime entrypoint. Local: `uv run python -m coach.app` serves POST /invocations on :8080."""

import logging
from collections.abc import Callable

import jsonschema
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from strands.models.model import Model

from . import contract
from .model import bedrock_model
from .narrative import NarrativeRejected, narrate
from .planner import PlanRejected, plan

log = logging.getLogger("coach")
app = BedrockAgentCoreApp()


def handle(payload: dict, model: Callable[[], Model] = bedrock_model) -> dict:
    task = payload.get("task")
    try:
        if task == "ping":
            return {"ok": True}
        if task == "plan":
            contract.validate("plan-request", payload)
            reply = plan(contract.PlanRequest.model_validate(payload), model())
            return reply.model_dump()
        if task == "narrative":
            contract.validate("narrative-request", payload)
            reply = narrate(contract.NarrativeRequest.model_validate(payload), model())
            return reply.model_dump()
    except jsonschema.ValidationError as e:
        return {"error": f"invalid request: {e.message}"}
    except (PlanRejected, NarrativeRejected) as e:
        log.warning("rejected %s: %s", task, e)
        return {"error": "rejected"}
    except Exception:
        # The TV falls back on any error; the details belong in the runtime's logs, not the reply.
        log.exception("coach failed on %s", task)
        return {"error": "unavailable"}
    return {"error": f"unknown task: {task}"}


@app.entrypoint
def invoke(payload: dict) -> dict:
    return handle(payload)


if __name__ == "__main__":
    app.run()
