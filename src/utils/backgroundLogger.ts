import { setDebugMode } from './logger';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

let debugModeEnabled = false;

export const setBackgroundDebugMode = (enabled: boolean) => {
  setDebugMode(enabled);
  debugModeEnabled = enabled;
};

const formatMessage = (level: LogLevel, context: string, ...args: unknown[]): void => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${context}]`;

  switch (level) {
    case 'debug':
      if (debugModeEnabled) console.log(prefix, ...args);
      break;
    case 'info':
      if (debugModeEnabled) console.log(prefix, ...args);
      break;
    case 'warn':
      console.warn(prefix, ...args);
      break;
    case 'error':
      console.error(prefix, ...args);
      break;
  }
};

export const backgroundLogger = {
  debug: (context: string, ...args: unknown[]) => formatMessage('debug', context, ...args),
  info: (context: string, ...args: unknown[]) => formatMessage('info', context, ...args),
  warn: (context: string, ...args: unknown[]) => formatMessage('warn', context, ...args),
  error: (context: string, ...args: unknown[]) => formatMessage('error', context, ...args),
};

// Sync with main logger
export const syncDebugMode = (enabled: boolean) => {
  setDebugMode(enabled);
  debugModeEnabled = enabled;
};
