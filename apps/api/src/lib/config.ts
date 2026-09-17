export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  host: process.env.HOST || "0.0.0.0",
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "file:./dev.db",
  jwtSecret: process.env.JWT_SECRET || "dev-jwt-secret-change-me",
  encryptionKey: process.env.ENCRYPTION_KEY || "dev-encryption-key-32-chars",
  workspaceRoot: process.env.WORKSPACE_ROOT || "/tmp/cumsee-workspaces",
  agentUser: process.env.AGENT_USER || "agent",
  branding: {
    productName: process.env.PRODUCT_NAME || "My Agent",
    productDomain: process.env.PRODUCT_DOMAIN || "localhost",
    logoPath: process.env.LOGO_PATH || "/assets/logo.svg",
    faviconPath: process.env.FAVICON_PATH || "/assets/favicon.ico",
    primaryColor: process.env.PRIMARY_COLOR || "#0ea5e9",
    accentColor: process.env.ACCENT_COLOR || "#06b6d4",
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
} as const;
