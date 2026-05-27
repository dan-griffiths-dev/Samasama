import { randomUUID } from "node:crypto";

import { PrismaClient } from "@samasama/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app";

const prisma = new PrismaClient();
const createdUserEmails: string[] = [];

describe("auth routes", () => {
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

    await prisma.user.deleteMany({
      where: {
        email: {
          in: createdUserEmails
        }
      }
    });

    await prisma.$disconnect();
  });

  it("registers, logs in, rotates refresh tokens, and returns /me", async () => {
    const app = createApp({ prisma });
    const email = `auth-${randomUUID()}@example.test`;
    createdUserEmails.push(email);

    const registerResponse = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email,
        displayName: "Auth Test User",
        password: "password123"
      }
    });

    expect(registerResponse.statusCode).toBe(201);

    const registerBody = registerResponse.json();
    expect(registerBody.user.email).toBe(email);
    expect(registerBody.accessToken).toBeTruthy();
    expect(registerBody.refreshToken).toBeTruthy();

    const loginResponse = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email,
        password: "password123"
      }
    });

    expect(loginResponse.statusCode).toBe(200);

    const loginBody = loginResponse.json();

    const meResponse = await app.inject({
      method: "GET",
      url: "/me",
      headers: {
        authorization: `Bearer ${loginBody.accessToken}`
      }
    });

    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json().user.email).toBe(email);

    const refreshResponse = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: {
        refreshToken: loginBody.refreshToken
      }
    });

    expect(refreshResponse.statusCode).toBe(200);

    const refreshBody = refreshResponse.json();
    expect(refreshBody.refreshToken).not.toBe(loginBody.refreshToken);
    expect(refreshBody.accessToken).not.toBe(loginBody.accessToken);

    const reuseRefreshResponse = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: {
        refreshToken: loginBody.refreshToken
      }
    });

    expect(reuseRefreshResponse.statusCode).toBe(401);

    await app.close();
  });

  it("rejects invalid tokens", async () => {
    const app = createApp({ prisma });

    const meResponse = await app.inject({
      method: "GET",
      url: "/me",
      headers: {
        authorization: "Bearer invalid-token"
      }
    });

    expect(meResponse.statusCode).toBe(401);

    const refreshResponse = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: {
        refreshToken: "invalid-token"
      }
    });

    expect(refreshResponse.statusCode).toBe(401);

    await app.close();
  });
});
