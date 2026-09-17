import path from "path";

export function sanitizePath(input: string): string {
  // Reject null bytes
  if (input.includes("\x00")) {
    throw new Error("Invalid path: null bytes");
  }
  // Normalize
  return path.posix.normalize(input);
}

export function validateWorkspacePath(workspaceRoot: string, requestedPath: string): string {
  const normalizedRoot = path.resolve(workspaceRoot);
  // Special case: "/" or empty means workspace root
  if (!requestedPath || requestedPath === "/" || requestedPath === ".") {
    return normalizedRoot;
  }
  const requested = sanitizePath(requestedPath);

  // Reject absolute traversal attempts
  if (requested.includes("..")) {
    // After normalization, check if still contains ..
    if (requested.split("/").includes("..")) {
      throw new Error("Path traversal not allowed");
    }
  }

  // Resolve requested path against root
  // If requested is absolute, treat as relative to root for safety unless explicitly allowed
  let resolved: string;
  if (path.isAbsolute(requested)) {
    // Only allow absolute if it's inside workspaceRoot
    resolved = path.resolve(requested);
  } else {
    resolved = path.resolve(normalizedRoot, requested);
  }

  // Ensure resolved is inside workspaceRoot
  const relative = path.relative(normalizedRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Access denied: path outside workspace (${requestedPath})`);
  }

  // Also block sensitive system paths even if somehow inside
  const sensitive = ["/etc", "/root", "/var", "/usr", "/proc", "/sys"];
  for (const s of sensitive) {
    if (resolved === s || resolved.startsWith(s + path.sep)) {
      // But if workspaceRoot itself is inside /tmp, allow; check if resolved is inside workspaceRoot first
      // Already checked, but double-guard
      if (!resolved.startsWith(normalizedRoot)) {
        throw new Error(`Access to sensitive path denied: ${s}`);
      }
    }
  }

  return resolved;
}

export function validateWorkspaceDirectory(workspaceRoot: string, cwd?: string): string {
  if (!cwd) return path.resolve(workspaceRoot);
  return validateWorkspacePath(workspaceRoot, cwd);
}
