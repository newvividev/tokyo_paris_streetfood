type LogLevel = 'info' | 'warn' | 'error';

type LogContext = Record<string, unknown>;

const normalizeContext = (context?: LogContext) => {
  if (!context) return undefined;

  const entries = Object.entries(context).filter(([, value]) => typeof value !== 'undefined');
  if (entries.length === 0) return undefined;

  return Object.fromEntries(entries);
};

const writeLog = (level: LogLevel, event: string, context?: LogContext) => {
  const payload = normalizeContext(context);
  const prefix = `[ops:${level}] ${event}`;

  if (level === 'error') {
    if (payload) {
      console.error(prefix, payload);
    } else {
      console.error(prefix);
    }
    return;
  }

  if (level === 'warn') {
    if (payload) {
      console.warn(prefix, payload);
    } else {
      console.warn(prefix);
    }
    return;
  }

  if (payload) {
    console.info(prefix, payload);
  } else {
    console.info(prefix);
  }
};

export const logInfo = (event: string, context?: LogContext) => writeLog('info', event, context);

export const logWarn = (event: string, context?: LogContext) => writeLog('warn', event, context);

export const logError = (event: string, context?: LogContext) => writeLog('error', event, context);
