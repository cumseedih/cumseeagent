const isProduction = process.env.NODE_ENV === "production";
const canonicalProductionOrigin = "https://agentdelv.in";
const configuredPublicAppUrl = process.env.PUBLIC_APP_URL || (isProduction ? canonicalProductionOrigin : "http://localhost:3000");

function normalizeProductionUrl(value: string, fallback: string) {
  const url = new URL(value || fallback, configuredPublicAppUrl);
  if (isProduction && url.hostname === "delvin.agentdomains.co") {
    url.hostname = "agentdelv.in";
    url.protocol = "https:";
  }
  return url.toString();
}

const publicAppUrl = normalizeProductionUrl(configuredPublicAppUrl, canonicalProductionOrigin).replace(/\/$/, "");

export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  host: process.env.HOST || "0.0.0.0",
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl:
    process.env.DATABASE_URL ||
    "postgresql://delvin_app:change-me@127.0.0.1:5432/delvin?schema=public",
  jwtSecret: process.env.JWT_SECRET || "dev-jwt-secret-change-me",
  encryptionKey: process.env.ENCRYPTION_KEY || "dev-encryption-key-32-chars",
  workspaceRoot: process.env.WORKSPACE_ROOT || "/tmp/cumsee-workspaces",
  // Daily agent-run allowance shown as credits; 0 disables the gate
  dailyRunLimit: parseInt(process.env.DAILY_RUN_LIMIT || "40", 10),
  // Bump to force re-acceptance of the Terms of Use
  touVersion: process.env.TOU_VERSION || "1",
  agentUser: process.env.AGENT_USER || "agent",
  publicAppUrl,
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    redirectUri: normalizeProductionUrl(
      process.env.GOOGLE_REDIRECT_URI ||
        (isProduction ? "/api/auth/google/callback" : "http://localhost:4000/api/auth/google/callback"),
      isProduction ? "/api/auth/google/callback" : "http://localhost:4000/api/auth/google/callback"
    ),
    workspaceRedirectUri: normalizeProductionUrl(
      process.env.GOOGLE_WORKSPACE_REDIRECT_URI ||
        (isProduction ? "/api/integrations/google/callback" : "http://localhost:4000/api/integrations/google/callback"),
      isProduction ? "/api/integrations/google/callback" : "http://localhost:4000/api/integrations/google/callback"
    ),
  },
  mail: {
    host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: (process.env.SMTP_SECURE || "false") === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || process.env.SMTP_USER || "",
    codeTtlMinutes: parseInt(process.env.EMAIL_CODE_TTL_MINUTES || "10", 10),
  },
  github: {
    appId: process.env.GITHUB_APP_ID || "",
    appSlug: process.env.GITHUB_APP_SLUG || "delvin-agent",
    privateKeyPath: process.env.GITHUB_PRIVATE_KEY_PATH || "",
    privateKeyBase64: process.env.GITHUB_PRIVATE_KEY_BASE64 || "",
  },
  branding: {
    productName: process.env.PRODUCT_NAME || "Delvin",
    productDomain: process.env.PRODUCT_DOMAIN && process.env.PRODUCT_DOMAIN !== "delvin.local" ? process.env.PRODUCT_DOMAIN : "agentdelv.in",
    logoPath: process.env.LOGO_PATH || "/assets/delvin-avatar.jpg",
    faviconPath: process.env.FAVICON_PATH || "/assets/delvin-avatar.jpg",
    primaryColor: process.env.PRIMARY_COLOR || "#2e2b29",
    accentColor: process.env.ACCENT_COLOR || "#ffc800",
  },
  providers: {
    omniroute: {
      baseUrl: process.env.OMNIROUTE_BASE_URL || "http://127.0.0.1:20128/v1",
      apiKey: process.env.OMNIROUTE_API_KEY || "",
    },
    devin: {
      apiKey: process.env.DEVIN_API_KEY || "",
      baseUrl: process.env.DEVIN_BASE_URL || "https://api.devin.ai/v1",
    },
    opencode: {
      baseUrl: process.env.OPENCODE_BASE_URL || "https://opencode.ai/zen/v1",
      apiKey: process.env.OPENCODE_API_KEY || "",
    },
    openai: {
      baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      apiKey: process.env.OPENAI_API_KEY || "",
    },
  },
  agent: {
    defaultProvider: process.env.DEFAULT_AGENT_PROVIDER || "omniroute",
    defaultModel: process.env.DEFAULT_AGENT_MODEL || "devin",
  },
} as const;
