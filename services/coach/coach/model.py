import os

from anthropic import AsyncAnthropicBedrockMantle
from strands.models.anthropic import AnthropicModel

DEFAULT_MODEL_ID = "anthropic.claude-opus-5-5"


class BedrockClaude(AnthropicModel):
    """Strands' Anthropic provider, talking to Claude on Amazon Bedrock through the official SDK."""

    def __init__(self, *, region: str, **config):
        super().__init__(**config)
        self.client = AsyncAnthropicBedrockMantle(aws_region=region)

    @staticmethod
    def _format_tool_choice(tool_choice) -> dict:
        # Current Claude models reject forced tool choice; the prompt already asks for the tool.
        return {"tool_choice": {"type": "auto"}} if tool_choice else {}


def bedrock_model() -> BedrockClaude:
    return BedrockClaude(
        region=os.environ.get("AWS_REGION", "us-east-1"),
        model_id=os.environ.get("COACH_MODEL_ID", DEFAULT_MODEL_ID),
        max_tokens=4096,
        params={"output_config": {"effort": os.environ.get("COACH_EFFORT", "low")}},
    )
