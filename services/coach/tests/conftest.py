import pytest

from coach.contract import PlanRequest


@pytest.fixture
def plan_request() -> PlanRequest:
    return PlanRequest.model_validate(
        {
            "task": "plan",
            "minutes": 12,
            "energy": "medium",
            "count": 4,
            "targetIntensity": {"min": 4.5, "max": 5.7},
            "candidates": [
                {"id": "adapt_jumping_jacks", "name": "Jumping Jacks", "intensity": 6, "family": "jacks", "signal": "impact"},
                {"id": "adapt_step_jacks", "name": "Step Jacks", "intensity": 3.5, "family": "jacks", "signal": "oscillation"},
                {"id": "adapt_high_knees", "name": "High Knees", "intensity": 6.4, "family": "knees", "signal": "impact"},
                {"id": "adapt_standing_march", "name": "Standing March", "intensity": 2.5, "family": "march", "signal": "oscillation"},
                {"id": "adapt_skater_hops", "name": "Skater Hops", "intensity": 5.9, "family": "lateral", "signal": "impact"},
            ],
        }
    )
