from coach import app, narrative
from coach.contract import NarrativeReply

NARRATIVE = {
    "task": "narrative",
    "minutes": 12,
    "adaptations": [{"atSec": 400, "from": "Jumping Jacks", "to": "Step Jacks", "trigger": "user-correction"}],
    "corrections": [{"atSec": 400, "direction": "easier"}],
    "earlySec": 60,
    "biasBefore": 1,
    "biasAfter": 0.88,
}


class FakeAgent:
    line = ""

    def __init__(self, **_):
        pass

    def __call__(self, _prompt):
        return type("Result", (), {"structured_output": NarrativeReply(line=self.line)})()


def test_ping_needs_no_model():
    assert app.handle({"task": "ping"}, model=lambda: None) == {"ok": True}


def test_rejects_requests_that_break_the_contract():
    assert app.handle({"task": "plan", "minutes": 12}, model=lambda: None)["error"].startswith("invalid request")
    assert app.handle({"task": "launch"}, model=lambda: None) == {"error": "unknown task: launch"}


def test_returns_a_safe_line(monkeypatch):
    FakeAgent.line = "Next time I'll start you lighter and step in sooner."
    monkeypatch.setattr(narrative, "Agent", FakeAgent)
    assert app.handle(NARRATIVE, model=lambda: None) == {"line": FakeAgent.line}


def test_withholds_a_line_that_breaks_the_copy_rules(monkeypatch):
    FakeAgent.line = "Your knee injury slowed you down."
    monkeypatch.setattr(narrative, "Agent", FakeAgent)
    assert app.handle(NARRATIVE, model=lambda: None) == {"error": "rejected"}


def test_any_other_failure_is_logged_and_reported_plainly(monkeypatch):
    def broken(*_args, **_kwargs):
        raise RuntimeError("no credentials")

    monkeypatch.setattr(narrative, "Agent", broken)
    assert app.handle(NARRATIVE, model=lambda: None) == {"error": "unavailable"}
