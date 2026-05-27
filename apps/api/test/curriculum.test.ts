import { PrismaClient } from "@samasama/db";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app";

const prisma = new PrismaClient();

describe("curriculum routes", () => {
  beforeAll(() => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret-1234567890";
    process.env.JWT_ACCESS_EXPIRES_IN_SECONDS = "900";
    process.env.REFRESH_TOKEN_TTL_DAYS = "30";
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns seeded lessons for anonymous requests", async () => {
    const app = createApp({ prisma });

    const response = await app.inject({
      method: "GET",
      url: "/lessons"
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.lessons).toHaveLength(5);
    expect(body.lessons[0].code).toBe("INFANT_VOWEL_A");
    expect(body.lessons[0].unlockMetadata).toBeNull();
    expect(body.lessons[3].stage).toBe("TODDLER");

    await app.close();
  });

  it("returns unlock metadata and exercises for authenticated requests", async () => {
    const app = createApp({ prisma });

    const loginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "demo@samasama.local",
        password: "password123"
      }
    });

    expect(loginResponse.statusCode).toBe(200);

    const { accessToken } = loginResponse.json();
    const lessonsResponse = await app.inject({
      method: "GET",
      url: "/lessons",
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    });

    expect(lessonsResponse.statusCode).toBe(200);

    const lessonsBody = lessonsResponse.json();
    expect(lessonsBody.lessons[0].unlockMetadata.status).toBe("COMPLETED");
    expect(lessonsBody.lessons[0].unlockMetadata.isCompleted).toBe(true);
    expect(lessonsBody.lessons[3].unlockMetadata.status).toBe("LOCKED");

    const firstLessonId = lessonsBody.lessons[0].id;
    const lessonDetailResponse = await app.inject({
      method: "GET",
      url: `/lessons/${firstLessonId}`,
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    });

    expect(lessonDetailResponse.statusCode).toBe(200);

    const lessonDetailBody = lessonDetailResponse.json();
    expect(lessonDetailBody.lesson.exercises).toHaveLength(2);
    expect(lessonDetailBody.lesson.exercises[0].code).toBe("INFANT_VOWEL_A_E1");
    expect(lessonDetailBody.lesson.unlockMetadata.status).toBe("COMPLETED");
    expect(lessonDetailBody.lesson.prerequisiteLessons).toEqual([]);

    await app.close();
  });

  it("returns prerequisite info and 404s when a lesson is missing", async () => {
    const app = createApp({ prisma });

    const targetLesson = await prisma.lesson.findUniqueOrThrow({
      where: {
        code: "SYLLABLE_BA"
      }
    });

    const lessonDetailResponse = await app.inject({
      method: "GET",
      url: `/lessons/${targetLesson.id}`
    });

    expect(lessonDetailResponse.statusCode).toBe(200);
    const lessonDetailBody = lessonDetailResponse.json();
    expect(lessonDetailBody.lesson.prerequisiteLessonCodes).toEqual(["INFANT_VOWEL_U"]);
    expect(lessonDetailBody.lesson.prerequisiteLessons[0].lessonCode).toBe("INFANT_VOWEL_U");

    const missingResponse = await app.inject({
      method: "GET",
      url: "/lessons/00000000-0000-0000-0000-000000000000"
    });

    expect(missingResponse.statusCode).toBe(404);

    await app.close();
  });
});
