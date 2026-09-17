import { buildApp } from "./app.js";
import { config } from "./lib/config.js";
import { prisma } from "./lib/prisma.js";
import fs from "fs/promises";

async function ensureWorkspaceRoot() {
  try {
    await fs.mkdir(config.workspaceRoot, { recursive: true });
    console.log(`Workspace root ready: ${config.workspaceRoot}`);
  } catch (e) {
    console.error("Failed to create workspace root:", e);
  }
}

async function main() {
  await ensureWorkspaceRoot();

  // Test DB
  try {
    await prisma.$connect();
    console.log("Database connected:", config.databaseUrl.replace(/:\/\/.*@/, "://***@"));
  } catch (e) {
    console.error("Database connection failed:", e);
    process.exit(1);
  }

  const app = await buildApp();

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  signals.forEach((sig) => {
    process.on(sig, async () => {
      console.log(`Received ${sig}, shutting down gracefully...`);
      await app.close();
      await prisma.$disconnect();
      process.exit(0);
    });
  });

  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`🚀 ${config.branding.productName} API listening on http://${config.host}:${config.port}`);
    console.log(`   Health: http://localhost:${config.port}/api/health`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
