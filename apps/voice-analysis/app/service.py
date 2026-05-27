from pathlib import Path

from app.constants import DEFAULT_FEEDBACK_CODE
from app.models import VoiceAnalysisResponse


def analyze_voice_file(
    *,
    exercise_reference_id: str,
    temp_audio_path: Path,
    original_filename: str | None,
) -> VoiceAnalysisResponse:
    file_size = temp_audio_path.stat().st_size
    file_suffix = temp_audio_path.suffix.lower()
    exercise_hint = exercise_reference_id.upper()

    if "SYLLABLE" in exercise_hint:
        pitch_score = 0.79
        phoneme_score = 0.77
    else:
        pitch_score = 0.82
        phoneme_score = 0.8

    if file_size == 0:
        pitch_score = 0.35
        phoneme_score = 0.31

    confidence = min(0.99, 0.55 + (file_size / 100000))

    return VoiceAnalysisResponse(
        feedback_code=DEFAULT_FEEDBACK_CODE,
        pitch_score=round(pitch_score, 2),
        phoneme_score=round(phoneme_score, 2),
        confidence=round(confidence, 2),
        notes=(
            f"Placeholder analysis for {exercise_reference_id} "
            f"using {original_filename or 'uploaded-audio'} ({file_suffix or 'unknown'})."
        ),
    )
