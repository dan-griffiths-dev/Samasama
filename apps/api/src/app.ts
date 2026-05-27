import { randomUUID } from "node:crypto";

import fastifyJwt from "@fastify/jwt";
import type { Prisma } from "@prisma/client";
import { PrismaClient } from "@samasama/db";
import {
  SamasamaApiHealthResponse,
  SamasamaAuthResponse,
  SamasamaAttemptDetailResponse,
  SamasamaAttemptDto,
  SamasamaAttemptStatus,
  SamasamaCurrentUserResponse,
  SamasamaExerciseKind,
  SamasamaFeedbackCode,
  SamasamaLessonDetailDto,
  SamasamaLessonDetailResponse,
  SamasamaLessonProgressStatus,
  SamasamaLessonStage,
  SamasamaLessonSummaryDto,
  SamasamaLessonsListResponse,
  SamasamaCreateAttemptResponse,
  SamasamaProgressionSnapshotDto,
  SamasamaSpriteStage,
  SamasamaServiceStatus
} from "@samasama/shared";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";

import {
  buildAuthResponse,
  createRefreshToken,
  findActiveRefreshTokenByPlaintext,
  hashPassword,
  revokeRefreshToken,
  verifyPassword
} from "./auth";
import { readApiConfig } from "./config";
import {
  SamasamaPlaceholderAttemptScoringService,
  type SamasamaAttemptScoringService
} from "./scoring";
import { processAttemptWithProgression } from "./progression";

const registerRequestSchema = z.object({
  email: z.string().trim().email(),
  displayName: z.string().trim().min(1).max(120),
  password: z.string().min(8).max(128)
});

const loginRequestSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128)
});

const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1)
});

const lessonParamsSchema = z.object({
  lessonId: z.string().min(1)
});

const attemptParamsSchema = z.object({
  attemptId: z.string().min(1)
});

const createAttemptRequestSchema = z.object({
  exerciseId: z.string().min(1),
  transcript: z.string().trim().min(1).max(255).nullable().optional(),
  mediaPath: z.string().trim().min(1).max(500).nullable().optional()
});

type CreateAppOptions = {
  prisma?: PrismaClient;
  scoringService?: SamasamaAttemptScoringService;
};

