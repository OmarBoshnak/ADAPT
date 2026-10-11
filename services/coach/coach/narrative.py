from strands import Agent
from strands.models.model import Model

from .contract import NarrativeReply, NarrativeRequest, is_safe_copy

SYSTEM = """You write one sentence for the "What changed" card at the end of a workout in ADAPT.
The person asked for an easier movement earlier than the model expected, and the model has adjusted.
Say, warmly and plainly, what the model will do differently next time: start lighter and step in sooner.
Speak as the coach ("I"). Under 25 words. No numbers. No exclamation marks.
Describe the plan and the adjustment, never the person's body, health, effort or ability."""


class NarrativeRejected(Exception):
    pass


def brief(request: NarrativeRequest) -> str:
    adapted = "; ".join(f"{a.from_} to {a.to} ({a.trigger}) at {round(a.atSec)} s" for a in request.adaptations) or "none"
    return (
        f"Session: {request.minutes} minutes. Adaptations: {adapted}.\n"
        f"They asked for easier {round(request.earlySec)} seconds before the model expected to step in.\n"
        f"The model's threshold moved from {request.biasBefore:.2f} to {request.biasAfter:.2f} of its starting value."
    )


def narrate(request: NarrativeRequest, model: Model) -> NarrativeReply:
    agent = Agent(model=model, system_prompt=SYSTEM, structured_output_model=NarrativeReply, callback_handler=None)
    reply = agent(brief(request)).structured_output
    if not isinstance(reply, NarrativeReply) or not is_safe_copy(reply.line.strip()):
        raise NarrativeRejected("unsafe or missing line")
    return NarrativeReply(line=reply.line.strip())
