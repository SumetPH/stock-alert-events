type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

function writeLog(level: LogLevel, scope: string, message: string, meta?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const payload =
    meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";

  console.log(`[${timestamp}] [${level}] [${scope}] ${message}${payload}`);
}

export const logger = {
  info(scope: string, message: string, meta?: Record<string, unknown>): void {
    writeLog("INFO", scope, message, meta);
  },
  warn(scope: string, message: string, meta?: Record<string, unknown>): void {
    writeLog("WARN", scope, message, meta);
  },
  error(scope: string, message: string, meta?: Record<string, unknown>): void {
    writeLog("ERROR", scope, message, meta);
  },
  debug(scope: string, message: string, meta?: Record<string, unknown>): void {
    writeLog("DEBUG", scope, message, meta);
  }
};