export function createApp(options: CreateAppOptions = {}) {
  const config = readApiConfig();
  const prisma = options.prisma ?? new PrismaClient();
  const scoringService =
    options.scoringService ?? new SamasamaPlaceholderAttemptScoringService();
  const app = Fastify({ logger: false });

  app.register(fastifyJwt, {
    secret: config.jwtAccessSecret
  });

  app.get("/health", async () => {
    const response: SamasamaApiHealthResponse = {
      status: SamasamaServiceStatus.OK,
      service: "api"
    };

    return response;
  });

  app.get("/lessons", async (request, reply) => {
    const viewerUserId = await getOptionalViewerUserId(request, reply);

    if (reply.sent) {
      return;
    }

    const lessons = await prisma.lesson.findMany({
      where: {
        stage: {
          in: ["INFANT", "TODDLER"]
        }
      },
      orderBy: {
        sortOrder: "asc"
      },
      include: {
        exercises: {
          orderBy: {
            sortOrder: "asc"
          }
        },
        prerequisites: {
          include: {
            prerequisiteLesson: true
          }
        }
      }
    });

    const progressByLessonId = await loadViewerProgressByLessonId({
      prisma,
      userId: viewerUserId,
      lessonIds: lessons.map((lesson) => lesson.id)
    });

    const response: SamasamaLessonsListResponse = {
      lessons: lessons.map((lesson) => mapLessonSummaryDto(lesson, progressByLessonId.get(lesson.id) ?? null))
    };

    return reply.send(response);
  });

  app.get("/lessons/:lessonId", async (request, reply) => {
    const parsedParams = lessonParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        message: "Invalid lesson id"
      });
    }

    const viewerUserId = await getOptionalViewerUserId(request, reply);

    if (reply.sent) {
      return;
    }

    const lesson = await prisma.lesson.findUnique({
      where: {
        id: parsedParams.data.lessonId
      },
      include: {
        exercises: {
          orderBy: {
            sortOrder: "asc"
          }
        },
        prerequisites: {
          include: {
            prerequisiteLesson: true
          }
        }
      }
    });

    if (!lesson) {
      return reply.status(404).send({
        message: "Lesson not found"
      });
    }

    const progressByLessonId = await loadViewerProgressByLessonId({
      prisma,
      userId: viewerUserId,
      lessonIds: [lesson.id]
    });

    const response: SamasamaLessonDetailResponse = {
      lesson: mapLessonDetailDto(lesson, progressByLessonId.get(lesson.id) ?? null)
    };

    return reply.send(response);
  });

  app.post("/attempts", async (request, reply) => {
    const viewerUserId = await getRequiredViewerUserId(request, reply);

    if (!viewerUserId) {
      return;
    }

    const parsedBody = createAttemptRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.status(400).send({
        message: "Invalid request body",
        issues: parsedBody.error.flatten()
      });
    }

    const exercise = await prisma.exercise.findUnique({
      where: {
        id: parsedBody.data.exerciseId
      },
      include: {
        lesson: true
      }
    });

    if (!exercise) {
      return reply.status(404).send({
        message: "Exercise not found"
      });
    }

    const pendingAttempt = await prisma.attempt.create({
      data: {
        userId: viewerUserId,
        lessonId: exercise.lessonId,
        exerciseId: exercise.id,
        status: "PENDING",
        transcript: parsedBody.data.transcript ?? null,
        mediaPath: parsedBody.data.mediaPath ?? null
      }
    });

    const scoringResult = await scoringService.scoreAttempt({
      exerciseCode: exercise.code,
      transcript: parsedBody.data.transcript ?? null,
      mediaPath: parsedBody.data.mediaPath ?? null
    });

    const scoredAttempt = await processAttemptWithProgression({
      prisma,
      attemptId: pendingAttempt.id,
      analysisInput: {
        feedbackCode: mapFeedbackCode(scoringResult.feedbackCode),
        analysisVersion: scoringResult.analysisVersion,
        summary: scoringResult.summary,
        metricsJson: scoringResult.metrics as unknown as Prisma.InputJsonValue
      }
    });

    const response: SamasamaCreateAttemptResponse = {
      attempt: mapAttemptDto(scoredAttempt.attempt),
      progressionSnapshot: await buildProgressionSnapshot({
        prisma,
        userId: viewerUserId
      })
    };

    return reply.status(201).send(response);
  });

  app.get("/attempts/:attemptId", async (request, reply) => {
    const viewerUserId = await getRequiredViewerUserId(request, reply);

    if (!viewerUserId) {
      return;
    }

    const parsedParams = attemptParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({
        message: "Invalid attempt id"
      });
    }

    const attempt = await prisma.attempt.findFirst({
      where: {
        id: parsedParams.data.attemptId,
        userId: viewerUserId
      },
      include: {
        voiceAnalysisResult: true
      }
    });

    if (!attempt) {
      return reply.status(404).send({
        message: "Attempt not found"
      });
    }

    const response: SamasamaAttemptDetailResponse = {
      attempt: mapAttemptDto(attempt)
    };

    return reply.send(response);
  });

  app.post("/auth/register", async (request, reply) => {
    const parsedBody = registerRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.status(400).send({
        message: "Invalid request body",
        issues: parsedBody.error.flatten()
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: parsedBody.data.email }
    });

    if (existingUser) {
      return reply.status(409).send({ message: "User already exists" });
    }

    const passwordHash = await hashPassword(parsedBody.data.password);
    const user = await prisma.user.create({
      data: {
        email: parsedBody.data.email,
        displayName: parsedBody.data.displayName,
        passwordHash
      }
    });

    const accessToken = await signAccessToken({
      app,
      userId: user.id,
      email: user.email,
      expiresInSeconds: config.jwtAccessExpiresInSeconds
    });
    const refreshToken = await createRefreshToken({
      prisma,
      userId: user.id,
      ttlDays: config.refreshTokenTtlDays
    });
    const response: SamasamaAuthResponse = buildAuthResponse({
      accessToken,
      refreshToken,
      expiresInSeconds: config.jwtAccessExpiresInSeconds,
      user
    });

    return reply.status(201).send(response);
  });

  app.post("/auth/login", async (request, reply) => {
    const parsedBody = loginRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.status(400).send({
        message: "Invalid request body",
        issues: parsedBody.error.flatten()
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: parsedBody.data.email }
    });

    if (!user) {
      return reply.status(401).send({ message: "Invalid credentials" });
    }

    const passwordMatches = await verifyPassword(
      parsedBody.data.password,
      user.passwordHash
    );

    if (!passwordMatches) {
      return reply.status(401).send({ message: "Invalid credentials" });
    }

    const accessToken = await signAccessToken({
      app,
      userId: user.id,
      email: user.email,
      expiresInSeconds: config.jwtAccessExpiresInSeconds
    });
    const refreshToken = await createRefreshToken({
      prisma,
      userId: user.id,
      ttlDays: config.refreshTokenTtlDays
    });
    const response: SamasamaAuthResponse = buildAuthResponse({
      accessToken,
      refreshToken,
      expiresInSeconds: config.jwtAccessExpiresInSeconds,
      user
    });

    return reply.send(response);
  });

  app.post("/auth/refresh", async (request, reply) => {
    const parsedBody = refreshRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.status(400).send({
        message: "Invalid request body",
        issues: parsedBody.error.flatten()
      });
    }

    const refreshTokenRecord = await findActiveRefreshTokenByPlaintext({
      prisma,
      plaintextToken: parsedBody.data.refreshToken
    });

    if (!refreshTokenRecord) {
      return reply.status(401).send({ message: "Invalid refresh token" });
    }

    await revokeRefreshToken(prisma, refreshTokenRecord.id);

    const accessToken = await signAccessToken({
      app,
      userId: refreshTokenRecord.user.id,
      email: refreshTokenRecord.user.email,
      expiresInSeconds: config.jwtAccessExpiresInSeconds
    });
    const nextRefreshToken = await createRefreshToken({
      prisma,
      userId: refreshTokenRecord.user.id,
      ttlDays: config.refreshTokenTtlDays
    });
    const response: SamasamaAuthResponse = buildAuthResponse({
      accessToken,
      refreshToken: nextRefreshToken,
      expiresInSeconds: config.jwtAccessExpiresInSeconds,
      user: refreshTokenRecord.user
    });

    return reply.send(response);
  });

  app.get("/me", async (request, reply) => {
    try {
      const token = await request.jwtVerify<{ sub: string; email: string }>();
      const user = await prisma.user.findUnique({
        where: { id: token.sub }
      });

      if (!user) {
        return reply.status(401).send({ message: "Unauthorized" });
      }

      const response: SamasamaCurrentUserResponse = {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName
        }
      };

      return reply.send(response);
    } catch {
      return reply.status(401).send({ message: "Unauthorized" });
    }
  });

  app.setErrorHandler((error, _request, reply) => {
    console.error(error);
    return reply.status(500).send({ message: "Internal server error" });
  });

  return app;
}

