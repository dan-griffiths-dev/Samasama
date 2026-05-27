import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, UploadFile
from pydantic import ValidationError

from app.models import HealthResponse, VoiceAnalysisRequest, VoiceAnalysisResponse
from app.service import analyze_voice_file


app = FastAPI(
    title="Samasama Voice Analysis",
    version="0.1.0",
    description="Temporary heuristic voice-analysis contract for Samasama.",
)


@app.get("/health", response_model=HealthResponse, tags=["system"])
async def health() -> HealthResponse:
    return HealthResponse(status="ok", service="voice-analysis")


@app.post("/analyze/voice", response_model=VoiceAnalysisResponse, tags=["analysis"])
async def analyze_voice(
    exercise_reference_id: str = Form(...),
    audio_file: UploadFile = File(...),
) -> VoiceAnalysisResponse:
    try:
        request_model = VoiceAnalysisRequest(
            exercise_reference_id=exercise_reference_id,
        )
    except ValidationError as exc:
        raise exc

    suffix = Path(audio_file.filename or "upload.bin").suffix or ".bin"
    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_path = Path(temp_file.name)

            while chunk := await audio_file.read(1024 * 1024):
                temp_file.write(chunk)

        return analyze_voice_file(
            exercise_reference_id=request_model.exercise_reference_id,
            temp_audio_path=temp_path,
            original_filename=audio_file.filename,
        )
    finally:
        await audio_file.close()

        if temp_path is not None and temp_path.exists():
            temp_path.unlink()


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("VOICE_ANALYSIS_PORT", "8001"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
