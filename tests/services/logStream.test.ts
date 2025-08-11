import { LogStreamManager } from '../../src/services/logStream';
import { LogEntry, LogLevel, LogSource } from '../../src/types/websocket';

describe('LogStreamManager', () => {
  let logStreamManager: LogStreamManager;
  let testDeploymentId: string;
  let testDeploymentId2: string;

  beforeEach(() => {
    // Reset singleton instance before each test
    (LogStreamManager as any).instance = undefined;
    logStreamManager = LogStreamManager.getInstance();
    testDeploymentId = 'test-deployment-123';
    testDeploymentId2 = 'test-deployment-456';
    
    // Mock environment variables for testing
    process.env.LOG_BUFFER_SIZE = '10';
    process.env.LOG_RETENTION_TIME = '5000'; // 5 seconds for testing
    process.env.LOG_CLEANUP_INTERVAL = '1000'; // 1 second for testing
    process.env.LOG_METRICS_INTERVAL = '1000'; // 1 second for testing
    process.env.LOG_PERSIST = 'false';
    process.env.LOG_COMPRESSION = 'false';
  });

  afterEach(async () => {
    await logStreamManager.cleanup();
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize as singleton', () => {
      const instance1 = LogStreamManager.getInstance();
      const instance2 = LogStreamManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should initialize with correct configuration', () => {
      // Access private config for testing
      const config = (logStreamManager as any).config;
      expect(config.maxBufferSize).toBe(10);
      expect(config.maxRetentionTime).toBe(5000);
      expect(config.cleanupInterval).toBe(1000);
      expect(config.metricsInterval).toBe(1000);
      expect(config.persistLogs).toBe(false);
      expect(config.compressionEnabled).toBe(false);
    });

    it('should start cleanup and metrics processes', () => {
      // Verify intervals are set
      const cleanupInterval = (logStreamManager as any).cleanupInterval;
      const metricsInterval = (logStreamManager as any).metricsInterval;
      
      expect(cleanupInterval).toBeDefined();
      expect(metricsInterval).toBeDefined();
    });

    it('should set up event listeners', (done) => {
      logStreamManager.on('buffer:full', (deploymentId) => {
        expect(deploymentId).toBeDefined();
        done();
      });

      // Trigger buffer full event by adding logs beyond buffer size
      for (let i = 0; i < 15; i++) {
        logStreamManager.createApplicationLog(testDeploymentId, 'info', `Test log ${i}`);
      }
    });
  });

  describe('Log Entry Creation', () => {
    it('should create system log entry', () => {
      const logEntry = logStreamManager.createSystemLog(
        testDeploymentId,
        'info',
        'System message',
        { test: true }
      );

      expect(logEntry.id).toBeDefined();
      expect(logEntry.deploymentId).toBe(testDeploymentId);
      expect(logEntry.level).toBe('info');
      expect(logEntry.source).toBe('system');
      expect(logEntry.message).toBe('System message');
      expect(logEntry.data).toEqual({ test: true });
      expect(logEntry.tags).toContain('system');
      expect(logEntry.sequence).toBe(0);
      expect(logEntry.timestamp).toBeInstanceOf(Date);
    });

    it('should create application log entry', () => {
      const logEntry = logStreamManager.createApplicationLog(
        testDeploymentId,
        'error',
        'Application error',
        { error: 'stack trace' }
      );

      expect(logEntry.level).toBe('error');
      expect(logEntry.source).toBe('application');
      expect(logEntry.message).toBe('Application error');
      expect(logEntry.data).toEqual({ error: 'stack trace' });
      expect(logEntry.sequence).toBe(0);
    });

    it('should create build log entry', () => {
      const logEntry = logStreamManager.createBuildLog(
        testDeploymentId,
        'warn',
        'Build warning',
        { step: 'compile' }
      );

      expect(logEntry.level).toBe('warn');
      expect(logEntry.source).toBe('build');
      expect(logEntry.message).toBe('Build warning');
      expect(logEntry.tags).toContain('build');
    });

    it('should create deployment log entry', () => {
      const logEntry = logStreamManager.createDeploymentLog(
        testDeploymentId,
        'debug',
        'Deployment debug info',
        { phase: 'startup' }
      );

      expect(logEntry.level).toBe('debug');
      expect(logEntry.source).toBe('deployment');
      expect(logEntry.message).toBe('Deployment debug info');
      expect(logEntry.tags).toContain('deployment');
    });

    it('should increment sequence numbers correctly', () => {
      const log1 = logStreamManager.createApplicationLog(testDeploymentId, 'info', 'Log 1');
      const log2 = logStreamManager.createApplicationLog(testDeploymentId, 'info', 'Log 2');
      const log3 = logStreamManager.createApplicationLog(testDeploymentId, 'info', 'Log 3');

      expect(log1.sequence).toBe(0);
      expect(log2.sequence).toBe(1);
      expect(log3.sequence).toBe(2);
    });
  });

  describe('Log Buffer Management', () => {
    it('should create buffer when adding first log', () => {
      expect(logStreamManager.hasBuffer(testDeploymentId)).toBe(false);
      
      logStreamManager.addLog({
        id: 'test-log-1',
        deploymentId: testDeploymentId,
        timestamp: new Date(),
        level: 'info',
        source: 'application',
        message: 'Test message',
        sequence: 0
      });

      expect(logStreamManager.hasBuffer(testDeploymentId)).toBe(true);
    });

    it('should add logs to buffer correctly', () => {
      const logEntry: LogEntry = {
        id: 'test-log-1',
        deploymentId: testDeploymentId,
        timestamp: new Date(),
        level: 'info',
        source: 'application',
        message: 'Test message',
        sequence: 0
      };

      logStreamManager.addLog(logEntry);
      const logs = logStreamManager.getLogs(testDeploymentId);

      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject(logEntry);
    });

    it('should respect buffer size limits', (done) => {
      logStreamManager.on('buffer:full', (deploymentId) => {
        expect(deploymentId).toBe(testDeploymentId);
        
        // Check that buffer maintains max size
        const logs = logStreamManager.getLogs(testDeploymentId);
        expect(logs.length).toBeLessThanOrEqual(10); // Buffer size is 10
        
        // Check that newer logs are kept
        const lastLog = logs[logs.length - 1];
        expect(lastLog.message).toBe('Log 14');
        
        done();
      });

      // Add more logs than buffer size
      for (let i = 0; i < 15; i++) {
        logStreamManager.addLog({
          id: `test-log-${i}`,
          deploymentId: testDeploymentId,
          timestamp: new Date(),
          level: 'info',
          source: 'application',
          message: `Log ${i}`,
          sequence: i
        });
      }
    });

    it('should maintain separate buffers for different deployments', () => {
      logStreamManager.createApplicationLog(testDeploymentId, 'info', 'Log for deployment 1');
      logStreamManager.createApplicationLog(testDeploymentId2, 'info', 'Log for deployment 2');

      const logs1 = logStreamManager.getLogs(testDeploymentId);
      const logs2 = logStreamManager.getLogs(testDeploymentId2);

      expect(logs1).toHaveLength(1);
      expect(logs2).toHaveLength(1);
      expect(logs1[0].message).toBe('Log for deployment 1');
      expect(logs2[0].message).toBe('Log for deployment 2');
    });

    it('should update last access time when accessing logs', () => {
      logStreamManager.createApplicationLog(testDeploymentId, 'info', 'Test log');
      
      const beforeAccess = new Date();
      logStreamManager.getLogs(testDeploymentId);
      
      // Access private buffer to check last access time
      const buffers = (logStreamManager as any).buffers;
      const buffer = buffers.get(testDeploymentId);
      
      expect(buffer.lastAccess.getTime()).toBeGreaterThanOrEqual(beforeAccess.getTime());
    });
  });

  describe('Log Retrieval and Filtering', () => {
    beforeEach(() => {
      // Add various logs for filtering tests
      const logs = [
        { level: 'info' as LogLevel, source: 'system' as LogSource, message: 'System info', tags: ['system'] },
        { level: 'warn' as LogLevel, source: 'application' as LogSource, message: 'App warning', tags: ['app', 'warning'] },
        { level: 'error' as LogLevel, source: 'build' as LogSource, message: 'Build failed', tags: ['build', 'error'] },
        { level: 'debug' as LogLevel, source: 'deployment' as LogSource, message: 'Deploy debug', tags: ['deploy'] },
        { level: 'info' as LogLevel, source: 'application' as LogSource, message: 'Another info', tags: ['app'] }
      ];

      logs.forEach((log, index) => {
        logStreamManager.addLog({
          id: `test-log-${index}`,
          deploymentId: testDeploymentId,
          timestamp: new Date(Date.now() + index * 1000), // Different timestamps
          level: log.level,
          source: log.source,
          message: log.message,
          tags: log.tags,
          sequence: index
        });
      });
    });

    it('should return all logs when no filters applied', () => {
      const logs = logStreamManager.getLogs(testDeploymentId);
      expect(logs).toHaveLength(5);
    });

    it('should filter by log level', () => {
      const infoLogs = logStreamManager.getLogs(testDeploymentId, { level: ['info'] });
      const errorLogs = logStreamManager.getLogs(testDeploymentId, { level: ['error', 'warn'] });

      expect(infoLogs).toHaveLength(2);
      expect(errorLogs).toHaveLength(2);
      expect(infoLogs.every(log => log.level === 'info')).toBe(true);
      expect(errorLogs.every(log => ['error', 'warn'].includes(log.level))).toBe(true);
    });

    it('should filter by log source', () => {
      const systemLogs = logStreamManager.getLogs(testDeploymentId, { source: ['system'] });
      const appLogs = logStreamManager.getLogs(testDeploymentId, { source: ['application'] });

      expect(systemLogs).toHaveLength(1);
      expect(appLogs).toHaveLength(2);
      expect(systemLogs[0].source).toBe('system');
      expect(appLogs.every(log => log.source === 'application')).toBe(true);
    });

    it('should filter by time range', () => {
      const now = new Date();
      const startTime = new Date(now.getTime() - 2000); // 2 seconds ago
      const endTime = new Date(now.getTime() + 2000); // 2 seconds from now

      const filteredLogs = logStreamManager.getLogs(testDeploymentId, {
        startTime,
        endTime
      });

      expect(filteredLogs.length).toBeGreaterThan(0);
      filteredLogs.forEach(log => {
        expect(log.timestamp.getTime()).toBeGreaterThanOrEqual(startTime.getTime());
        expect(log.timestamp.getTime()).toBeLessThanOrEqual(endTime.getTime());
      });
    });

    it('should filter by search text', () => {
      const searchLogs = logStreamManager.getLogs(testDeploymentId, { search: 'info' });
      const buildLogs = logStreamManager.getLogs(testDeploymentId, { search: 'build' });

      expect(searchLogs).toHaveLength(2); // 'System info' and 'Another info'
      expect(buildLogs).toHaveLength(1); // 'Build failed'
      
      expect(searchLogs.every(log => 
        log.message.toLowerCase().includes('info')
      )).toBe(true);
    });

    it('should filter by tags', () => {
      const systemTagLogs = logStreamManager.getLogs(testDeploymentId, { tags: ['system'] });
      const appTagLogs = logStreamManager.getLogs(testDeploymentId, { tags: ['app'] });

      expect(systemTagLogs).toHaveLength(1);
      expect(appTagLogs).toHaveLength(2);
      expect(systemTagLogs[0].tags).toContain('system');
    });

    it('should apply tail limit', () => {
      const tailLogs = logStreamManager.getLogs(testDeploymentId, { tail: 3 });
      expect(tailLogs).toHaveLength(3);
      
      // Should return the last 3 logs
      expect(tailLogs[0].sequence).toBe(2);
      expect(tailLogs[1].sequence).toBe(3);
      expect(tailLogs[2].sequence).toBe(4);
    });

    it('should combine multiple filters', () => {
      const filteredLogs = logStreamManager.getLogs(testDeploymentId, {
        level: ['info', 'warn'],
        source: ['application'],
        tail: 1
      });

      expect(filteredLogs).toHaveLength(1);
      expect(filteredLogs[0].level).toBe('info');
      expect(filteredLogs[0].source).toBe('application');
      expect(filteredLogs[0].message).toBe('Another info');
    });

    it('should return empty array for non-existent deployment', () => {
      const logs = logStreamManager.getLogs('non-existent-deployment');
      expect(logs).toEqual([]);
    });
  });

  describe('Recent Logs', () => {
    beforeEach(() => {
      // Add 20 logs
      for (let i = 0; i < 20; i++) {
        logStreamManager.createApplicationLog(testDeploymentId, 'info', `Log ${i}`);
      }
    });

    it('should return recent logs with default count', () => {
      const recentLogs = logStreamManager.getRecentLogs(testDeploymentId);
      expect(recentLogs).toHaveLength(10); // Buffer size is 10, so max 10 logs
    });

    it('should return recent logs with custom count', () => {
      const recentLogs = logStreamManager.getRecentLogs(testDeploymentId, 5);
      expect(recentLogs).toHaveLength(5);
    });

    it('should return most recent logs first', () => {
      const recentLogs = logStreamManager.getRecentLogs(testDeploymentId, 3);
      
      // Should be the last 3 logs (buffer keeps latest logs)
      expect(recentLogs[0].message).toBe('Log 17');
      expect(recentLogs[1].message).toBe('Log 18');
      expect(recentLogs[2].message).toBe('Log 19');
    });
  });

  describe('Buffer Management Operations', () => {
    beforeEach(() => {
      logStreamManager.createApplicationLog(testDeploymentId, 'info', 'Test log 1');
      logStreamManager.createApplicationLog(testDeploymentId, 'info', 'Test log 2');
      logStreamManager.createApplicationLog(testDeploymentId2, 'info', 'Test log for deployment 2');
    });

    it('should clear logs for specific deployment', () => {
      const cleared = logStreamManager.clearLogs(testDeploymentId);
      
      expect(cleared).toBe(true);
      expect(logStreamManager.getLogs(testDeploymentId)).toHaveLength(0);
      expect(logStreamManager.getLogs(testDeploymentId2)).toHaveLength(1); // Other deployment unaffected
    });

    it('should return false when clearing non-existent deployment', () => {
      const cleared = logStreamManager.clearLogs('non-existent');
      expect(cleared).toBe(false);
    });

    it('should remove entire buffer for deployment', () => {
      const removed = logStreamManager.removeBuffer(testDeploymentId);
      
      expect(removed).toBe(true);
      expect(logStreamManager.hasBuffer(testDeploymentId)).toBe(false);
      expect(logStreamManager.hasBuffer(testDeploymentId2)).toBe(true); // Other deployment unaffected
    });

    it('should return false when removing non-existent buffer', () => {
      const removed = logStreamManager.removeBuffer('non-existent');
      expect(removed).toBe(false);
    });

    it('should emit buffer:cleared event when clearing logs', (done) => {
      logStreamManager.on('buffer:cleared', (deploymentId, clearedCount) => {
        expect(deploymentId).toBe(testDeploymentId);
        expect(clearedCount).toBe(2);
        done();
      });

      logStreamManager.clearLogs(testDeploymentId);
    });

    it('should emit buffer:removed event when removing buffer', (done) => {
      logStreamManager.on('buffer:removed', (deploymentId) => {
        expect(deploymentId).toBe(testDeploymentId);
        done();
      });

      logStreamManager.removeBuffer(testDeploymentId);
    });
  });

  describe('Statistics and Metrics', () => {
    beforeEach(() => {
      // Set up test data
      logStreamManager.createApplicationLog(testDeploymentId, 'info', 'Log 1');
      logStreamManager.createApplicationLog(testDeploymentId, 'info', 'Log 2');
      logStreamManager.createApplicationLog(testDeploymentId2, 'info', 'Log for deployment 2');
    });

    it('should return stats for specific deployment', () => {
      const stats = logStreamManager.getStats(testDeploymentId);
      
      expect(stats).toBeDefined();
      expect(stats!.deploymentId).toBe(testDeploymentId);
      expect(stats!.totalLogs).toBe(2);
      expect(stats!.bufferSize).toBe(2);
      expect(stats!.subscriberCount).toBe(0);
      expect(stats!.lastActivity).toBeInstanceOf(Date);
    });

    it('should return null for non-existent deployment stats', () => {
      const stats = logStreamManager.getStats('non-existent');
      expect(stats).toBeNull();
    });

    it('should return overall statistics', () => {
      const overallStats = logStreamManager.getOverallStats();
      
      expect(overallStats.totalBuffers).toBe(2);
      expect(overallStats.totalLogs).toBe(3);
      expect(overallStats.totalSubscribers).toBe(0);
      expect(overallStats.memoryUsage).toBeGreaterThan(0);
    });

    it('should track subscriber count correctly', async () => {
      await logStreamManager.subscribe(testDeploymentId, 'user1');
      await logStreamManager.subscribe(testDeploymentId, 'user2');
      await logStreamManager.subscribe(testDeploymentId2, 'user3');

      const stats1 = logStreamManager.getStats(testDeploymentId);
      const stats2 = logStreamManager.getStats(testDeploymentId2);
      const overallStats = logStreamManager.getOverallStats();

      expect(stats1!.subscriberCount).toBe(2);
      expect(stats2!.subscriberCount).toBe(1);
      expect(overallStats.totalSubscribers).toBe(3);
    });

    it('should handle unsubscribe correctly', async () => {
      await logStreamManager.subscribe(testDeploymentId, 'user1');
      await logStreamManager.subscribe(testDeploymentId, 'user2');
      
      await logStreamManager.unsubscribe(testDeploymentId, 'user1');
      
      const stats = logStreamManager.getStats(testDeploymentId);
      expect(stats!.subscriberCount).toBe(1);
    });

    it('should not go below zero subscribers', async () => {
      await logStreamManager.unsubscribe(testDeploymentId, 'user1'); // Unsubscribe without subscribe
      
      const stats = logStreamManager.getStats(testDeploymentId);
      expect(stats!.subscriberCount).toBe(0);
    });

    it('should update subscriber count with delta', () => {
      logStreamManager.updateSubscriberCount(testDeploymentId, 5);
      let stats = logStreamManager.getStats(testDeploymentId);
      expect(stats!.subscriberCount).toBe(5);

      logStreamManager.updateSubscriberCount(testDeploymentId, -2);
      stats = logStreamManager.getStats(testDeploymentId);
      expect(stats!.subscriberCount).toBe(3);

      logStreamManager.updateSubscriberCount(testDeploymentId, -10); // Should not go below 0
      stats = logStreamManager.getStats(testDeploymentId);
      expect(stats!.subscriberCount).toBe(0);
    });
  });

  describe('Active Deployments', () => {
    it('should return empty array when no deployments', () => {
      const activeDeployments = logStreamManager.getActiveDeployments();
      expect(activeDeployments).toEqual([]);
    });

    it('should return active deployment IDs', () => {
      logStreamManager.createApplicationLog(testDeploymentId, 'info', 'Log 1');
      logStreamManager.createApplicationLog(testDeploymentId2, 'info', 'Log 2');

      const activeDeployments = logStreamManager.getActiveDeployments();
      expect(activeDeployments).toContain(testDeploymentId);
      expect(activeDeployments).toContain(testDeploymentId2);
      expect(activeDeployments).toHaveLength(2);
    });

    it('should not include removed deployments', () => {
      logStreamManager.createApplicationLog(testDeploymentId, 'info', 'Log 1');
      logStreamManager.createApplicationLog(testDeploymentId2, 'info', 'Log 2');

      logStreamManager.removeBuffer(testDeploymentId);

      const activeDeployments = logStreamManager.getActiveDeployments();
      expect(activeDeployments).not.toContain(testDeploymentId);
      expect(activeDeployments).toContain(testDeploymentId2);
      expect(activeDeployments).toHaveLength(1);
    });
  });

  describe('Event Emission', () => {
    it('should emit log event when adding log', (done) => {
      logStreamManager.on('log', (deploymentId, logEntry) => {
        expect(deploymentId).toBe(testDeploymentId);
        expect(logEntry.message).toBe('Test log');
        expect(logEntry.source).toBe('application');
        done();
      });

      logStreamManager.createApplicationLog(testDeploymentId, 'info', 'Test log');
    });

    it('should emit log:added event', (done) => {
      logStreamManager.on('log:added', (deploymentId, logEntry) => {
        expect(deploymentId).toBe(testDeploymentId);
        expect(logEntry.message).toBe('Test log');
        done();
      });

      logStreamManager.createApplicationLog(testDeploymentId, 'info', 'Test log');
    });

    it('should emit log:entry event for WebSocket integration', (done) => {
      logStreamManager.on('log:entry', (deploymentId, logEntry) => {
        expect(deploymentId).toBe(testDeploymentId);
        expect(logEntry.message).toBe('Test log');
        done();
      });

      logStreamManager.createApplicationLog(testDeploymentId, 'info', 'Test log');
    });

    it('should emit metrics event', (done) => {
      logStreamManager.on('metrics', (metrics) => {
        expect(metrics.totalBuffers).toBeGreaterThanOrEqual(0);
        expect(metrics.totalLogs).toBeGreaterThanOrEqual(0);
        expect(metrics.totalSubscribers).toBeGreaterThanOrEqual(0);
        expect(metrics.memoryUsage).toBeGreaterThan(0);
        done();
      });

      // Trigger metrics collection manually
      const collectMetrics = (logStreamManager as any).collectMetrics.bind(logStreamManager);
      collectMetrics();
    });
  });

  describe('Log ID Generation', () => {
    it('should generate unique log IDs', () => {
      const log1 = logStreamManager.createApplicationLog(testDeploymentId, 'info', 'Log 1');
      const log2 = logStreamManager.createApplicationLog(testDeploymentId, 'info', 'Log 2');
      const log3 = logStreamManager.createApplicationLog(testDeploymentId, 'info', 'Log 3');

      expect(log1.id).not.toBe(log2.id);
      expect(log2.id).not.toBe(log3.id);
      expect(log1.id).not.toBe(log3.id);

      // All IDs should start with 'log_'
      expect(log1.id.startsWith('log_')).toBe(true);
      expect(log2.id.startsWith('log_')).toBe(true);
      expect(log3.id.startsWith('log_')).toBe(true);
    });

    it('should generate IDs with timestamp and random components', () => {
      const log = logStreamManager.createApplicationLog(testDeploymentId, 'info', 'Test');
      const idParts = log.id.split('_');
      
      expect(idParts).toHaveLength(3); // log_{timestamp}_{random}
      expect(idParts[0]).toBe('log');
      expect(parseInt(idParts[1])).toBeGreaterThan(0); // timestamp
      expect(idParts[2].length).toBeGreaterThan(0); // random part
    });
  });

  describe('Cleanup and Persistence', () => {
    beforeEach(() => {
      // Reset config for persistence tests
      (logStreamManager as any).config.persistLogs = true;
    });

    it('should handle cleanup gracefully', async () => {
      logStreamManager.createApplicationLog(testDeploymentId, 'info', 'Test log');
      
      await expect(logStreamManager.cleanup()).resolves.not.toThrow();
      
      // Verify intervals are cleared
      const cleanupInterval = (logStreamManager as any).cleanupInterval;
      const metricsInterval = (logStreamManager as any).metricsInterval;
      
      expect(cleanupInterval).toBeUndefined();
      expect(metricsInterval).toBeUndefined();
    });

    it('should clear all buffers and stats on cleanup', async () => {
      logStreamManager.createApplicationLog(testDeploymentId, 'info', 'Test log');
      logStreamManager.createApplicationLog(testDeploymentId2, 'info', 'Test log 2');

      await logStreamManager.cleanup();

      expect(logStreamManager.getActiveDeployments()).toHaveLength(0);
      expect(logStreamManager.getStats(testDeploymentId)).toBeNull();
      expect(logStreamManager.getStats(testDeploymentId2)).toBeNull();
    });

    it('should handle persistence during buffer removal', () => {
      const persistLogsSpy = jest.spyOn(logStreamManager as any, 'persistLogs').mockResolvedValue(undefined);
      
      logStreamManager.createApplicationLog(testDeploymentId, 'info', 'Test log');
      logStreamManager.removeBuffer(testDeploymentId);

      expect(persistLogsSpy).toHaveBeenCalledWith(testDeploymentId, expect.any(Array));
      
      persistLogsSpy.mockRestore();
    });

    it('should skip persistence when disabled', () => {
      (logStreamManager as any).config.persistLogs = false;
      const persistLogsSpy = jest.spyOn(logStreamManager as any, 'persistLogs').mockResolvedValue(undefined);
      
      logStreamManager.createApplicationLog(testDeploymentId, 'info', 'Test log');
      logStreamManager.removeBuffer(testDeploymentId);

      expect(persistLogsSpy).not.toHaveBeenCalled();
      
      persistLogsSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should handle persistence errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const persistLogsSpy = jest.spyOn(logStreamManager as any, 'persistLogs')
        .mockRejectedValue(new Error('Database error'));
      
      (logStreamManager as any).config.persistLogs = true;

      // Fill buffer beyond capacity to trigger persistence
      for (let i = 0; i < 15; i++) {
        logStreamManager.createApplicationLog(testDeploymentId, 'info', `Log ${i}`);
      }

      // Wait for async persistence to potentially fail
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to persist logs'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
      persistLogsSpy.mockRestore();
    });

    it('should handle malformed log entries', () => {
      expect(() => {
        logStreamManager.addLog({
          id: 'test',
          deploymentId: testDeploymentId,
          timestamp: new Date(),
          level: 'invalid' as LogLevel,
          source: 'application',
          message: 'Test',
          sequence: 0
        });
      }).not.toThrow();
    });

    it('should handle undefined or null values in log data', () => {
      expect(() => {
        logStreamManager.createApplicationLog(
          testDeploymentId,
          'info',
          'Test message',
          null
        );
      }).not.toThrow();

      expect(() => {
        logStreamManager.createApplicationLog(
          testDeploymentId,
          'info',
          'Test message',
          undefined
        );
      }).not.toThrow();
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large number of logs efficiently', () => {
      const startTime = Date.now();
      
      // Add 1000 logs
      for (let i = 0; i < 1000; i++) {
        logStreamManager.createApplicationLog(testDeploymentId, 'info', `Log ${i}`, { index: i });
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);
      
      // Buffer should still respect size limits
      const logs = logStreamManager.getLogs(testDeploymentId);
      expect(logs.length).toBeLessThanOrEqual(10);
    });

    it('should calculate memory usage approximation', () => {
      logStreamManager.createApplicationLog(testDeploymentId, 'info', 'Log 1');
      logStreamManager.createApplicationLog(testDeploymentId2, 'info', 'Log 2');
      
      const stats = logStreamManager.getOverallStats();
      expect(stats.memoryUsage).toBeGreaterThan(0);
      expect(typeof stats.memoryUsage).toBe('number');
    });

    it('should handle concurrent access to buffers', async () => {
      const promises: Promise<void>[] = [];
      
      // Create multiple concurrent operations
      for (let i = 0; i < 50; i++) {
        promises.push(Promise.resolve().then(() => {
          logStreamManager.createApplicationLog(testDeploymentId, 'info', `Concurrent log ${i}`);
        }));
      }
      
      await Promise.all(promises);
      
      // Should not crash and should have created buffer
      expect(logStreamManager.hasBuffer(testDeploymentId)).toBe(true);
      const logs = logStreamManager.getLogs(testDeploymentId);
      expect(logs.length).toBeGreaterThan(0);
    });
  });
});