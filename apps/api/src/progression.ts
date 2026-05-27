import type { Prisma, PrismaClient } from "@prisma/client";

type ProgressionTx = Prisma.TransactionClient;

type EvaluateAttemptProgressionOptions = {
  tx: ProgressionTx;
  attemptId: string;
  now?: Date;
  hooks?: {
    afterStateMutations?: () => Promise<void> | void;
  };
};

type AttemptWithAnalysis = {
  id: string;
  userId: string;
  lessonId: string;
  exerciseId: string;
  progressionPassed: boolean | null;
  progressionEvaluatedAt: Date | null;
  submittedAt: Date;
  voiceAnalysisResult: {
    metricsJson: unknown;
  } | null;
};

const PASS_THRESHOLDS = {
  pitchScore: 0.7,
  phonemeScore: 0.7
} as const;

const LESSON_COMPLETION_GROWTH_POINTS = 10;
const TODDLER_STAGE_THRESHOLD = 20;

export async function evaluateAttemptProgression({
  tx,
  attemptId,
  now = new Date(),
  hooks
}: EvaluateAttemptProgressionOptions) {
  const attempt = await tx.attempt.findUnique({
    where: { id: attemptId },
    include: {
      voiceAnalysisResult: true
    }
  });

  if (!attempt) {
    throw new Error(`Attempt ${attemptId} not found`);
  }

  if (!attempt.voiceAnalysisResult) {
    throw new Error(`Attempt ${attemptId} is missing a voice analysis result`);
  }

  if (attempt.progressionEvaluatedAt) {
    return {
      wasAlreadyProcessed: true,
      passed: attempt.progressionPassed ?? false
    };
  }

  const metrics = readAnalysisMetrics(attempt);
  const passed =
    metrics.pitchScore >= PASS_THRESHOLDS.pitchScore &&
    metrics.phonemeScore >= PASS_THRESHOLDS.phonemeScore;

  await tx.attempt.update({
    where: { id: attempt.id },
    data: {
      progressionPassed: passed,
      progressionEvaluatedAt: now
    }
  });

  const lesson = await tx.lesson.findUniqueOrThrow({
    where: { id: attempt.lessonId },
    include: {
      exercises: {
        select: {
          id: true
        }
      }
    }
  });

  const existingLessonProgress = await tx.userLessonProgress.findUnique({
    where: {
      userId_lessonId: {
        userId: attempt.userId,
        lessonId: attempt.lessonId
      }
    }
  });

  const lessonProgress = existingLessonProgress
    ? await tx.userLessonProgress.update({
        where: {
          id: existingLessonProgress.id
        },
        data: {
          status:
            existingLessonProgress.status === "COMPLETED"
              ? "COMPLETED"
              : passed
                ? "IN_PROGRESS"
                : existingLessonProgress.status === "LOCKED"
                  ? "AVAILABLE"
                  : existingLessonProgress.status,
          unlockedAt: existingLessonProgress.unlockedAt ?? now,
          startedAt:
            passed && existingLessonProgress.status !== "COMPLETED"
              ? existingLessonProgress.startedAt ?? now
              : existingLessonProgress.startedAt,
          lastAttemptAt: attempt.submittedAt
        }
      })
    : await tx.userLessonProgress.create({
        data: {
          userId: attempt.userId,
          lessonId: attempt.lessonId,
          status: passed ? "IN_PROGRESS" : "AVAILABLE",
          unlockedAt: now,
          startedAt: passed ? now : null,
          lastAttemptAt: attempt.submittedAt
        }
      });

  if (!passed) {
    if (hooks?.afterStateMutations) {
      await hooks.afterStateMutations();
    }

    return {
      wasAlreadyProcessed: false,
      passed: false,
      lessonCompleted: lessonProgress.status === "COMPLETED"
    };
  }

  const passedExerciseRows = await tx.attempt.findMany({
    where: {
      userId: attempt.userId,
      lessonId: attempt.lessonId,
      progressionPassed: true,
      exerciseId: {
        in: lesson.exercises.map((exercise) => exercise.id)
      }
    },
    select: {
      exerciseId: true
    },
    distinct: ["exerciseId"]
  });

  const lessonIsNowComplete =
    passedExerciseRows.length === lesson.exercises.length &&
    lessonProgress.status !== "COMPLETED";

  let spriteAdvanced = false;

  if (lessonIsNowComplete) {
    await tx.userLessonProgress.update({
      where: {
        id: lessonProgress.id
      },
      data: {
        status: "COMPLETED",
        completedAt: lessonProgress.completedAt ?? now,
        unlockedAt: lessonProgress.unlockedAt ?? now,
        startedAt: lessonProgress.startedAt ?? now,
        lastAttemptAt: attempt.submittedAt
      }
    });

    const spriteState = await tx.spriteState.upsert({
      where: {
        userId: attempt.userId
      },
      update: {},
      create: {
        userId: attempt.userId,
        currentStage: "INFANT",
        currentMood: "CALM",
        growthPoints: 0
      }
    });

    const nextGrowthPoints = spriteState.growthPoints + LESSON_COMPLETION_GROWTH_POINTS;
    const crossedToToddler =
      spriteState.currentStage === "INFANT" &&
      nextGrowthPoints >= TODDLER_STAGE_THRESHOLD;

    await tx.spriteState.update({
      where: {
        id: spriteState.id
      },
      data: {
        growthPoints: nextGrowthPoints,
        currentStage: crossedToToddler ? "TODDLER" : spriteState.currentStage
      }
    });

    if (crossedToToddler) {
      await tx.spriteGrowthEvent.upsert({
        where: {
          userId_lessonId_trigger_toStage: {
            userId: attempt.userId,
            lessonId: attempt.lessonId,
            trigger: "LESSON_COMPLETION",
            toStage: "TODDLER"
          }
        },
        update: {},
        create: {
          userId: attempt.userId,
          spriteStateId: spriteState.id,
          lessonId: attempt.lessonId,
          fromStage: "INFANT",
          toStage: "TODDLER",
          trigger: "LESSON_COMPLETION",
          notes: "V1 threshold reached from lesson completion."
        }
      });

      spriteAdvanced = true;
    }
  }

  if (hooks?.afterStateMutations) {
    await hooks.afterStateMutations();
  }

  return {
    wasAlreadyProcessed: false,
    passed: true,
    lessonCompleted: lessonIsNowComplete,
    spriteAdvanced
  };
}

