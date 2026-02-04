import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '../logger';

describe('logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  it('should log warn and error regardless of environment', () => {
    logger.warn('test warn');
    logger.error('test error');
    expect(console.warn).toHaveBeenCalledWith('test warn');
    expect(console.error).toHaveBeenCalledWith('test error');
  });

  it('should log debug and info (assuming DEV is true in tests)', () => {
    logger.debug('test debug');
    logger.info('test info');
    
    if ((import.meta as any).env.DEV) {
      expect(console.debug).toHaveBeenCalledWith('test debug');
      expect(console.info).toHaveBeenCalledWith('test info');
    } else {
      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
    }
  });
});