async function getOptionalViewerUserId(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authorizationHeader = request.headers.authorization;

  if (!authorizationHeader) {
    return null;
  }

  try {
    const token = await request.jwtVerify<{ sub: string }>();
    return token.sub;
  } catch {
    reply.status(401).send({ message: "Unauthorized" });
    return null;
  }
}

async function getRequiredViewerUserId(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const userId = await getOptionalViewerUserId(request, reply);

  if (!userId && !reply.sent) {
    reply.status(401).send({ message: "Unauthorized" });
    return null;
  }

  return userId;
}

async function loadViewerProgressByLessonId({
  prisma,
  userId,
  lessonIds
}: {
  prisma: PrismaClient;
  userId: string | null;
  lessonIds: string[];
}) {
  if (!userId || lessonIds.length === 0) {
    return new Map();
  }

  const progressRows = await prisma.userLessonProgress.findMany({
    where: {
      userId,
      lessonId: {
        in: lessonIds
      }
    }
  });

  return new Map(progressRows.map((progressRow) => [progressRow.lessonId, progressRow]));
}

function mapLessonSummaryDto(
  lesson: {
    id: string;
    code: string;
    title: string;
    description: string | null;
    stage: "INFANT" | "TODDLER";
    sortOrder: number;
    exercises: { id: string }[];
    prerequisites: {
      prerequisiteLesson: {
        id: string;
        code: string;
        title: string;
        stage: "INFANT" | "TODDLER";
      };
    }[];
  },
  progress: {
    status: "LOCKED" | "AVAILABLE" | "IN_PROGRESS" | "COMPLETED";
    unlockedAt: Date | null;
    completedAt: Date | null;
    lastAttemptAt: Date | null;
  } | null
): SamasamaLessonSummaryDto {
  return {
    id: lesson.id,
    code: lesson.code,
    title: lesson.title,
    description: lesson.description,
    stage: mapLessonStage(lesson.stage),
    sortOrder: lesson.sortOrder,
    exerciseCount: lesson.exercises.length,
    prerequisiteLessonCodes: lesson.prerequisites.map((item) => item.prerequisiteLesson.code),
    prerequisiteLessons: lesson.prerequisites.map((item) => ({
      lessonId: item.prerequisiteLesson.id,
      lessonCode: item.prerequisiteLesson.code,
      lessonTitle: item.prerequisiteLesson.title,
      lessonStage: mapLessonStage(item.prerequisiteLesson.stage)
    })),
    unlockMetadata: mapUnlockMetadata(progress)
  };
}

