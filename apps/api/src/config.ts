import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const apiConfigSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30)
});

export function readApiConfig() {
  const parsed = apiConfigSchema.parse(process.env);

  return {
    apiPort: parsed.API_PORT,
    databaseUrl: parsed.DATABASE_URL,
    jwtAccessSecret: parsed.JWT_ACCESS_SECRET,
    jwtAccessExpiresInSeconds: parsed.JWT_ACCESS_EXPIRES_IN_SECONDS,
    refreshTokenTtlDays: parsed.REFRESH_TOKEN_TTL_DAYS
  };
}
