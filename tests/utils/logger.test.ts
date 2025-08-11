import { Logger } from '../../src/utils/logger';

describe('Logger Utility', () => {
  let originalConsole: typeof console;
  let mockConsole: jest.Mocked<typeof console>;

  beforeEach(() => {
    // Save original console
    originalConsole = global.console;
    
    // Mock console methods
    mockConsole = {
      ...global.console,
      log: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    global.console = mockConsole;
  });

  afterEach(() => {
    // Restore original console
    global.console = originalConsole;
    jest.clearAllMocks();
  });

  describe('Log Level Methods', () => {
    test('should log info messages', () => {
      Logger.info('Test info message');
      
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('INFO'),
        'Test info message'
      );
    });

    test('should log warn messages', () => {
      Logger.warn('Test warning message');
      
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('WARN'),
        'Test warning message'
      );
    });

    test('should log error messages', () => {
      Logger.error('Test error message');
      
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('ERROR'),
        'Test error message'
      );
    });

    test('should log debug messages', () => {
      Logger.debug('Test debug message');
      
      expect(mockConsole.debug).toHaveBeenCalledWith(
        expect.stringContaining('DEBUG'),
        'Test debug message'
      );
    });
  });

  describe('Log Format', () => {
    test('should include timestamp in log output', () => {
      Logger.info('Test message');
      
      const logCall = mockConsole.info.mock.calls[0];
      expect(logCall[0]).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('should include log level in output', () => {
      Logger.error('Test error');
      
      const logCall = mockConsole.error.mock.calls[0];
      expect(logCall[0]).toContain('[ERROR]');
    });
  });

  describe('Multiple Arguments', () => {
    test('should handle multiple arguments', () => {
      const obj = { test: 'value' };
      const num = 42;
      
      Logger.info('Message with', obj, 'and', num);
      
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('INFO'),
        'Message with',
        obj,
        'and',
        num
      );
    });
  });

  describe('Error Object Handling', () => {
    test('should properly format Error objects', () => {
      const error = new Error('Test error message');
      
      Logger.error('Error occurred:', error);
      
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('ERROR'),
        'Error occurred:',
        error
      );
    });
  });
});