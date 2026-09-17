import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs/promises";
import { config } from "./config.js";
import { validateWorkspaceDirectory } from "./pathValidator.js";
import { classifyRisk } from "./approvalPolicy.js";

export interface RunOptions {
  command: string;
  cwd?: string;
  workspaceRoot: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
  env?: Record<string, string>;
  approvalGranted?: boolean;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  truncated: boolean;
}

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_MAX_OUTPUT = 1_000_000;

function redactSecrets(input: string): string {
  return input
    .replace(/sk-[a-zA-Z0-9_\-]{20,}/g, "sk-***REDACTED***")
    .replace(/ghp_[a-zA-Z0-9]{36}/g, "ghp-***REDACTED***")
    .replace(/Bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi, "Bearer ***REDACTED***")
    .replace(/password\s*[:=]\s*\S+/gi, "password=***REDACTED***")
    .replace(/api[_-]?key\s*[:=]\s*\S+/gi, "api_key=***REDACTED***")
    .replace(/token\s*[:=]\s*\S+/gi, "token=***REDACTED***");
}

export class TerminalRunner {
  private runningProcesses = new Map<string, ChildProcess>();
  private concurrentCount = 0;
  private maxConcurrent = 10;
  private perSessionCount = new Map<string, number>();
  private maxPerSession = 2;

  async run(options: RunOptions & { sessionId?: string }): Promise<RunResult> {
    const {
      command,
      cwd,
      workspaceRoot,
      timeoutMs = DEFAULT_TIMEOUT,
      maxOutputBytes = DEFAULT_MAX_OUTPUT,
      sessionId,
    } = options;

    // Validate workspace
    const validatedCwd = validateWorkspaceDirectory(workspaceRoot, cwd);
    await fs.mkdir(validatedCwd, { recursive: true });

    // Classify risk
    const classification = classifyRisk(command);
    if (classification.requiresApproval && !options.approvalGranted) {
      throw new Error(`Command requires approval: ${classification.reason}`);
    }

    // Concurrency checks
    if (this.concurrentCount >= this.maxConcurrent) {
      throw new Error("Too many concurrent commands");
    }
    if (sessionId) {
      const count = this.perSessionCount.get(sessionId) || 0;
      if (count >= this.maxPerSession) {
        throw new Error("Too many concurrent commands for this session");
      }
      this.perSessionCount.set(sessionId, count + 1);
    }

    this.concurrentCount++;

    return new Promise(async (resolve, reject) => {
      // Use shell:false and split command safely?
      // For simplicity, we use shell with restricted env but validate injection above
      // Better to use bash -c with sanitized command; we already classified
      const sanitizedEnv: Record<string, string> = {
        HOME: workspaceRoot,
        PATH: "/usr/bin:/bin:/usr/local/bin",
        LANG: "C.UTF-8",
        NODE_ENV: config.nodeEnv,
        // strip secrets
        ...(options.env || {}),
      };

      // Remove dangerous env
      delete (sanitizedEnv as any).LD_PRELOAD;
      delete (sanitizedEnv as any).LD_LIBRARY_PATH;

      const child = spawn("bash", ["-c", command], {
        cwd: validatedCwd,
        env: sanitizedEnv,
        detached: true,
      });

      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      this.runningProcesses.set(id, child);

      let stdout = "";
      let stderr = "";
      let truncated = false;
      let timedOut = false;

      const append = (target: string, chunk: string, setter: (v: string) => void) => {
        const redacted = redactSecrets(chunk);
        const next = target + redacted;
        if (next.length > maxOutputBytes) {
          truncated = true;
          setter(next.slice(0, maxOutputBytes) + "\n... truncated (output limit reached)");
        } else {
          setter(next);
        }
      };

      child.stdout?.on("data", (d: Buffer) => {
        append(stdout, d.toString(), (v) => (stdout = v));
      });
      child.stderr?.on("data", (d: Buffer) => {
        append(stderr, d.toString(), (v) => (stderr = v));
      });

      const timeout = setTimeout(() => {
        timedOut = true;
        try {
          // Kill process group
          if (child.pid) process.kill(-child.pid, "SIGTERM");
        } catch {}
        setTimeout(() => {
          try {
            if (child.pid) process.kill(-child.pid, "SIGKILL");
          } catch {}
        }, 5000);
      }, timeoutMs);

      child.on("error", (err) => {
        clearTimeout(timeout);
        this.runningProcesses.delete(id);
        this.concurrentCount--;
        if (sessionId) {
          const c = this.perSessionCount.get(sessionId) || 1;
          this.perSessionCount.set(sessionId, Math.max(0, c - 1));
        }
        reject(err);
      });

      child.on("close", (code) => {
        clearTimeout(timeout);
        this.runningProcesses.delete(id);
        this.concurrentCount--;
        if (sessionId) {
          const c = this.perSessionCount.get(sessionId) || 1;
          this.perSessionCount.set(sessionId, Math.max(0, c - 1));
        }
        resolve({
          stdout: redactSecrets(stdout),
          stderr: redactSecrets(stderr),
          exitCode: timedOut ? 124 : code,
          timedOut,
          truncated,
        });
      });
    });
  }