function mapLessonDetailDto(
  lesson: {
    id: string;
    code: string;
    title: string;
    description: string | null;
    stage: "INFANT" | "TODDLER";
    sortOrder: number;
    exercises: {
      id: string;
      lessonId: string;
      code: string;
      title: string;
      promptText: string;
      exerciseType: "VOWEL" | "SYLLABLE" | "PHRASE";
      sortOrder: number;
    }[];
    prerequisites: {
      prerequisiteLesson: {
        id: string;
        code: string;
        title: string;
        stage: "INFANT" | "TODDLER";
      };
    }[];
  },
  progress: {
    status: "LOCKED" | "AVAILABLE" | "IN_PROGRESS" | "COMPLETED";
    unlockedAt: Date | null;
    completedAt: Date | null;
    lastAttemptAt: Date | null;
  } | null
): SamasamaLessonDetailDto {
  return {
    id: lesson.id,
    code: lesson.code,
    title: lesson.title,
    description: lesson.description,
    stage: mapLessonStage(lesson.stage),
    sortOrder: lesson.sortOrder,
    prerequisiteLessonCodes: lesson.prerequisites.map((item) => item.prerequisiteLesson.code),
    prerequisiteLessons: lesson.prerequisites.map((item) => ({
      lessonId: item.prerequisiteLesson.id,
      lessonCode: item.prerequisiteLesson.code,
      lessonTitle: item.prerequisiteLesson.title,
      lessonStage: mapLessonStage(item.prerequisiteLesson.stage)
    })),
    unlockMetadata: mapUnlockMetadata(progress),
    exercises: lesson.exercises.map((exercise) => ({
      id: exercise.id,
      lessonId: exercise.lessonId,
      code: exercise.code,
      title: exercise.title,
      promptText: exercise.promptText,
      exerciseKind: mapExerciseKind(exercise.exerciseType),
      sortOrder: exercise.sortOrder
    }))
  };
}

function mapLessonStage(stage: "INFANT" | "TODDLER"): SamasamaLessonStage {
  return stage === "INFANT" ? SamasamaLessonStage.INFANT : SamasamaLessonStage.TODDLER;
}

function mapExerciseKind(exerciseType: "VOWEL" | "SYLLABLE" | "PHRASE"): SamasamaExerciseKind {
  if (exerciseType === "VOWEL") {
    return SamasamaExerciseKind.VOWEL;
  }

  if (exerciseType === "SYLLABLE") {
    return SamasamaExerciseKind.SYLLABLE;
  }

  return SamasamaExerciseKind.PHRASE;
}

function mapUnlockMetadata(
  progress: {
    status: "LOCKED" | "AVAILABLE" | "IN_PROGRESS" | "COMPLETED";
    unlockedAt: Date | null;
    completedAt: Date | null;
    lastAttemptAt: Date | null;
  } | null
) {
  if (!progress) {
    return null;
  }

  return {
    isAuthenticated: true,
    status: mapProgressStatus(progress.status),
    isUnlocked: progress.status !== "LOCKED",
    isCompleted: progress.status === "COMPLETED",
    unlockedAtIso: progress.unlockedAt?.toISOString() ?? null,
    completedAtIso: progress.completedAt?.toISOString() ?? null,
    lastAttemptAtIso: progress.lastAttemptAt?.toISOString() ?? null
  };
}

function mapProgressStatus(status: "LOCKED" | "AVAILABLE" | "IN_PROGRESS" | "COMPLETED") {
  if (status === "LOCKED") {
    return SamasamaLessonProgressStatus.LOCKED;
  }

  if (status === "AVAILABLE") {
    return SamasamaLessonProgressStatus.AVAILABLE;
  }

  if (status === "IN_PROGRESS") {
    return SamasamaLessonProgressStatus.IN_PROGRESS;
  }

  return SamasamaLessonProgressStatus.COMPLETED;
}

