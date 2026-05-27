import { SamasamaFeedbackCode } from "@samasama/shared";

export const feedbackMessages: Record<
  SamasamaFeedbackCode,
  {
    title: string;
    body: string;
  }
> = {
  [SamasamaFeedbackCode.PITCH_STEADY]: {
    title: "Pitch stayed steady",
    body: "The placeholder scorer saw enough pitch control to count this repetition as a pass."
  },
  [SamasamaFeedbackCode.PITCH_VARIATION_REQUIRED]: {
    title: "Pitch needs more shape",
    body: "Try the same exercise again with clearer ups and downs in your voice."
  },
  [SamasamaFeedbackCode.TIMING_REPEAT_REQUIRED]: {
    title: "Timing needs another pass",
    body: "Keep the rhythm tighter and repeat the same prompt once more."
  },
  [SamasamaFeedbackCode.CLARITY_RETRY_REQUIRED]: {
    title: "Clarity was too low",
    body: "The placeholder flow could not hear a confident pronunciation yet."
  },
  [SamasamaFeedbackCode.ENERGY_INCREASE_REQUIRED]: {
    title: "Add more energy",
    body: "Push a little more vocal energy into the next repetition."
  }
};
