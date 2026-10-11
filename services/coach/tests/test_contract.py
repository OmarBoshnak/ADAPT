import pytest

from coach import contract


@pytest.mark.parametrize(
    "model, name",
    [
        (contract.PlanRequest, "plan-request"),
        (contract.PlanReply, "plan-reply"),
        (contract.NarrativeRequest, "narrative-request"),
        (contract.NarrativeReply, "narrative-reply"),
    ],
)
def test_models_match_the_generated_contract(model, name):
    generated = contract.schema(name)
    ours = model.model_json_schema(by_alias=True)
    assert set(ours["properties"]) == set(generated["properties"])
    assert set(ours.get("required", [])) == set(generated["required"])


def test_contract_and_models_agree_on_a_real_request(plan_request):
    payload = plan_request.model_dump(by_alias=True)
    contract.validate("plan-request", payload)


@pytest.mark.parametrize(
    "line, safe",
    [
        ("Next time I'll start you lighter and step in sooner.", True),
        ("Great for weight loss.", False),
        ("Careful with that knee injury.", False),
        ("Warning: you slowed down.", False),
        ("I watched you closely.", False),
        ("", False),
    ],
)
def test_copy_rules_are_the_ones_the_tv_applies(line, safe):
    assert contract.is_safe_copy(line) is safe
