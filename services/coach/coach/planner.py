import json

from strands import Agent, tool
from strands.models.model import Model

from .contract import PlanReply, PlanRequest

SYSTEM = """You are the coach in ADAPT, a living-room cardio app on Fire TV.
You choose and order movements for one session. You only ever choose from the candidates you are given:
they have already been filtered for this person, and you are never told why.

Rules:
- Choose exactly the requested number of movements, by candidate id.
- Never put the same movement twice in a row, and avoid two of the same family in a row.
- Open with one of the gentler candidates.
- Keep the mean intensity of your choice inside the target window.

Call validate_plan with your ordered ids before answering, and fix anything it reports.
The title is short and plain, like "12-Minute Cardio Reset". The rationale is one sentence about the movements.
Never comment on the person's body, health or ability."""


def problems(request: PlanRequest, ids: list[str]) -> list[str]:
    offered = {c.id: c for c in request.candidates}
    found: list[str] = []
    if len(ids) != request.count:
        found.append(f"choose exactly {request.count} movements, not {len(ids)}")
    unknown = [i for i in ids if i not in offered]
    if unknown:
        found.append(f"not among the candidates: {', '.join(unknown)}")
    found += [f"{b} twice in a row" for a, b in zip(ids, ids[1:]) if a == b]
    chosen = [offered[i] for i in ids if i in offered]
    if chosen:
        mean = sum(c.intensity for c in chosen) / len(chosen)
        window = request.targetIntensity
        if not window.min <= mean <= window.max:
            found.append(f"mean intensity {mean:.1f} is outside {window.min}–{window.max}")
    return found


def advice(request: PlanRequest, ids: list[str]) -> list[str]:
    family = {c.id: c.family for c in request.candidates}
    return [f"{a} and {b} are the same family" for a, b in zip(ids, ids[1:]) if a != b and family.get(a) == family.get(b)]


def plan_agent(request: PlanRequest, model: Model) -> Agent:
    @tool
    def validate_plan(exercise_ids: list[str]) -> dict:
        """Check an ordered choice of candidate ids against the session's rules.

        Args:
            exercise_ids: Candidate ids in the order they should be performed.
        """
        found = problems(request, exercise_ids)
        return {"ok": not found, "problems": found, "advice": advice(request, exercise_ids)}

    return Agent(
        model=model,
        system_prompt=SYSTEM,
        tools=[validate_plan],
        structured_output_model=PlanReply,
        callback_handler=None,
    )


def brief(request: PlanRequest) -> str:
    candidates = [c.model_dump() for c in request.candidates]
    return (
        f"Plan a {request.minutes}-minute {request.energy}-energy session of {request.count} movements.\n"
        f"Target mean intensity: {request.targetIntensity.min} to {request.targetIntensity.max} (0–10 scale).\n"
        f"Candidates:\n{json.dumps(candidates, indent=1)}"
    )


class PlanRejected(Exception):
    pass


def plan(request: PlanRequest, model: Model) -> PlanReply:
    reply = plan_agent(request, model)(brief(request)).structured_output
    if not isinstance(reply, PlanReply):
        raise PlanRejected("no structured reply")
    found = problems(request, reply.exerciseIds)
    if found:
        raise PlanRejected("; ".join(found))
    return reply
