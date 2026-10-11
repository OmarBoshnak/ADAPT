import re

import pytest

from coach import planner
from coach.model import bedrock_model
from coach.contract import PlanReply


def test_accepts_a_valid_choice(plan_request):
    ids = ["adapt_step_jacks", "adapt_jumping_jacks", "adapt_standing_march", "adapt_high_knees"]
    assert planner.problems(plan_request, ids) == []


def test_reports_what_is_wrong(plan_request):
    found = planner.problems(plan_request, ["adapt_burpees", "adapt_high_knees", "adapt_high_knees"])
    assert "choose exactly 4 movements, not 3" in found
    assert "not among the candidates: adapt_burpees" in found
    assert "adapt_high_knees twice in a row" in found


def test_flags_load_outside_the_window(plan_request):
    found = planner.problems(plan_request, ["adapt_jumping_jacks", "adapt_high_knees", "adapt_skater_hops", "adapt_high_knees"])
    assert any("outside" in f for f in found)


def test_family_repeats_are_advice_not_rejection(plan_request):
    ids = ["adapt_step_jacks", "adapt_jumping_jacks", "adapt_standing_march", "adapt_high_knees"]
    assert planner.advice(plan_request, ids) == ["adapt_step_jacks and adapt_jumping_jacks are the same family"]


def test_the_agent_has_exactly_one_tool(plan_request):
    agent = planner.plan_agent(plan_request, model=bedrock_model())
    assert agent.tool_names == ["validate_plan"]


def test_the_brief_never_mentions_why_movements_were_filtered(plan_request):
    text = planner.brief(plan_request).lower()
    assert not re.search(r"\b(injur\w*|conditions?|ages?|weight|height|pregnan\w*|asthma)\b", text)


class FakeAgent:
    def __init__(self, reply):
        self.reply = reply

    def __call__(self, _prompt):
        return type("Result", (), {"structured_output": self.reply})()


def test_rejects_a_reply_that_breaks_the_rules_even_if_the_model_insists(plan_request, monkeypatch):
    bad = PlanReply(exerciseIds=["adapt_burpees"] * 4, title="t", rationale="r")
    monkeypatch.setattr(planner, "plan_agent", lambda *_: FakeAgent(bad))
    with pytest.raises(planner.PlanRejected):
        planner.plan(plan_request, model=None)


def test_returns_a_reply_that_follows_the_rules(plan_request, monkeypatch):
    good = PlanReply(
        exerciseIds=["adapt_step_jacks", "adapt_jumping_jacks", "adapt_standing_march", "adapt_high_knees"],
        title="12-Minute Cardio Reset",
        rationale="Starts gentle, builds through jacks and knees.",
    )
    monkeypatch.setattr(planner, "plan_agent", lambda *_: FakeAgent(good))
    assert planner.plan(plan_request, model=None) == good
