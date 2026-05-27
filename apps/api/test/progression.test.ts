import { randomUUID } from "node:crypto";

import { PrismaClient } from "@samasama/db";
import { afterAll, describe, expect, it } from "vitest";

import { evaluateAttemptProgression, processAttemptWithProgression } from "../src/progression";

const prisma = new PrismaClient();
const createdUserEmails: string[] = [];

describe("progression service", () => {
  afterAll(async () => {
    await prisma.refreshToken.deleteMany({
      where: {
        user: {
          email: {
            in: createdUserEmails
          }
        }
      }
    });

    await prisma.spriteGrowthEvent.deleteMany({
      where: {
        user: {
          email: {
            in: createdUserEmails
          }
        }
      }
    });

    await prisma.voiceAnalysisResult.deleteMany({
      where: {
        attempt: {
          user: {
            email: {
              in: createdUserEmails
            }
          }
        }
      }
    });

    await prisma.attempt.deleteMany({
      where: {
        user: {
          email: {
            in: createdUserEmails
          }
        }
      }
    });

    await prisma.userLessonProgress.deleteMany({
      where: {
        user: {
          email: {
            in: createdUserEmails
          }
        }
      }
    });

    await prisma.spriteState.deleteMany({
      where: {
        user: {
          email: {
            in: createdUserEmails
          }
        }
      }
    });

    await prisma.user.deleteMany({
      where: {
        email: {
          in: createdUserEmails
        }
      }
    });

    await prisma.$disconnect();
  });

  it("updates lesson progress once and avoids duplicate growth events on reprocessing", async () => {
    const email = `progression-${randomUUID()}@example.test`;
    createdUserEmails.push(email);

    const user = await prisma.user.create({
      data: {
        email,
        displayName: "Progression User",
        passwordHash: "$2b$12$kETdpLVTILy/GqPm/C7bLeTqPzzHLFJA9EzaoEixN06lcgrk4WKxm",
        spriteState: {
          create: {
            currentStage: "INFANT",
            currentMood: "CALM",
            growthPoints: 10
          }
        }
      }
    });

    const lesson = await prisma.lesson.findUniqueOrThrow({
      where: { code: "INFANT_VOWEL_A" },
      include: {
        exercises: {
          orderBy: {
            sortOrder: "asc"
          }
        }
      }
    });

    const firstAttempt = await prisma.attempt.create({
      data: {
        userId: user.id,
        lessonId: lesson.id,
        exerciseId: lesson.exercises[0]!.id,
        status: "PENDING",
        transcript: "A"
      }
    });

    const firstResult = await processAttemptWithProgression({
      prisma,
      attemptId: firstAttempt.id,
      analysisInput: {
        feedbackCode: "PITCH_STEADY",
        analysisVersion: "test-v1",
        summary: "Pass exercise one",
        metricsJson: {
          pitchScore: 0.81,
          phonemeScore: 0.83,
          timingScore: 0.75
        }
      }
    });

    expect(firstResult.progression.passed).toBe(true);
    expect(firstResult.progression.lessonCompleted).toBe(false);

    const secondAttempt = await prisma.attempt.create({
      data: {
        userId: user.id,
        lessonId: lesson.id,
        exerciseId: lesson.exercises[1]!.id,
        status: "PENDING",
        transcript: "AA"
      }
    });

    const secondResult = await processAttemptWithProgression({
      prisma,
      attemptId: secondAttempt.id,
      analysisInput: {
        feedbackCode: "PITCH_STEADY",
        analysisVersion: "test-v1",
        summary: "Pass exercise two",
        metricsJson: {
          pitchScore: 0.84,
          phonemeScore: 0.82,
          timingScore: 0.77
        }
      }
    });

    expect(secondResult.progression.passed).toBe(true);
    expect(secondResult.progression.lessonCompleted).toBe(true);
    expect(secondResult.progression.spriteAdvanced).toBe(true);

    const progressAfterCompletion = await prisma.userLessonProgress.findUniqueOrThrow({
      where: {
        userId_lessonId: {
          userId: user.id,
          lessonId: lesson.id
        }
      }
    });

    const completedAt = progressAfterCompletion.completedAt;
    expect(progressAfterCompletion.status).toBe("COMPLETED");
    expect(completedAt).not.toBeNull();

    const reprocessedResult = await prisma.$transaction((tx) =>
      evaluateAttemptProgression({
        tx,
        attemptId: secondAttempt.id
      })
    );

    expect(reprocessedResult.wasAlreadyProcessed).toBe(true);

    const progressAfterReprocess = await prisma.userLessonProgress.findUniqueOrThrow({
      where: {
        userId_lessonId: {
          userId: user.id,
          lessonId: lesson.id
        }
      }
    });

    expect(progressAfterReprocess.completedAt?.toISOString()).toBe(completedAt?.toISOString());

    const growthEvents = await prisma.spriteGrowthEvent.findMany({
      where: {
        userId: user.id,
        lessonId: lesson.id
      }
    });

    expect(growthEvents).toHaveLength(1);
  });

  it("does not complete lessons on failed attempts and rolls back on transaction failure", async () => {
    const failEmail = `progression-fail-${randomUUID()}@example.test`;
    createdUserEmails.push(failEmail);

    const failUser = await prisma.user.create({
      data: {
        email: failEmail,
        displayName: "Progression Fail User",
        passwordHash: "$2b$12$kETdpLVTILy/GqPm/C7bLeTqPzzHLFJA9EzaoEixN06lcgrk4WKxm"
      }
    });

    const lesson = await prisma.lesson.findUniqueOrThrow({
      where: { code: "INFANT_VOWEL_I" },
      include: {
        exercises: {
          orderBy: {
            sortOrder: "asc"
          }
        }
      }
    });

    const failedAttempt = await prisma.attempt.create({
      data: {
        userId: failUser.id,
        lessonId: lesson.id,
        exerciseId: lesson.exercises[0]!.id,
        status: "PENDING",
        transcript: null
      }
    });

    const failedResult = await processAttemptWithProgression({
      prisma,
      attemptId: failedAttempt.id,
      analysisInput: {
        feedbackCode: "CLARITY_RETRY_REQUIRED",
        analysisVersion: "test-v1",
        summary: "Fail exercise",
        metricsJson: {
          pitchScore: 0.45,
          phonemeScore: 0.42,
          timingScore: 0.6
        }
      }
    });

    expect(failedResult.progression.passed).toBe(false);
    expect(failedResult.progression.lessonCompleted).toBe(false);

    const failedProgress = await prisma.userLessonProgress.findUniqueOrThrow({
      where: {
        userId_lessonId: {
          userId: failUser.id,
          lessonId: lesson.id
        }
      }
    });

    expect(failedProgress.status).not.toBe("COMPLETED");
    expect(failedProgress.completedAt).toBeNull();

    const txEmail = `progression-tx-${randomUUID()}@example.test`;
    createdUserEmails.push(txEmail);

    const txUser = await prisma.user.create({
      data: {
        email: txEmail,
        displayName: "Progression Tx User",
        passwordHash: "$2b$12$kETdpLVTILy/GqPm/C7bLeTqPzzHLFJA9EzaoEixN06lcgrk4WKxm"
      }
    });

    const txAttempt = await prisma.attempt.create({
      data: {
        userId: txUser.id,
        lessonId: lesson.id,
        exerciseId: lesson.exercises[0]!.id,
        status: "PENDING",
        transcript: "I"
      }
    });

    await expect(
      processAttemptWithProgression({
        prisma,
        attemptId: txAttempt.id,
        analysisInput: {
          feedbackCode: "PITCH_STEADY",
          analysisVersion: "test-v1",
          summary: "Should roll back",
          metricsJson: {
            pitchScore: 0.82,
            phonemeScore: 0.84,
            timingScore: 0.7
          }
        },
        hooks: {
          afterStateMutations: () => {
            throw new Error("forced rollback");
          }
        }
      })
    ).rejects.toThrow("forced rollback");

    const rolledBackAttempt = await prisma.attempt.findUniqueOrThrow({
      where: {
        id: txAttempt.id
      },
      include: {
        voiceAnalysisResult: true
      }
    });

    expect(rolledBackAttempt.status).toBe("PENDING");
    expect(rolledBackAttempt.progressionEvaluatedAt).toBeNull();
    expect(rolledBackAttempt.progressionPassed).toBeNull();
    expect(rolledBackAttempt.voiceAnalysisResult).toBeNull();

    const rolledBackProgress = await prisma.userLessonProgress.findMany({
      where: {
        userId: txUser.id,
        lessonId: lesson.id
      }
    });

    expect(rolledBackProgress).toHaveLength(0);
  });
});
