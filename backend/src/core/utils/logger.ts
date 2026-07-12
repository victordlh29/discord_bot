type LogLevel = "info" | "warn" | "error" | "debug";

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function timestamp(): string {
  return new Date().toISOString();
}

function colorize(level: LogLevel): string {
  switch (level) {
    case "info": return colors.green;
    case "warn": return colors.yellow;
    case "error": return colors.red;
    case "debug": return colors.cyan;
    default: return colors.reset;
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    // Fallback if JSON.stringify throws (e.g. circular refs)
    return `[unserializable: ${String(value)}]`;
  }
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const prefix = `${colors.magenta}[${timestamp()}]${colors.reset}`;
  const levelStr = `${colorize(level)}[${level.toUpperCase()}]${colors.reset}`;
  const metaStr = meta ? ` ${safeStringify(meta)}` : "";
  console.log(`${prefix} ${levelStr} ${message}${metaStr}`);
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => log("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log("error", message, meta),
  debug: (message: string, meta?: Record<string, unknown>) => log("debug", message, meta),
};
