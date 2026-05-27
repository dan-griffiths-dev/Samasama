import {
  SamasamaFeedbackCode,
  type SamasamaVoiceAnalysisMetricsDto
} from "@samasama/shared";

export interface SamasamaAttemptScoringService {
  scoreAttempt(input: {
    exerciseCode: string;
    transcript: string | null;
    mediaPath: string | null;
  }): Promise<{
    feedbackCode: SamasamaFeedbackCode;
    analysisVersion: string;
    summary: string;
    metrics: SamasamaVoiceAnalysisMetricsDto;
  }>;
}

export class SamasamaPlaceholderAttemptScoringService
  implements SamasamaAttemptScoringService
{
  async scoreAttempt(input: {
    exerciseCode: string;
    transcript: string | null;
    mediaPath: string | null;
  }) {
    const transcriptLength = input.transcript?.trim().length ?? 0;
    const metrics = {
      pitchScore: transcriptLength > 0 ? 0.81 : 0.59,
      phonemeScore: transcriptLength > 0 ? 0.78 : 0.58,
      timingScore: transcriptLength > 0 ? 0.76 : 0.64
    };

    return {
      feedbackCode:
        transcriptLength > 0
          ? SamasamaFeedbackCode.PITCH_STEADY
          : SamasamaFeedbackCode.CLARITY_RETRY_REQUIRED,
      analysisVersion: "placeholder-v1",
      summary: `Placeholder scoring completed for ${input.exerciseCode}.`,
      metrics
    };
  }
}
