from typing import Literal

from pydantic import BaseModel, Field

from app.constants import FEEDBACK_CODES


FeedbackCode = Literal[
    "PITCH_STEADY",
    "PITCH_VARIATION_REQUIRED",
    "TIMING_REPEAT_REQUIRED",
    "CLARITY_RETRY_REQUIRED",
    "ENERGY_INCREASE_REQUIRED",
]


class HealthResponse(BaseModel):
    status: str = Field(examples=["ok"])
    service: str = Field(examples=["voice-analysis"])


class VoiceAnalysisRequest(BaseModel):
    exercise_reference_id: str = Field(
        min_length=1,
        examples=["INFANT_VOWEL_A_E1"],
        description="Stable exercise reference from the curriculum service.",
    )


class VoiceAnalysisResponse(BaseModel):
    feedback_code: FeedbackCode = Field(
        examples=[FEEDBACK_CODES[0]],
        description="Placeholder feedback code from the shared Samasama list.",
    )
    pitch_score: float = Field(ge=0.0, le=1.0)
    phoneme_score: float = Field(ge=0.0, le=1.0)
    confidence: float = Field(ge=0.0, le=1.0)
    notes: str
