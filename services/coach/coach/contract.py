"""Request and reply shapes, mirroring the JSON Schemas generated from @adapt/core (npm run contract)."""

import json
import re
from functools import cache
from pathlib import Path
from typing import Literal

import jsonschema
from pydantic import BaseModel, ConfigDict, Field

CONTRACT_DIR = Path(__file__).resolve().parent.parent / "contract"

Id = Field(pattern=r"^[A-Za-z0-9_-]{1,80}$")


class Candidate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Id
    name: str = Field(max_length=80)
    intensity: float = Field(ge=0, le=10)
    family: str = Field(max_length=40)
    signal: Literal["impact", "oscillation", "sustained", "static"]


class IntensityWindow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    min: float
    max: float


class PlanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    task: Literal["plan"]
    minutes: int = Field(gt=0)
    energy: Literal["low", "medium", "high"]
    count: int = Field(gt=0)
    targetIntensity: IntensityWindow
    candidates: list[Candidate] = Field(min_length=1)


class PlanReply(BaseModel):
    """The session, as an ordered choice of the offered movements."""

    model_config = ConfigDict(extra="forbid")
    exerciseIds: list[str] = Field(min_length=1, max_length=12, description="Candidate ids, in session order.")
    title: str = Field(max_length=60, description="Short plain title, e.g. '12-Minute Cardio Reset'.")
    rationale: str = Field(max_length=400, description="One sentence on why these movements, in this order.")


class NarrativeAdaptation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    atSec: float = Field(ge=0)
    to: str = Field(max_length=80)
    trigger: Literal["predicted-strain", "user-correction"]
    from_: str = Field(alias="from", max_length=80)


class NarrativeCorrection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    atSec: float = Field(ge=0)
    direction: Literal["easier", "harder"]


class NarrativeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    task: Literal["narrative"]
    minutes: int = Field(gt=0)
    adaptations: list[NarrativeAdaptation]
    corrections: list[NarrativeCorrection]
    earlySec: float = Field(ge=0)
    biasBefore: float
    biasAfter: float


class NarrativeReply(BaseModel):
    """One sentence for the 'What changed' card after a session."""

    model_config = ConfigDict(extra="forbid")
    line: str = Field(min_length=1, max_length=200)


@cache
def schema(name: str) -> dict:
    return json.loads((CONTRACT_DIR / f"{name}.schema.json").read_text())


def validate(name: str, payload: dict) -> None:
    jsonschema.validate(payload, schema(name))


@cache
def _copy_rules() -> tuple[re.Pattern[str], ...]:
    sources = json.loads((CONTRACT_DIR / "copy-rules.json").read_text())
    return tuple(re.compile(source, re.IGNORECASE) for source in sources)


def is_safe_copy(text: str) -> bool:
    """Same rules the TV applies before showing generated text."""
    return 0 < len(text) <= 200 and not any(rule.search(text) for rule in _copy_rules())
