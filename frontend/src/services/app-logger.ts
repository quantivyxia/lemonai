type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const configuredLevel = ((import.meta.env.VITE_LOG_LEVEL as string | undefined)?.toLowerCase() as LogLevel | undefined) ?? 'info'

const canLog = (level: LogLevel) => levelOrder[level] >= levelOrder[configuredLevel]

const writeLog = (level: LogLevel, message: string, metadata?: Record<string, unknown>) => {
  if (!canLog(level)) return
  const payload = metadata ? { ...metadata } : undefined
  const args = payload ? [message, payload] : [message]
  if (level === 'debug') console.debug(...args)
  if (level === 'info') console.info(...args)
  if (level === 'warn') console.warn(...args)
  if (level === 'error') console.error(...args)
}

export const appLogger = {
  debug: (message: string, metadata?: Record<string, unknown>) => writeLog('debug', message, metadata),
  info: (message: string, metadata?: Record<string, unknown>) => writeLog('info', message, metadata),
  warn: (message: string, metadata?: Record<string, unknown>) => writeLog('warn', message, metadata),
  error: (message: string, metadata?: Record<string, unknown>) => writeLog('error', message, metadata),
}
