import { randomUUID } from "node:crypto";

import { PrismaClient } from "@samasama/db";
import { SamasamaFeedbackCode } from "@samasama/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app";
import type { SamasamaAttemptScoringService } from "../src/scoring";

const prisma = new PrismaClient();
const createdUserEmails: string[] = [];

describe("attempt routes", () => {
  beforeAll(() => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret-1234567890";
    process.env.JWT_ACCESS_EXPIRES_IN_SECONDS = "900";
    process.env.REFRESH_TOKEN_TTL_DAYS = "30";
  });

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

    await prisma.user.deleteMany({
      where: {
        email: {
          in: createdUserEmails
        }
      }
    });

    await prisma.$disconnect();
  });

  it("creates an attempt, scores it, and persists the analysis result", async () => {
    const app = createApp({ prisma });
    const email = `attempt-${randomUUID()}@example.test`;
    createdUserEmails.push(email);

    const registerResponse = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email,
        displayName: "Attempt Test User",
        password: "password123"
      }
    });

    expect(registerResponse.statusCode).toBe(201);

    const { accessToken } = registerResponse.json();
    const exercise = await prisma.exercise.findUniqueOrThrow({
      where: {
        code: "INFANT_VOWEL_A_E1"
      }
    });

    const createResponse = await app.inject({
      method: "POST",
      url: "/attempts",
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      payload: {
        exerciseId: exercise.id,
        transcript: "A",
        mediaPath: "recordings/demo-a.wav"
      }
    });

    expect(createResponse.statusCode).toBe(201);

    const createBody = createResponse.json();
    expect(createBody.attempt.status).toBe("SCORED");
    expect(createBody.attempt.passed).toBe(true);
    expect(createBody.progressionSnapshot.userId).toBeTruthy();
    expect(createBody.progressionSnapshot.sprite.growthPoints).toBeGreaterThanOrEqual(0);
    expect(createBody.attempt.analysisResult.feedbackCode).toBe("PITCH_STEADY");
    expect(createBody.attempt.analysisResult.metrics.pitchScore).toBeGreaterThan(0);
    expect(createBody.attempt.analysisResult.metrics.phonemeScore).toBeGreaterThan(0);

    const persistedAttempt = await prisma.attempt.findUniqueOrThrow({
      where: {
        id: createBody.attempt.id
      },
      include: {
        voiceAnalysisResult: true
      }
    });

    expect(persistedAttempt.status).toBe("SCORED");
    expect(persistedAttempt.voiceAnalysisResult).not.toBeNull();
    expect(persistedAttempt.voiceAnalysisResult?.feedbackCode).toBe("PITCH_STEADY");

    const getResponse = await app.inject({
      method: "GET",
      url: `/attempts/${createBody.attempt.id}`,
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    });

    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json().attempt.id).toBe(createBody.attempt.id);
    expect(getResponse.json().attempt.passed).toBe(true);
    expect(getResponse.json().attempt.analysisResult.analysisVersion).toBe("placeholder-v1");

    await app.close();
  });

  it("rejects unauthenticated creation and missing attempts", async () => {
    const app = createApp({ prisma });
    const exercise = await prisma.exercise.findUniqueOrThrow({
      where: {
        code: "INFANT_VOWEL_A_E1"
      }
    });

    const createResponse = await app.inject({
      method: "POST",
      url: "/attempts",
      payload: {
        exerciseId: exercise.id
      }
    });

    expect(createResponse.statusCode).toBe(401);

    const email = `attempt-missing-${randomUUID()}@example.test`;
    createdUserEmails.push(email);

    const registerResponse = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email,
        displayName: "Attempt Missing User",
        password: "password123"
      }
    });

    const { accessToken } = registerResponse.json();
    const missingResponse = await app.inject({
      method: "GET",
      url: "/attempts/00000000-0000-0000-0000-000000000000",
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    });

    expect(missingResponse.statusCode).toBe(404);

    await app.close();
  });

  it("does not expose attempts across users", async () => {
    const app = createApp({ prisma });
    const ownerEmail = `attempt-owner-${randomUUID()}@example.test`;
    const viewerEmail = `attempt-viewer-${randomUUID()}@example.test`;
    createdUserEmails.push(ownerEmail, viewerEmail);

    const ownerRegisterResponse = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: ownerEmail,
        displayName: "Attempt Owner",
        password: "password123"
      }
    });
    const viewerRegisterResponse = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: viewerEmail,
        displayName: "Attempt Viewer",
        password: "password123"
      }
    });
    expect(ownerRegisterResponse.statusCode).toBe(201);
    expect(viewerRegisterResponse.statusCode).toBe(201);

    const exercise = await prisma.exercise.findUniqueOrThrow({
      where: {
        code: "INFANT_VOWEL_A_E1"
      }
    });
    const ownerAttemptResponse = await app.inject({
      method: "POST",
      url: "/attempts",
      headers: {
        authorization: `Bearer ${ownerRegisterResponse.json().accessToken}`
      },
      payload: {
        exerciseId: exercise.id,
        transcript: "A"
      }
    });

    expect(ownerAttemptResponse.statusCode).toBe(201);

    const crossUserGetResponse = await app.inject({
      method: "GET",
      url: `/attempts/${ownerAttemptResponse.json().attempt.id}`,
      headers: {
        authorization: `Bearer ${viewerRegisterResponse.json().accessToken}`
      }
    });

    expect(crossUserGetResponse.statusCode).toBe(404);

    await app.close();
  });

  it("returns validation errors and preserves failed scoring as progression state", async () => {
    const failingScoringService: SamasamaAttemptScoringService = {
      async scoreAttempt() {
        return {
          feedbackCode: SamasamaFeedbackCode.CLARITY_RETRY_REQUIRED,
          analysisVersion: "functional-fail-v1",
          summary: "Functional test failed scoring.",
          metrics: {
            pitchScore: 0.2,
            phonemeScore: 0.3,
            timingScore: 0.4
          }
        };
      }
    };
    const app = createApp({ prisma, scoringService: failingScoringService });
    const email = `attempt-failed-${randomUUID()}@example.test`;
    createdUserEmails.push(email);

    const registerResponse = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email,
        displayName: "Attempt Failed User",
        password: "password123"
      }
    });
    expect(registerResponse.statusCode).toBe(201);

    const invalidCreateResponse = await app.inject({
      method: "POST",
      url: "/attempts",
      headers: {
        authorization: `Bearer ${registerResponse.json().accessToken}`
      },
      payload: {
        exerciseId: ""
      }
    });
    expect(invalidCreateResponse.statusCode).toBe(400);

    const exercise = await prisma.exercise.findUniqueOrThrow({
      where: {
        code: "INFANT_VOWEL_I_E1"
      }
    });
    const createResponse = await app.inject({
      method: "POST",
      url: "/attempts",
      headers: {
        authorization: `Bearer ${registerResponse.json().accessToken}`
      },
      payload: {
        exerciseId: exercise.id,
        transcript: "I"
      }
    });

    expect(createResponse.statusCode).toBe(201);

    const body = createResponse.json();
    expect(body.attempt.status).toBe("SCORED");
    expect(body.attempt.passed).toBe(false);
    expect(body.attempt.analysisResult.feedbackCode).toBe("CLARITY_RETRY_REQUIRED");
    expect(body.attempt.analysisResult.metrics.pitchScore).toBe(0.2);
    expect(body.progressionSnapshot.lessons[0].status).toBe("AVAILABLE");
    expect(body.progressionSnapshot.sprite.currentStage).toBe("INFANT");
    expect(body.progressionSnapshot.sprite.growthPoints).toBe(0);

    const persistedProgress = await prisma.userLessonProgress.findUniqueOrThrow({
      where: {
        userId_lessonId: {
          userId: body.attempt.userId,
          lessonId: body.attempt.lessonId
        }
      }
    });
    expect(persistedProgress.status).toBe("AVAILABLE");
    expect(persistedProgress.completedAt).toBeNull();

    await app.close();
  });
});