function mapAttemptDto(attempt: {
  id: string;
  userId: string;
  lessonId: string;
  exerciseId: string;
  status: "PENDING" | "SCORED" | "FAILED";
  progressionPassed: boolean | null;
  transcript: string | null;
  mediaPath: string | null;
  submittedAt: Date;
  createdAt: Date;
  voiceAnalysisResult?: {
    id: string;
    attemptId: string;
    feedbackCode:
      | "PITCH_STEADY"
      | "PITCH_VARIATION_REQUIRED"
      | "TIMING_REPEAT_REQUIRED"
      | "CLARITY_RETRY_REQUIRED"
      | "ENERGY_INCREASE_REQUIRED";
    analysisVersion: string;
    summary: string | null;
    completedAt: Date | null;
    metricsJson: unknown;
  } | null;
}): SamasamaAttemptDto {
  return {
    id: attempt.id,
    userId: attempt.userId,
    lessonId: attempt.lessonId,
    exerciseId: attempt.exerciseId,
    status: mapAttemptStatus(attempt.status),
    passed: attempt.progressionPassed,
    transcript: attempt.transcript,
    mediaPath: attempt.mediaPath,
    submittedAtIso: attempt.submittedAt.toISOString(),
    createdAtIso: attempt.createdAt.toISOString(),
    analysisResult: attempt.voiceAnalysisResult
      ? {
          id: attempt.voiceAnalysisResult.id,
          attemptId: attempt.voiceAnalysisResult.attemptId,
          feedbackCode: mapSharedFeedbackCode(attempt.voiceAnalysisResult.feedbackCode),
          analysisVersion: attempt.voiceAnalysisResult.analysisVersion,
          summary: attempt.voiceAnalysisResult.summary,
          completedAtIso: attempt.voiceAnalysisResult.completedAt?.toISOString() ?? null,
          metrics: mapMetricsJson(attempt.voiceAnalysisResult.metricsJson)
        }
      : null
  };
}

function mapAttemptStatus(status: "PENDING" | "SCORED" | "FAILED"): SamasamaAttemptStatus {
  if (status === "PENDING") {
    return SamasamaAttemptStatus.PENDING;
  }

  if (status === "SCORED") {
    return SamasamaAttemptStatus.SCORED;
  }

  return SamasamaAttemptStatus.FAILED;
}

function mapFeedbackCode(feedbackCode: SamasamaFeedbackCode) {
  return feedbackCode;
}

function mapSharedFeedbackCode(
  feedbackCode:
    | "PITCH_STEADY"
    | "PITCH_VARIATION_REQUIRED"
    | "TIMING_REPEAT_REQUIRED"
    | "CLARITY_RETRY_REQUIRED"
    | "ENERGY_INCREASE_REQUIRED"
) {
  if (feedbackCode === "PITCH_STEADY") {
    return SamasamaFeedbackCode.PITCH_STEADY;
  }

  if (feedbackCode === "PITCH_VARIATION_REQUIRED") {
    return SamasamaFeedbackCode.PITCH_VARIATION_REQUIRED;
  }

  if (feedbackCode === "TIMING_REPEAT_REQUIRED") {
    return SamasamaFeedbackCode.TIMING_REPEAT_REQUIRED;
  }

  if (feedbackCode === "CLARITY_RETRY_REQUIRED") {
    return SamasamaFeedbackCode.CLARITY_RETRY_REQUIRED;
  }

  return SamasamaFeedbackCode.ENERGY_INCREASE_REQUIRED;
}

function mapMetricsJson(metricsJson: unknown) {
  const metrics = (metricsJson ?? {}) as Partial<{
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

async function buildProgressionSnapshot({
  prisma,
  userId
}: {
  prisma: PrismaClient;
  userId: string;
}): Promise<SamasamaProgressionSnapshotDto> {
  const [lessonProgressRows, spriteState] = await Promise.all([
    prisma.userLessonProgress.findMany({
      where: {
        userId
      },
      orderBy: {
        lesson: {
          sortOrder: "asc"
        }
      }
    }),
    prisma.spriteState.findUnique({
      where: {
        userId
      }
    })
  ]);

  const currentLesson = lessonProgressRows.find(
    (item) => item.status === "IN_PROGRESS" || item.status === "AVAILABLE"
  );

  return {
    userId,
    currentLessonId: currentLesson?.lessonId ?? null,
    lessons: lessonProgressRows.map((item) => ({
      lessonId: item.lessonId,
      status: mapProgressStatus(item.status),
      completedAtIso: item.completedAt?.toISOString() ?? null
    })),
    sprite: {
      userId,
      currentStage:
        spriteState?.currentStage === "TODDLER"
          ? SamasamaSpriteStage.TODDLER
          : SamasamaSpriteStage.INFANT,
      growthPoints: spriteState?.growthPoints ?? 0
    }
  };
}

async function signAccessToken({
  app,
  userId,
  email,
  expiresInSeconds
}: {
  app: ReturnType<typeof Fastify>;
  userId: string;
  email: string;
  expiresInSeconds: number;
}) {
  return app.jwt.sign(
    {
      email,
      jti: randomUUID()
    },
    {
      sub: userId,
      expiresIn: expiresInSeconds
    }
  );
}