  // Streaming version for SSE
  async runStreaming(
    options: RunOptions & { sessionId?: string; onStdout?: (chunk: string) => void; onStderr?: (chunk: string) => void }
  ): Promise<RunResult> {
    const { command, cwd, workspaceRoot, timeoutMs = DEFAULT_TIMEOUT, maxOutputBytes = DEFAULT_MAX_OUTPUT, sessionId, onStdout, onStderr } = options;
    const validatedCwd = validateWorkspaceDirectory(workspaceRoot, cwd);
    await fs.mkdir(validatedCwd, { recursive: true });

    const classification = classifyRisk(command);
    if (classification.requiresApproval && !options.approvalGranted) {
      throw new Error(`Command requires approval: ${classification.reason}`);
    }

    const sanitizedEnv: Record<string, string> = {
      HOME: workspaceRoot,
      PATH: "/usr/bin:/bin:/usr/local/bin",
      LANG: "C.UTF-8",
      NODE_ENV: config.nodeEnv,
      ...(options.env || {}),
    };

    return new Promise(async (resolve) => {
      const child = spawn("bash", ["-c", command], {
        cwd: validatedCwd,
        env: sanitizedEnv,
        detached: true,
      });

      let stdout = "";
      let stderr = "";
      let truncated = false;
      let timedOut = false;

      const handleChunk = (chunk: string, isStdout: boolean) => {
        const redacted = redactSecrets(chunk);
        if (isStdout) {
          if (stdout.length + redacted.length > maxOutputBytes) {
            truncated = true;
          } else {
            stdout += redacted;
            onStdout?.(redacted);
          }
        } else {
          if (stderr.length + redacted.length > maxOutputBytes) {
            truncated = true;
          } else {
            stderr += redacted;
            onStderr?.(redacted);
          }
        }
      };

      child.stdout?.on("data", (d: Buffer) => handleChunk(d.toString(), true));
      child.stderr?.on("data", (d: Buffer) => handleChunk(d.toString(), false));

      const timeout = setTimeout(() => {
        timedOut = true;
        try {
          if (child.pid) process.kill(-child.pid, "SIGTERM");
        } catch {}
      }, timeoutMs);

      child.on("close", (code) => {
        clearTimeout(timeout);
        resolve({
          stdout: redactSecrets(stdout),
          stderr: redactSecrets(stderr),
          exitCode: timedOut ? 124 : code,
          timedOut,
          truncated,
        });
      });

      child.on("error", (err) => {
        clearTimeout(timeout);
        resolve({
          stdout,
          stderr: err.message,
          exitCode: 1,
          timedOut: false,
          truncated: false,
        });
      });
    });
  }

  killAll() {
    for (const child of this.runningProcesses.values()) {
      try {
        if (child.pid) process.kill(-child.pid, "SIGKILL");
      } catch {}
    }
    this.runningProcesses.clear();
  }
}

export const terminalRunner = new TerminalRunner();
