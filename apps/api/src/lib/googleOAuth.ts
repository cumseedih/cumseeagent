import crypto from "crypto";
import { config } from "./config.js";

const STATE_TTL_MS = 10 * 60 * 1000;

export function createGoogleState() {
  const issuedAt = Date.now().toString(36);
  const nonce = crypto.randomBytes(24).toString("base64url");
  const body = `${issuedAt}.${nonce}`;
  const signature = crypto.createHmac("sha256", config.encryptionKey).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyGoogleState(value?: string) {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const issuedAt = Number.parseInt(parts[0], 36);
  if (!Number.isFinite(issuedAt) || issuedAt > Date.now() + 60_000 || Date.now() - issuedAt > STATE_TTL_MS) return false;
  const body = `${parts[0]}.${parts[1]}`;
  const expected = crypto.createHmac("sha256", config.encryptionKey).update(body).digest("base64url");
  const suppliedBuffer = Buffer.from(parts[2]);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);
}

export function googleAuthorizationUrl(state: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.google.clientId);
  url.searchParams.set("redirect_uri", config.google.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
};

export async function exchangeGoogleCode(code: string): Promise<GoogleProfile> {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uri: config.google.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) throw new Error(`Google token exchange failed (${tokenResponse.status})`);
  const tokens = (await tokenResponse.json()) as { id_token?: string };
  if (!tokens.id_token) throw new Error("Google did not return an ID token");

  const profileResponse = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokens.id_token)}`
  );
  if (!profileResponse.ok) throw new Error("Google ID token verification failed");
  const profile = (await profileResponse.json()) as any;
  if (
    profile.aud !== config.google.clientId ||
    !["accounts.google.com", "https://accounts.google.com"].includes(profile.iss) ||
    ![true, "true"].includes(profile.email_verified) ||
    !profile.sub ||
    !profile.email
  ) {
    throw new Error("Google account identity is invalid or unverified");
  }
  return { sub: String(profile.sub), email: String(profile.email).trim().toLowerCase(), emailVerified: true };
}
