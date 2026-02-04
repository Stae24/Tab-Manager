type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDev = (import.meta as any).env.DEV;

const log = (level: LogLevel, ...args: any[]) => {
  if ((level === 'debug' || level === 'info') && !isDev) {
    return;
  }

  switch (level) {
    case 'debug':
      console.debug(...args);
      break;
    case 'info':
      console.info(...args);
      break;
    case 'warn':
      console.warn(...args);
      break;
    case 'error':
      console.error(...args);
      break;
  }
};

export const logger = {
  debug: (...args: any[]) => log('debug', ...args),
  info: (...args: any[]) => log('info', ...args),
  warn: (...args: any[]) => log('warn', ...args),
  error: (...args: any[]) => log('error', ...args),
};
