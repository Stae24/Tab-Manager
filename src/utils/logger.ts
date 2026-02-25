type LogLevel = 'debug' | 'info' | 'warn' | 'error';

let debugModeEnabled = false;

export const setDebugMode = (enabled: boolean) => {
  debugModeEnabled = enabled;
};

const formatMessage = (level: LogLevel, context: string, ...args: unknown[]): void => {
  const timestamp = new Date().toISOString();
  const levelPrefix = level.toUpperCase().padEnd(5);
  const prefix = `[${timestamp}] [${levelPrefix}] [${context}]`;

  switch (level) {
    case 'debug':
      if (debugModeEnabled) console.debug(prefix, ...args);
      break;
    case 'info':
      if (debugModeEnabled) console.info(prefix, ...args);
      break;
    case 'warn':
      console.warn(prefix, ...args);
      break;
    case 'error':
      console.error(prefix, ...args);
      break;
  }
};

export const logger = {
  debug: (context: string, ...args: unknown[]) => formatMessage('debug', context, ...args),
  info: (context: string, ...args: unknown[]) => formatMessage('info', context, ...args),
  warn: (context: string, ...args: unknown[]) => formatMessage('warn', context, ...args),
  error: (context: string, ...args: unknown[]) => formatMessage('error', context, ...args),
};
