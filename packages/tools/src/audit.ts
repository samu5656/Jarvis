import { AuditLogEntry } from './types';

const SENSITIVE_KEYS = ['password', 'secret', 'token', 'key', 'apikey', 'api_key', 'auth', 'cookie'];

export function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const isSensitive = SENSITIVE_KEYS.some((sensitive) =>
      key.toLowerCase().includes(sensitive)
    );

    if (isSensitive) {
      result[key] = '***REDACTED***';
    } else if (typeof value === 'object') {
      result[key] = sanitizeObject(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export class AuditLogger {
  private logs: AuditLogEntry[] = [];
  private readonly maxLogs: number;

  constructor(options: { maxLogs?: number } = {}) {
    this.maxLogs = options.maxLogs ?? 1000;
  }

  log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    const fullEntry: AuditLogEntry = {
      ...entry,
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      input: sanitizeObject(entry.input || {}),
      result: entry.result ? sanitizeObject(entry.result) : undefined,
      timestamp: new Date().toISOString(),
    };

    this.logs.unshift(fullEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    return fullEntry;
  }

  getLogs(filter?: { toolName?: string; status?: string; userId?: string }): AuditLogEntry[] {
    return this.logs.filter((log) => {
      if (filter?.toolName && log.toolName !== filter.toolName) return false;
      if (filter?.status && log.status !== filter.status) return false;
      if (filter?.userId && log.userId !== filter.userId) return false;
      return true;
    });
  }

  clear(): void {
    this.logs = [];
  }
}
