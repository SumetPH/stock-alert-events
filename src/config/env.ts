import { existsSync } from "node:fs";
import dotenv from "dotenv";
import { z } from "zod";

const envFileCandidates =
  process.env.NODE_ENV === "production"
    ? [".env.prod", ".env.production", ".env"]
    : [".env.local", ".env"];

dotenv.config({
  path: envFileCandidates.find((path) => existsSync(path))
});

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  FINNHUB_API_KEY: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_CHAT_ID: z.string().min(1),
  CRON_TIMEZONE: z.string().min(1).default("Asia/Bangkok")
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join(", ");

  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = parsedEnv.data;
