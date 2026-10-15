import path from 'path';

export interface ApprovedPathEntry {
  alias: string;
  absolutePath: string;
}

export class PathAllowlist {
  private approvedDirectories: Map<string, string> = new Map();

  constructor(initialPaths?: Record<string, string>) {
    if (initialPaths) {
      for (const [alias, dirPath] of Object.entries(initialPaths)) {
        this.addApprovedPath(alias, dirPath);
      }
    }
  }

  addApprovedPath(alias: string, dirPath: string): void {
    const resolved = path.resolve(dirPath);
    this.approvedDirectories.set(alias.toLowerCase(), resolved);
  }

  resolveAndVerify(target: string): { approved: boolean; resolvedPath?: string; error?: string } {
    const normalizedTarget = target.trim();
    if (!normalizedTarget) {
      return { approved: false, error: 'Target path cannot be empty' };
    }

    // Check if target is a known alias (e.g., "FlowForge" or "approved:FlowForge")
    const cleanAlias = normalizedTarget.replace(/^approved:/i, '').toLowerCase();
    if (this.approvedDirectories.has(cleanAlias)) {
      return { approved: true, resolvedPath: this.approvedDirectories.get(cleanAlias) };
    }

    // Resolve as filesystem path
    const resolvedTarget = path.resolve(normalizedTarget);

    // Check if resolvedTarget is inside any approved directory
    for (const [_alias, approvedDir] of this.approvedDirectories.entries()) {
      const relative = path.relative(approvedDir, resolvedTarget);
      const isInside = !relative.startsWith('..') && !path.isAbsolute(relative);
      const isExact = resolvedTarget.toLowerCase() === approvedDir.toLowerCase();

      if (isExact || isInside) {
        return { approved: true, resolvedPath: resolvedTarget };
      }
    }

    return {
      approved: false,
      error: `Path "${target}" is outside the approved directory scopes. Access denied.`,
    };
  }

  getApprovedList(): ApprovedPathEntry[] {
    return Array.from(this.approvedDirectories.entries()).map(([alias, absolutePath]) => ({
      alias,
      absolutePath,
    }));
  }
}

export class UrlPolicy {
  private allowedProtocols = new Set(['http:', 'https:']);

  verify(rawUrl: string): { approved: boolean; url?: string; error?: string } {
    try {
      const parsed = new URL(rawUrl);
      if (!this.allowedProtocols.has(parsed.protocol.toLowerCase())) {
        return {
          approved: false,
          error: `Protocol "${parsed.protocol}" is not allowed. Only HTTP and HTTPS are permitted.`,
        };
      }
      return { approved: true, url: parsed.toString() };
    } catch {
      return { approved: false, error: `Invalid URL format: "${rawUrl}"` };
    }
  }
}
