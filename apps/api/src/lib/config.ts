export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  host: process.env.HOST || "0.0.0.0",
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "file:./dev.db",
  jwtSecret: process.env.JWT_SECRET || "dev-jwt-secret-change-me",
  encryptionKey: process.env.ENCRYPTION_KEY || "dev-encryption-key-32-chars",
  workspaceRoot: process.env.WORKSPACE_ROOT || "/tmp/cumsee-workspaces",
  // Daily agent-run allowance shown as credits; 0 disables the gate
  dailyRunLimit: parseInt(process.env.DAILY_RUN_LIMIT || "40", 10),
  // Bump to force re-acceptance of the Terms of Use
  touVersion: process.env.TOU_VERSION || "1",
  agentUser: process.env.AGENT_USER || "agent",
  branding: {
    productName: process.env.PRODUCT_NAME || "Delvin",
    productDomain: process.env.PRODUCT_DOMAIN || "delvin.local",
    logoPath: process.env.LOGO_PATH || "/assets/delvin-logo.jpg",
    faviconPath: process.env.FAVICON_PATH || "/assets/delvin-logo.jpg",
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
} as const;
