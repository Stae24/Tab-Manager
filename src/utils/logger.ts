type LogLevel = 'debug' | 'info' | 'warn' | 'error';

let debugModeEnabled = false;

export const setDebugMode = (enabled: boolean) => {
  debugModeEnabled = enabled;
};

const logMessage = (level: LogLevel, context: string, ...args: unknown[]): void => {
  const timestamp = new Date().toISOString();
  const levelPrefix = level.toUpperCase().padEnd(5);
  const prefix = `[${timestamp}] [${levelPrefix}] [${context}]`;

  switch (level) {
    case 'debug':
      if (debugModeEnabled) console.debug(prefix, ...args);
      break;
    case 'info':
      console.info(prefix, ...args);
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
  debug: (context: string, ...args: unknown[]) => logMessage('debug', context, ...args),
  info: (context: string, ...args: unknown[]) => logMessage('info', context, ...args),
  warn: (context: string, ...args: unknown[]) => logMessage('warn', context, ...args),
  error: (context: string, ...args: unknown[]) => logMessage('error', context, ...args),
};
