import crypto from "node:crypto";

import type { PrismaClient } from "@samasama/db";
import type { SamasamaAuthResponse } from "@samasama/shared";
import bcrypt from "bcryptjs";

type AuthUserRecord = {
  id: string;
  email: string;
  displayName: string;
};

type BuildAuthResponseOptions = {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  user: AuthUserRecord;
};

type CreateRefreshTokenOptions = {
  prisma: PrismaClient;
  userId: string;
  ttlDays: number;
};

type FindActiveRefreshTokenOptions = {
  prisma: PrismaClient;
  plaintextToken: string;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function buildAuthResponse({
  accessToken,
  refreshToken,
  expiresInSeconds,
  user
}: BuildAuthResponseOptions): SamasamaAuthResponse {
  return {
    accessToken,
    refreshToken,
    expiresInSeconds,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName
    }
  };
}

export async function createRefreshToken({
  prisma,
  userId,
  ttlDays
}: CreateRefreshTokenOptions) {
  const plaintextToken = crypto.randomBytes(48).toString("hex");

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(plaintextToken),
      expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000)
    }
  });

  return plaintextToken;
}

export async function findActiveRefreshTokenByPlaintext({
  prisma,
  plaintextToken
}: FindActiveRefreshTokenOptions) {
  const refreshToken = await prisma.refreshToken.findUnique({
    where: {
      tokenHash: hashRefreshToken(plaintextToken)
    },
    include: {
      user: true
    }
  });

  if (!refreshToken) {
    return null;
  }

  if (refreshToken.revokedAt) {
    return null;
  }

  if (refreshToken.expiresAt <= new Date()) {
    return null;
  }

  return refreshToken;
}

export async function revokeRefreshToken(prisma: PrismaClient, refreshTokenId: string) {
  await prisma.refreshToken.update({
    where: { id: refreshTokenId },
    data: {
      revokedAt: new Date()
    }
  });
}

function hashRefreshToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