export async function processAttemptWithProgression({
  prisma,
  attemptId,
  analysisInput,
  hooks
}: {
  prisma: PrismaClient;
  attemptId: string;
  analysisInput: {
    feedbackCode:
      | "PITCH_STEADY"
      | "PITCH_VARIATION_REQUIRED"
      | "TIMING_REPEAT_REQUIRED"
      | "CLARITY_RETRY_REQUIRED"
      | "ENERGY_INCREASE_REQUIRED";
    analysisVersion: string;
    summary: string;
    metricsJson: Prisma.InputJsonValue;
  };
  hooks?: EvaluateAttemptProgressionOptions["hooks"];
}) {
  return prisma.$transaction(async (tx) => {
    const updatedAttempt = await tx.attempt.update({
      where: {
        id: attemptId
      },
      data: {
        status: "SCORED",
        voiceAnalysisResult: {
          upsert: {
            update: {
              status: "COMPLETED",
              feedbackCode: analysisInput.feedbackCode,
              analysisVersion: analysisInput.analysisVersion,
              summary: analysisInput.summary,
              metricsJson: analysisInput.metricsJson,
              completedAt: new Date()
            },
            create: {
              status: "COMPLETED",
              feedbackCode: analysisInput.feedbackCode,
              analysisVersion: analysisInput.analysisVersion,
              summary: analysisInput.summary,
              metricsJson: analysisInput.metricsJson,
              completedAt: new Date()
            }
          }
        }
      },
      include: {
        voiceAnalysisResult: true
      }
    });

    const progression = await evaluateAttemptProgression({
      tx,
      attemptId,
      hooks
    });

    const hydratedAttempt = await tx.attempt.findUniqueOrThrow({
      where: {
        id: updatedAttempt.id
      },
      include: {
        voiceAnalysisResult: true
      }
    });

    return {
      attempt: hydratedAttempt,
      progression
    };
  });
}

function readAnalysisMetrics(attempt: AttemptWithAnalysis) {
  const metrics = (attempt.voiceAnalysisResult?.metricsJson ?? {}) as Partial<{
    pitchScore: number;
    phonemeScore: number;
    timingScore: number;
  }>;

  return {
    pitchScore: metrics.pitchScore ?? 0,
    phonemeScore: metrics.phonemeScore ?? 0,
    timingScore: metrics.timingScore ?? 0
  };
}
