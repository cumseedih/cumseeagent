import { describe, it, expect } from "vitest";
import { validateWorkspacePath } from "../lib/pathValidator.js";

describe("Path traversal blocking", () => {
  const root = "/tmp/cumsee-workspaces/test-project";

  it("allows normal path inside workspace", () => {
    const p = validateWorkspacePath(root, "src/index.ts");
    expect(p).toBe("/tmp/cumsee-workspaces/test-project/src/index.ts");
  });

  it("allows root path", () => {
    const p = validateWorkspacePath(root, "/");
    expect(p).toBe(root);
  });

  it("blocks .. traversal", () => {
    expect(() => validateWorkspacePath(root, "../../etc/passwd")).toThrow(/Path traversal|Access denied/);
  });

  it("blocks absolute outside workspace", () => {
    expect(() => validateWorkspacePath(root, "/etc/passwd")).toThrow(/Access denied|outside workspace/);
  });

  it("blocks null bytes", () => {
    expect(() => validateWorkspacePath(root, "file\x00.txt")).toThrow(/null bytes/);
  });

  it("blocks nested traversal", () => {
    expect(() => validateWorkspacePath(root, "a/b/../../../../etc/shadow")).toThrow();
  });
});
