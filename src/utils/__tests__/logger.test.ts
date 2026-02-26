import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger, setDebugMode } from '../logger';

describe('logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();
    setDebugMode(false);
  });

  it('should log warn and error regardless of debug mode', () => {
    logger.warn('test warn');
    logger.error('test error');
    expect(console.warn).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it('should not log debug when debug mode is disabled, but should always log info', () => {
    setDebugMode(false);
    logger.debug('test debug');
    logger.info('test info');
    expect(console.debug).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalled();
  });

  it('should log debug and info when debug mode is enabled', () => {
    setDebugMode(true);
    logger.debug('test debug');
    logger.info('test info');
    expect(console.debug).toHaveBeenCalled();
    expect(console.info).toHaveBeenCalled();
  });
});
