import crypto from "crypto";
import fs from "fs/promises";
import jwt from "jsonwebtoken";
import { config } from "./config.js";

const GITHUB_API = "https://api.github.com";

export type GitHubRepository = {
  id: string;
  name: string;
  fullName: string;
  private: boolean;
  htmlUrl: string;
  cloneUrl: string;
  defaultBranch: string;
  owner: string;
};

async function privateKey() {
  if (config.github.privateKeyBase64) return Buffer.from(config.github.privateKeyBase64, "base64").toString("utf8");
  if (config.github.privateKeyPath) return fs.readFile(config.github.privateKeyPath, "utf8");
  throw new Error("GitHub App private key is not configured");
}

export async function githubAppJwt() {
  if (!config.github.appId) throw new Error("GitHub App ID is not configured");
  return jwt.sign({}, await privateKey(), {
    algorithm: "RS256",
    issuer: config.github.appId,
    expiresIn: "9m",
  });
}

async function githubFetch(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub API ${response.status}: ${detail.slice(0, 300)}`);
  }
  return response;
}

export async function getInstallation(installationId: string) {
  const response = await githubFetch(`/app/installations/${encodeURIComponent(installationId)}`, await githubAppJwt());
  const data: any = await response.json();
  return { id: String(data.id), accountLogin: String(data.account?.login || "github"), accountType: String(data.account?.type || "User") };
}

export async function installationToken(installationId: string) {
  const response = await githubFetch(`/app/installations/${encodeURIComponent(installationId)}/access_tokens`, await githubAppJwt(), { method: "POST" });
  const data: any = await response.json();
  if (!data.token) throw new Error("GitHub did not return an installation token");
  return String(data.token);
}

export async function installationRepositories(installationId: string): Promise<GitHubRepository[]> {
  const response = await githubFetch("/installation/repositories?per_page=100", await installationToken(installationId));
  const data: any = await response.json();
  return (data.repositories || []).map((repo: any) => ({
    id: String(repo.id),
    name: String(repo.name),
    fullName: String(repo.full_name),
    private: Boolean(repo.private),
    htmlUrl: String(repo.html_url),
    cloneUrl: String(repo.clone_url),
    defaultBranch: String(repo.default_branch || "main"),
    owner: String(repo.owner?.login || ""),
  }));
}

export function gitAuthEnvironment(token: string) {
  const basic = Buffer.from(`x-access-token:${token}`).toString("base64");
  return {
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader",
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${basic}`,
    GIT_TERMINAL_PROMPT: "0",
  };
}

export function createGitHubState(userId: string) {
  const nonce = crypto.randomBytes(24).toString("base64url");
  const body = `${userId}.${nonce}`;
  const signature = crypto.createHmac("sha256", config.encryptionKey).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyGitHubState(value?: string) {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const body = `${parts[0]}.${parts[1]}`;
  const expected = crypto.createHmac("sha256", config.encryptionKey).update(body).digest("base64url");
  const supplied = Buffer.from(parts[2]);
  const expectedBuffer = Buffer.from(expected);
  if (supplied.length !== expectedBuffer.length || !crypto.timingSafeEqual(supplied, expectedBuffer)) return null;
  return parts[0];
}
