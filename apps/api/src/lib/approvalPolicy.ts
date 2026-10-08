export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface PolicyRule {
  pattern: RegExp;
  risk: RiskLevel;
  requiresApproval: boolean;
  reason: string;
}

// Auto-approved commands are read-only/basic operations. Arguments are checked
// separately so a safe command name cannot make shell metacharacters or paths
// outside the current project safe.
export const SAFE_PATTERNS: RegExp[] = [
  /^pwd$/,
  /^ls(\s+.*)?$/,
  /^find(\s+.*)?$/,
  /^tree(\s+.*)?$/,
  /^cat(\s+.*)?$/,
  /^head(\s+.*)?$/,
  /^tail(\s+.*)?$/,
  /^grep(\s+.*)?$/,
  /^rg(\s+.*)?$/,
  /^file(\s+.*)?$/,
  /^wc(\s+.*)?$/,
  /^stat(\s+.*)?$/,
  /^diff(\s+.*)?$/,
  /^echo(\s+.*)?$/,
  /^sleep(\s+[\d.]+)?$/,
  /^git\s+status.*$/,
  /^git\s+diff.*$/,
  /^git\s+log.*$/,
  /^git\s+branch.*$/,
  /^npm\s+test.*$/,
  /^npm\s+run\s+lint.*$/,
  /^npm\s+run\s+build$/,
  /^pnpm\s+test.*$/,
  /^yarn\s+test.*$/,
  /^python\s+-m\s+pytest.*$/,
];

// Always require approval for operations with elevated impact.
export const RISKY_RULES: PolicyRule[] = [
  { pattern: /^rm(\s+.*)?$/, risk: "critical", requiresApproval: true, reason: "File deletion requires approval" },
  { pattern: /sudo/, risk: "critical", requiresApproval: true, reason: "sudo requires approval" },
  { pattern: /\bsu\b/, risk: "critical", requiresApproval: true, reason: "su requires approval" },
  { pattern: /chmod/, risk: "high", requiresApproval: true, reason: "chmod on sensitive paths requires approval" },
  { pattern: /chown/, risk: "high", requiresApproval: true, reason: "chown requires approval" },
  { pattern: /systemctl/, risk: "critical", requiresApproval: true, reason: "systemctl requires approval" },
  { pattern: /\bservice\b/, risk: "critical", requiresApproval: true, reason: "service command requires approval" },
  { pattern: /apt(-get)?/, risk: "high", requiresApproval: true, reason: "Package installation requires approval" },
  { pattern: /npm\s+(install|i)\b/, risk: "high", requiresApproval: true, reason: "npm install requires approval" },
  { pattern: /pnpm\s+(install|add)\b/, risk: "high", requiresApproval: true, reason: "pnpm install requires approval" },
  { pattern: /yarn\s+add\b/, risk: "high", requiresApproval: true, reason: "yarn add requires approval" },
  { pattern: /pip\s+install/, risk: "high", requiresApproval: true, reason: "pip install requires approval" },
  { pattern: /docker/, risk: "critical", requiresApproval: true, reason: "Docker host operation requires approval" },
  { pattern: /git\s+branch\s+-(?:d|D)\b|git\s+branch\s+--delete\b/, risk: "high", requiresApproval: true, reason: "Deleting a Git branch requires approval" },
  { pattern: /\/(?:etc|root|var|proc|sys)\//, risk: "critical", requiresApproval: true, reason: "Access to a sensitive system path requires approval" },
  { pattern: /git\s+push/, risk: "high", requiresApproval: true, reason: "git push requires approval" },
  { pattern: /curl.*\|\s*sh/, risk: "critical", requiresApproval: true, reason: "Piped curl to shell requires approval" },
];

const UNSAFE_SHELL_SYNTAX = /[;&|`$()<>\\"'\r\n]/;
const PARENT_PATH = /(?:^|[\/\s])\.\.(?:[\/\s]|$)/;
const ABSOLUTE_OR_HOME_PATH = /(?:^|\s)(?:\/|~\/)/;
const SENSITIVE_FILE = /(?:^|[\/\s])(?:\.env(?:\.[\w-]+)?|\.ssh(?:[\/\s]|$)|\.(?:aws|kube|docker|azure)(?:[\/\s]|$)|\.config\/gcloud(?:[\/\s]|$)|\.npmrc|\.netrc|\.pypirc|\.git\/config|[^/\s]+\.(?:pem|key|p12|pfx))(?:$|[\/\s])/i;

function safeForAutomaticExecution(command: string): boolean {
  const cmd = command.trim();
  if (!cmd || UNSAFE_SHELL_SYNTAX.test(cmd) || PARENT_PATH.test(cmd) || ABSOLUTE_OR_HOME_PATH.test(cmd) || SENSITIVE_FILE.test(cmd)) return false;
  return SAFE_PATTERNS.some((pattern) => pattern.test(cmd));
}

export function classifyRisk(command: string): { risk: RiskLevel; requiresApproval: boolean; reason?: string } {
  const cmd = command.trim();

  for (const rule of RISKY_RULES) {
    if (rule.pattern.test(cmd)) {
      return { risk: rule.risk, requiresApproval: rule.requiresApproval, reason: rule.reason };
    }
  }

  // Only a chain of independently safe commands joined with && can auto-run.
  // Other operators and unsafe segments require explicit review.
  if (cmd.includes("&&") || /[;|]/.test(cmd)) {
    const segments = cmd.split("&&");
    if (segments.length > 1 && !/[;|]/.test(cmd) && segments.every(safeForAutomaticExecution)) {
      return { risk: "low", requiresApproval: false };
    }
    return { risk: "high", requiresApproval: true, reason: "Command chaining or shell operators require approval" };
  }

  if (safeForAutomaticExecution(cmd)) return { risk: "low", requiresApproval: false };

  if (PARENT_PATH.test(cmd) || ABSOLUTE_OR_HOME_PATH.test(cmd) || SENSITIVE_FILE.test(cmd)) {
    return { risk: "high", requiresApproval: true, reason: "Parent traversal, absolute paths, and sensitive files require approval" };
  }
  if (UNSAFE_SHELL_SYNTAX.test(cmd)) {
    return { risk: "high", requiresApproval: true, reason: "Shell expansion and quoting require approval" };
  }

  return { risk: "medium", requiresApproval: true, reason: "Unknown command requires approval" };
}

export function isCommandAllowed(command: string, workspaceRoot: string, cwd?: string): { allowed: boolean; reason?: string } {
  // The runner separately validates cwd against the workspace. Null bytes and
  // parent traversal are rejected here instead of relying on shell parsing.
  if (command.includes("\x00")) return { allowed: false, reason: "Null bytes not allowed" };
  if (PARENT_PATH.test(command)) return { allowed: false, reason: "Parent traversal not allowed" };
  void workspaceRoot;
  void cwd;
  return { allowed: true };
}
