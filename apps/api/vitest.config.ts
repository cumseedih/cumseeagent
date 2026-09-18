import { defineConfig } from "vitest/config";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Load apps/api/.env into the test process (dotenv-style, no extra dependency)
 * so Prisma gets DATABASE_URL. Real environment variables always win, and
 * TEST_DATABASE_URL can point the suite at a throwaway database.
 */
function loadEnvFile(): Record<string, string> {
  const file = resolve(process.cwd(), ".env");
  const out: Record<string, string> = {};
  if (!existsSync(file)) return out;
  for (const rawLine of readFileSync(file, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const fileEnv = loadEnvFile();

const env: Record<string, string> = {
  NODE_ENV: "test",
  ...fileEnv,
  ...(process.env.TEST_DATABASE_URL ? { DATABASE_URL: process.env.TEST_DATABASE_URL } : {}),
  // Secrets must never be inherited from a production .env when running tests
  JWT_SECRET: process.env.TEST_JWT_SECRET || "test-jwt-secret-please-change-32chars-min",
  ENCRYPTION_KEY: process.env.TEST_ENCRYPTION_KEY || "test-encryption-key-32-chars-min",
};
// Explicit process env still wins over the parsed file
for (const key of Object.keys(process.env)) {
  if (process.env[key] !== undefined && key !== "NODE_ENV") env[key] = process.env[key] as string;
}

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    testTimeout: 15000,
    hookTimeout: 15000,
    fileParallelism: false,
    env,
  },
});
