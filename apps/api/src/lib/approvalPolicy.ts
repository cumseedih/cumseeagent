export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface PolicyRule {
  pattern: RegExp;
  risk: RiskLevel;
  requiresApproval: boolean;
  reason: string;
}

// Safe by default inside approved workspace
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

// Always require approval
export const RISKY_RULES: PolicyRule[] = [
  { pattern: /^rm(\s+.*)?$/, risk: "critical", requiresApproval: true, reason: "File deletion requires approval" },
  { pattern: /^rm\s+-rf.*/, risk: "critical", requiresApproval: true, reason: "Recursive deletion requires approval" },
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
  { pattern: /\/etc\//, risk: "critical", requiresApproval: true, reason: "Editing /etc requires approval" },
  { pattern: /\/root\//, risk: "critical", requiresApproval: true, reason: "Access to /root requires approval" },
  { pattern: /\/var\//, risk: "high", requiresApproval: true, reason: "Editing /var requires approval" },
  { pattern: /git\s+push/, risk: "high", requiresApproval: true, reason: "git push requires approval" },
  { pattern: /curl.*\|\s*sh/, risk: "critical", requiresApproval: true, reason: "Piped curl to shell requires approval" },
];

export function classifyRisk(command: string): { risk: RiskLevel; requiresApproval: boolean; reason?: string } {
  const cmd = command.trim();

  // Check risky first
  for (const rule of RISKY_RULES) {
    if (rule.pattern.test(cmd)) {
      return { risk: rule.risk, requiresApproval: rule.requiresApproval, reason: rule.reason };
    }
  }

  // Check safe patterns — but also check for chaining outside workspace
  // Detect command chaining that might bypass safe check
  if (/[;&|]{1,2}/.test(cmd) && !SAFE_PATTERNS.some((p) => p.test(cmd))) {
    return { risk: "high", requiresApproval: true, reason: "Command chaining requires approval" };
  }

  // If matches safe pattern, allow auto
  for (const p of SAFE_PATTERNS) {
    if (p.test(cmd)) {
      return { risk: "low", requiresApproval: false };
    }
  }

  // Default: medium, requires approval for unknown commands outside safe list
  // But if it's just file creation/editing inside workspace via tools, it's safe.
  // For terminal commands, unknown = medium
  return { risk: "medium", requiresApproval: true, reason: "Unknown command requires approval" };
}

export function isCommandAllowed(command: string, workspaceRoot: string, cwd?: string): { allowed: boolean; reason?: string } {
  // Check for null bytes
  if (command.includes("\x00")) {
    return { allowed: false, reason: "Null bytes not allowed" };
  }
  // Check for path traversal in command
  if (command.includes("..")) {
    // naive check — detailed path validation happens in validator
    // but flag for review
    // we don't block outright here, let pathValidator handle
  }
  // Check for writes outside workspace — handled by pathValidator
  return { allowed: true };
}
