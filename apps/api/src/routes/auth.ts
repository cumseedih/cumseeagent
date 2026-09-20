import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword, signToken, verifyToken } from "../lib/auth.js";
import { config } from "../lib/config.js";
import { createGoogleState, exchangeGoogleCode, googleAuthorizationUrl, verifyGoogleState } from "../lib/googleOAuth.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(100),
  username: z.string().min(2).max(50).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const sessionCookie = () => ({
  httpOnly: true,
  secure: config.nodeEnv === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
});

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/register
  app.post("/register", async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });

    const { email, password, username } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return reply.code(409).send({ error: "Email already registered" });

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, username, passwordHash },
      select: { id: true, email: true, username: true, createdAt: true },
    });

    const token = signToken({ userId: user.id, email: user.email });
    reply.setCookie("token", token, sessionCookie());

    await prisma.auditLog.create({
      data: { userId: user.id, action: "auth.register", ipAddress: req.ip, metadataJson: JSON.stringify({ email }) },
    });

    return reply.code(201).send({ user, token });
  });

  // POST /api/auth/login
  app.post("/login", async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) return reply.code(401).send({ error: "Invalid credentials" });

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return reply.code(401).send({ error: "Invalid credentials" });

    const token = signToken({ userId: user.id, email: user.email });
    reply.setCookie("token", token, sessionCookie());

    await prisma.auditLog.create({
      data: { userId: user.id, action: "auth.login", ipAddress: req.ip },
    });

    return { user: { id: user.id, email: user.email, username: user.username, createdAt: user.createdAt }, token };
  });

  // POST /api/auth/logout
  app.post("/logout", async (req, reply) => {
    reply.clearCookie("token", { path: "/" });
    return { message: "Logged out" };
  });

  // GET /api/auth/me
  app.get("/me", async (req, reply) => {
    const token = (req.cookies as any)?.token || req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      // For dev, return anonymous or 401? We'll allow 401 but also provide helpful
      return reply.code(401).send({ error: "Not authenticated" });
    }
    try {
      const payload = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, email: true, username: true, createdAt: true },
      });
      if (!user) return reply.code(401).send({ error: "User not found" });
      return { user };
    } catch (e) {
      return reply.code(401).send({ error: "Invalid token" });
    }
  });

  app.get("/google", async (_req, reply) => {
    if (!config.google.clientId || !config.google.clientSecret) {
      return reply.code(503).send({ error: "Google sign-in is not configured" });
    }
    const state = createGoogleState();
    reply.setCookie("delvin_google_state", state, {
      httpOnly: true,
      secure: config.nodeEnv === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });
    return reply.redirect(googleAuthorizationUrl(state));
  });

  app.get("/google/callback", async (req, reply) => {
    const query = req.query as { code?: string; state?: string; error?: string };
    const cookieState = (req.cookies as any)?.delvin_google_state as string | undefined;
    const redirectWithError = (message: string) =>
      reply.redirect(`${config.publicAppUrl}/?auth_error=${encodeURIComponent(message)}`);

    if (query.error) return redirectWithError("Google sign-in was cancelled");
    if (!query.code || !query.state || query.state !== cookieState || !verifyGoogleState(query.state)) {
      return redirectWithError("Google sign-in expired. Please try again.");
    }

    try {
      const profile = await exchangeGoogleCode(query.code);
      const existingIdentity = await prisma.authIdentity.findUnique({
        where: { provider_providerSubject: { provider: "google", providerSubject: profile.sub } },
        include: { user: true },
      });

      let user = existingIdentity?.user;
      if (!user) {
        user = await prisma.$transaction(async (tx) => {
          const account =
            (await tx.user.findUnique({ where: { email: profile.email } })) ??
            (await tx.user.create({ data: { email: profile.email } }));
          await tx.authIdentity.create({
            data: { userId: account.id, provider: "google", providerSubject: profile.sub },
          });
          return account;
        });
      }

      const token = signToken({ userId: user.id, email: user.email });
      reply.setCookie("token", token, sessionCookie());
      reply.clearCookie("delvin_google_state", { path: "/" });
      await prisma.auditLog.create({
        data: { userId: user.id, action: "auth.google", ipAddress: req.ip },
      });
      return reply.redirect(`${config.publicAppUrl}/?auth=success`);
    } catch (error: any) {
      req.log.error(error, "Google OAuth callback failed");
      return redirectWithError("Google sign-in could not be completed");
    }
  });
}

// Identity used by the no-token dev fallback below.
const DEV_EMAIL = "dev@localhost";
const DEV_USERNAME = "dev";

// Helper to get userId from request (auth-ready: if no token, create/find default dev user)
export async function getUserId(req: any): Promise<string> {
  const queryToken = (req.query as any)?.token;
  const headerToken = req.headers.authorization?.replace("Bearer ", "");
  const cookieToken = req.cookies?.token;
  const token = queryToken || cookieToken || headerToken;
  if (token) {
    try {
      const payload = verifyToken(token);
      return payload.userId;
    } catch {}
  }
  if (config.nodeEnv === "production") {
    const error: any = new Error("Authentication required");
    error.statusCode = 401;
    throw error;
  }
  // Fallback: get or create default user for dev.
  //
  // The page fires several requests in parallel on first load, so more than one
  // of them can reach this point with no user row in the database. A plain
  // find-then-create then loses the race: the losers die on the unique
  // constraint for `username` and the request 500s. Re-read on conflict.
  let user = await prisma.user.findFirst({ where: { email: DEV_EMAIL } });
  if (!user) {
    try {
      user = await prisma.user.create({
        data: { email: DEV_EMAIL, username: DEV_USERNAME, passwordHash: await hashPassword("dev123456") },
      });
    } catch (err: any) {
      if (err?.code !== "P2002") throw err;
      // Another request won the race (or `username` is held by a different row).
      user =
        (await prisma.user.findFirst({ where: { email: DEV_EMAIL } })) ??
        (await prisma.user.findFirst({ where: { username: DEV_USERNAME } }));
      if (!user) throw err;
    }
  }
  return user.id;
}
