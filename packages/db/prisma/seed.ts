import { PrismaClient, AnalysisStatus, AttemptSource, AttemptStatus, ExerciseType, FeedbackCode, LessonStage, LessonStatus, ProgressStatus, SpriteMood, SpriteStage, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@samasama.local" },
    update: {
      displayName: "Demo Learner",
      passwordHash: "$2b$12$kETdpLVTILy/GqPm/C7bLeTqPzzHLFJA9EzaoEixN06lcgrk4WKxm",
      role: UserRole.LEARNER
    },
    create: {
      email: "demo@samasama.local",
      displayName: "Demo Learner",
      passwordHash: "$2b$12$kETdpLVTILy/GqPm/C7bLeTqPzzHLFJA9EzaoEixN06lcgrk4WKxm",
      role: UserRole.LEARNER
    }
  });

  const lessonDefinitions = [
    {
      code: "INFANT_VOWEL_A",
      title: "INFANT_VOWEL_A",
      description: "Practice the placeholder sound A.",
      stage: LessonStage.INFANT,
      sortOrder: 1,
      exercises: [
        {
          code: "INFANT_VOWEL_A_E1",
          title: "INFANT_VOWEL_A_E1",
          promptText: "Say A",
          exerciseType: ExerciseType.VOWEL,
          sortOrder: 1
        },
        {
          code: "INFANT_VOWEL_A_E2",
          title: "INFANT_VOWEL_A_E2",
          promptText: "Say A again",
          exerciseType: ExerciseType.VOWEL,
          sortOrder: 2
        }
      ]
    },
    {
      code: "INFANT_VOWEL_I",
      title: "INFANT_VOWEL_I",
      description: "Practice the placeholder sound I.",
      stage: LessonStage.INFANT,
      sortOrder: 2,
      exercises: [
        {
          code: "INFANT_VOWEL_I_E1",
          title: "INFANT_VOWEL_I_E1",
          promptText: "Say I",
          exerciseType: ExerciseType.VOWEL,
          sortOrder: 1
        },
        {
          code: "INFANT_VOWEL_I_E2",
          title: "INFANT_VOWEL_I_E2",
          promptText: "Say I again",
          exerciseType: ExerciseType.VOWEL,
          sortOrder: 2
        }
      ]
    },
    {
      code: "INFANT_VOWEL_U",
      title: "INFANT_VOWEL_U",
      description: "Practice the placeholder sound U.",
      stage: LessonStage.INFANT,
      sortOrder: 3,
      exercises: [
        {
          code: "INFANT_VOWEL_U_E1",
          title: "INFANT_VOWEL_U_E1",
          promptText: "Say U",
          exerciseType: ExerciseType.VOWEL,
          sortOrder: 1
        },
        {
          code: "INFANT_VOWEL_U_E2",
          title: "INFANT_VOWEL_U_E2",
          promptText: "Say U again",
          exerciseType: ExerciseType.VOWEL,
          sortOrder: 2
        }
      ]
    },
    {
      code: "SYLLABLE_BA",
      title: "SYLLABLE_BA",
      description: "Repeat the placeholder syllable BA.",
      stage: LessonStage.TODDLER,
      sortOrder: 4,
      exercises: [
        {
          code: "SYLLABLE_BA_E1",
          title: "SYLLABLE_BA_E1",
          promptText: "Say BA",
          exerciseType: ExerciseType.SYLLABLE,
          sortOrder: 1
        },
        {
          code: "SYLLABLE_BA_E2",
          title: "SYLLABLE_BA_E2",
          promptText: "Say BA BA",
          exerciseType: ExerciseType.SYLLABLE,
          sortOrder: 2
        }
      ]
    },
    {
      code: "SYLLABLE_DA",
      title: "SYLLABLE_DA",
      description: "Repeat the placeholder syllable DA.",
      stage: LessonStage.TODDLER,
      sortOrder: 5,
      exercises: [
        {
          code: "SYLLABLE_DA_E1",
          title: "SYLLABLE_DA_E1",
          promptText: "Say DA",
          exerciseType: ExerciseType.SYLLABLE,
          sortOrder: 1
        },
        {
          code: "SYLLABLE_DA_E2",
          title: "SYLLABLE_DA_E2",
          promptText: "Say DA DA",
          exerciseType: ExerciseType.SYLLABLE,
          sortOrder: 2
        }
      ]
    }
  ];

  const lessons = new Map<string, { id: string; exercises: { id: string; code: string }[] }>();

  for (const lessonDefinition of lessonDefinitions) {
    const lesson = await prisma.lesson.upsert({
      where: { code: lessonDefinition.code },
      update: {
        title: lessonDefinition.title,
        description: lessonDefinition.description,
        stage: lessonDefinition.stage,
        status: LessonStatus.PUBLISHED,
        sortOrder: lessonDefinition.sortOrder
      },
      create: {
        code: lessonDefinition.code,
        title: lessonDefinition.title,
        description: lessonDefinition.description,
        stage: lessonDefinition.stage,
        status: LessonStatus.PUBLISHED,
        sortOrder: lessonDefinition.sortOrder
      }
    });

    const exercises: { id: string; code: string }[] = [];

    for (const exerciseDefinition of lessonDefinition.exercises) {
      const exercise = await prisma.exercise.upsert({
        where: { code: exerciseDefinition.code },
        update: {
          lessonId: lesson.id,
          title: exerciseDefinition.title,
          promptText: exerciseDefinition.promptText,
          exerciseType: exerciseDefinition.exerciseType,
          sortOrder: exerciseDefinition.sortOrder
        },
        create: {
          lessonId: lesson.id,
          code: exerciseDefinition.code,
          title: exerciseDefinition.title,
          promptText: exerciseDefinition.promptText,
          exerciseType: exerciseDefinition.exerciseType,
          sortOrder: exerciseDefinition.sortOrder
        }
      });

      exercises.push({ id: exercise.id, code: exercise.code });
    }

    lessons.set(lessonDefinition.code, { id: lesson.id, exercises });
  }

  const prerequisitePairs = [
    ["INFANT_VOWEL_I", "INFANT_VOWEL_A"],
    ["INFANT_VOWEL_U", "INFANT_VOWEL_I"],
    ["SYLLABLE_BA", "INFANT_VOWEL_U"],
    ["SYLLABLE_DA", "SYLLABLE_BA"]
  ] as const;

  for (const [lessonCode, prerequisiteCode] of prerequisitePairs) {
    await prisma.lessonPrerequisite.upsert({
      where: {
        lessonId_prerequisiteLessonId: {
          lessonId: lessons.get(lessonCode)!.id,
          prerequisiteLessonId: lessons.get(prerequisiteCode)!.id
        }
      },
      update: {},
      create: {
        lessonId: lessons.get(lessonCode)!.id,
        prerequisiteLessonId: lessons.get(prerequisiteCode)!.id
      }
    });
  }

  const progressDefinitions = [
    {
      lessonCode: "INFANT_VOWEL_A",
      status: ProgressStatus.COMPLETED,
      unlockedAt: new Date("2026-04-01T08:00:00.000Z"),
      startedAt: new Date("2026-04-01T08:05:00.000Z"),
      completedAt: new Date("2026-04-01T08:15:00.000Z"),
      lastAttemptAt: new Date("2026-04-01T08:15:00.000Z")
    },
    {
      lessonCode: "INFANT_VOWEL_I",
      status: ProgressStatus.IN_PROGRESS,
      unlockedAt: new Date("2026-04-01T08:16:00.000Z"),
      startedAt: new Date("2026-04-01T08:20:00.000Z"),
      completedAt: null,
      lastAttemptAt: new Date("2026-04-01T08:25:00.000Z")
    },
    {
      lessonCode: "INFANT_VOWEL_U",
      status: ProgressStatus.AVAILABLE,
      unlockedAt: new Date("2026-04-01T08:30:00.000Z"),
      startedAt: null,
      completedAt: null,
      lastAttemptAt: null
    },
    {
      lessonCode: "SYLLABLE_BA",
      status: ProgressStatus.LOCKED,
      unlockedAt: null,
      startedAt: null,
      completedAt: null,
      lastAttemptAt: null
    },
    {
      lessonCode: "SYLLABLE_DA",
      status: ProgressStatus.LOCKED,
      unlockedAt: null,
      startedAt: null,
      completedAt: null,
      lastAttemptAt: null
    }
  ];

  for (const progress of progressDefinitions) {
    await prisma.userLessonProgress.upsert({
      where: {
        userId_lessonId: {
          userId: demoUser.id,
          lessonId: lessons.get(progress.lessonCode)!.id
        }
      },
      update: {
        status: progress.status,
        unlockedAt: progress.unlockedAt,
        startedAt: progress.startedAt,
        completedAt: progress.completedAt,
        lastAttemptAt: progress.lastAttemptAt
      },
      create: {
        userId: demoUser.id,
        lessonId: lessons.get(progress.lessonCode)!.id,
        status: progress.status,
        unlockedAt: progress.unlockedAt,
        startedAt: progress.startedAt,
        completedAt: progress.completedAt,
        lastAttemptAt: progress.lastAttemptAt
      }
    });
  }

  const spriteState = await prisma.spriteState.upsert({
    where: { userId: demoUser.id },
    update: {
      currentStage: SpriteStage.INFANT,
      currentMood: SpriteMood.CURIOUS,
      growthPoints: 12,
      lastFedAt: new Date("2026-04-01T07:55:00.000Z")
    },
    create: {
      userId: demoUser.id,
      currentStage: SpriteStage.INFANT,
      currentMood: SpriteMood.CURIOUS,
      growthPoints: 12,
      lastFedAt: new Date("2026-04-01T07:55:00.000Z")
    }
  });

  const firstAttempt = await prisma.attempt.upsert({
    where: { id: "11111111-1111-1111-1111-111111111111" },
    update: {
      userId: demoUser.id,
      lessonId: lessons.get("INFANT_VOWEL_A")!.id,
      exerciseId: lessons.get("INFANT_VOWEL_A")!.exercises[0]!.id,
      source: AttemptSource.MOBILE,
      status: AttemptStatus.SCORED,
      transcript: "A"
    },
    create: {
      id: "11111111-1111-1111-1111-111111111111",
      userId: demoUser.id,
      lessonId: lessons.get("INFANT_VOWEL_A")!.id,
      exerciseId: lessons.get("INFANT_VOWEL_A")!.exercises[0]!.id,
      source: AttemptSource.MOBILE,
      status: AttemptStatus.SCORED,
      transcript: "A",
      submittedAt: new Date("2026-04-01T08:10:00.000Z")
    }
  });

  await prisma.voiceAnalysisResult.upsert({
    where: { attemptId: firstAttempt.id },
    update: {
      status: AnalysisStatus.COMPLETED,
      feedbackCode: FeedbackCode.PITCH_STEADY,
      analysisVersion: "v1-placeholder",
      summary: "Placeholder analysis for INFANT_VOWEL_A.",
      metricsJson: {
        pitchScore: 0.82,
        phonemeScore: 0.79,
        timingScore: 0.74
      },
      completedAt: new Date("2026-04-01T08:10:05.000Z")
    },
    create: {
      attemptId: firstAttempt.id,
      status: AnalysisStatus.COMPLETED,
      feedbackCode: FeedbackCode.PITCH_STEADY,
      analysisVersion: "v1-placeholder",
      summary: "Placeholder analysis for INFANT_VOWEL_A.",
      metricsJson: {
        pitchScore: 0.82,
        phonemeScore: 0.79,
        timingScore: 0.74
      },
      completedAt: new Date("2026-04-01T08:10:05.000Z")
    }
  });

  await prisma.refreshToken.upsert({
    where: { tokenHash: "demo-refresh-token-hash" },
    update: {
      userId: demoUser.id,
      expiresAt: new Date("2026-05-01T00:00:00.000Z"),
      revokedAt: null
    },
    create: {
      userId: demoUser.id,
      tokenHash: "demo-refresh-token-hash",
      expiresAt: new Date("2026-05-01T00:00:00.000Z")
    }
  });

  console.log("Seeded demo curriculum, user, attempt, analysis result, and sprite state.");
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
