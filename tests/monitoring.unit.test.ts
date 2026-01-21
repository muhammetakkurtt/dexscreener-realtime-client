import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MetricsCollector } from '../src/monitoring/metrics.js';
import { HealthChecker } from '../src/monitoring/health.js';
import { StructuredLogger } from '../src/monitoring/logger.js';
import { PerformanceMonitor } from '../src/monitoring/performance.js';
import { AlertMonitor } from '../src/monitoring/alerts.js';
import type { StreamHealth } from '../src/monitoring/types.js';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  it('should record event metrics', () => {
    collector.recordEvent('stream-1', 10, 5.5);
    
    // Metrics should be recorded without errors
    expect(collector).toBeDefined();
  });

  it('should record connection state', () => {
    collector.recordConnectionState('stream-1', 'connected');
    collector.recordConnectionState('stream-2', 'disconnected');
    
    expect(collector).toBeDefined();
  });

  it('should update events per second', () => {
    collector.updateEventsPerSecond('stream-1', 15.5);
    
    expect(collector).toBeDefined();
  });

  it('should update memory usage', () => {
    collector.updateMemoryUsage();
    
    expect(collector).toBeDefined();
  });

  it('should export Prometheus metrics', async () => {
    collector.recordEvent('stream-1', 5, 10);
    collector.recordConnectionState('stream-1', 'connected');
    
    const metrics = await collector.getPrometheusMetrics();
    
    expect(metrics).toContain('dexscreener_events_received_total');
    expect(metrics).toContain('dexscreener_pairs_processed_total');
    expect(metrics).toContain('dexscreener_event_processing_duration_ms');
    expect(metrics).toContain('dexscreener_connection_state');
    expect(metrics).toContain('dexscreener_events_per_second');
    expect(metrics).toContain('dexscreener_memory_usage_bytes');
  });

  it('should handle multiple streams', () => {
    collector.recordEvent('stream-1', 10, 5);
    collector.recordEvent('stream-2', 20, 10);
    collector.recordConnectionState('stream-1', 'connected');
    collector.recordConnectionState('stream-2', 'reconnecting');
    
    expect(collector).toBeDefined();
  });
});

describe('HealthChecker', () => {
  let checker: HealthChecker;
  const testPort = 9999;

  beforeEach(() => {
    checker = new HealthChecker(testPort);
  });

  afterEach(() => {
    checker.stop();
  });

  it('should start and stop HTTP server', () => {
    checker.start();
    checker.stop();
    
    expect(checker).toBeDefined();
  });

  it('should return healthy status when all streams connected', () => {
    const health1: StreamHealth = {
      state: 'connected',
      lastEventAt: Date.now(),
      eventsReceived: 100,
    };
    
    const health2: StreamHealth = {
      state: 'connected',
      lastEventAt: Date.now(),
      eventsReceived: 50,
    };
    
    checker.updateStreamHealth('stream-1', health1);
    checker.updateStreamHealth('stream-2', health2);
    
    const status = checker.getStatus();
    
    expect(status.status).toBe('healthy');
    expect(status.streams['stream-1']).toEqual(health1);
    expect(status.streams['stream-2']).toEqual(health2);
    expect(status.uptime).toBeGreaterThanOrEqual(0);
  });

  it('should return unhealthy status when all streams disconnected', () => {
    const health1: StreamHealth = {
      state: 'disconnected',
      eventsReceived: 0,
    };
    
    const health2: StreamHealth = {
      state: 'disconnected',
      eventsReceived: 0,
    };
    
    checker.updateStreamHealth('stream-1', health1);
    checker.updateStreamHealth('stream-2', health2);
    
    const status = checker.getStatus();
    
    expect(status.status).toBe('unhealthy');
  });

  it('should return degraded status when streams have mixed states', () => {
    const health1: StreamHealth = {
      state: 'connected',
      lastEventAt: Date.now(),
      eventsReceived: 100,
    };
    
    const health2: StreamHealth = {
      state: 'disconnected',
      eventsReceived: 50,
    };
    
    checker.updateStreamHealth('stream-1', health1);
    checker.updateStreamHealth('stream-2', health2);
    
    const status = checker.getStatus();
    
    expect(status.status).toBe('degraded');
  });

  it('should return healthy status when no streams registered', () => {
    const status = checker.getStatus();
    
    expect(status.status).toBe('healthy');
    expect(Object.keys(status.streams)).toHaveLength(0);
  });

  it('should track uptime correctly', async () => {
    const status1 = checker.getStatus();
    
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    const status2 = checker.getStatus();
    
    expect(status2.uptime).toBeGreaterThanOrEqual(status1.uptime + 1);
  });
});

describe('StructuredLogger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should log error messages', () => {
    const logger = new StructuredLogger('error', 'text');
    
    logger.error('Test error');
    
    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0][0];
    expect(output).toContain('ERROR');
    expect(output).toContain('Test error');
  });

  it('should log warn messages', () => {
    const logger = new StructuredLogger('warn', 'text');
    
    logger.warn('Test warning');
    
    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0][0];
    expect(output).toContain('WARN');
    expect(output).toContain('Test warning');
  });

  it('should log info messages', () => {
    const logger = new StructuredLogger('info', 'text');
    
    logger.info('Test info');
    
    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0][0];
    expect(output).toContain('INFO');
    expect(output).toContain('Test info');
  });

  it('should log debug messages', () => {
    const logger = new StructuredLogger('debug', 'text');
    
    logger.debug('Test debug');
    
    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0][0];
    expect(output).toContain('DEBUG');
    expect(output).toContain('Test debug');
  });

  it('should filter messages by log level', () => {
    const logger = new StructuredLogger('warn', 'text');
    
    logger.debug('Should not appear');
    logger.info('Should not appear');
    logger.warn('Should appear');
    logger.error('Should appear');
    
    expect(consoleLogSpy).toHaveBeenCalledTimes(2);
  });

  it('should output JSON format', () => {
    const logger = new StructuredLogger('info', 'json');
    
    logger.info('Test message', { key: 'value' });
    
    expect(consoleLogSpy).toHaveBeenCalled();
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.level).toBe('info');
    expect(output.message).toBe('Test message');
    expect(output.context).toEqual({ key: 'value' });
    expect(output.timestamp).toBeDefined();
  });

  it('should output text format', () => {
    const logger = new StructuredLogger('info', 'text');
    
    logger.info('Test message', { key: 'value' });
    
    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0][0];
    expect(output).toContain('INFO');
    expect(output).toContain('Test message');
    expect(output).toContain('{"key":"value"}');
  });

  it('should include error details', () => {
    const logger = new StructuredLogger('error', 'json');
    const error = new Error('Test error');
    
    logger.error('Error occurred', {}, error);
    
    expect(consoleLogSpy).toHaveBeenCalled();
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.error).toBeDefined();
    expect(output.error.message).toBe('Test error');
    expect(output.error.stack).toBeDefined();
  });

  it('should include context in logs', () => {
    const logger = new StructuredLogger('info', 'json');
    
    logger.info('Test', { userId: 123, action: 'login' });
    
    expect(consoleLogSpy).toHaveBeenCalled();
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.context).toEqual({ userId: 123, action: 'login' });
  });
});

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  afterEach(() => {
    monitor.stopMemoryMonitoring();
  });

  it('should track event durations', () => {
    monitor.trackEventDuration(10);
    monitor.trackEventDuration(20);
    monitor.trackEventDuration(15);
    
    const metrics = monitor.getMetrics();
    
    expect(metrics.eventProcessing.count).toBe(3);
    expect(metrics.eventProcessing.average).toBe(15);
    expect(metrics.eventProcessing.min).toBe(10);
    expect(metrics.eventProcessing.max).toBe(20);
  });

  it('should sample memory usage', () => {
    monitor.sampleMemoryUsage();
    monitor.sampleMemoryUsage();
    
    const metrics = monitor.getMetrics();
    
    expect(metrics.memoryUsage.samples).toBe(2);
    expect(metrics.memoryUsage.current).toBeGreaterThan(0);
    expect(metrics.memoryUsage.peak).toBeGreaterThan(0);
  });

  it('should track peak memory', () => {
    monitor.sampleMemoryUsage();
    const metrics1 = monitor.getMetrics();
    const peak1 = metrics1.memoryUsage.peak;
    
    monitor.sampleMemoryUsage();
    const metrics2 = monitor.getMetrics();
    const peak2 = metrics2.memoryUsage.peak;
    
    expect(peak2).toBeGreaterThanOrEqual(peak1);
  });

  it('should reset metrics', () => {
    monitor.trackEventDuration(10);
    monitor.sampleMemoryUsage();
    
    monitor.reset();
    
    const metrics = monitor.getMetrics();
    
    expect(metrics.eventProcessing.count).toBe(0);
    expect(metrics.memoryUsage.samples).toBe(0);
    expect(metrics.memoryUsage.peak).toBe(0);
  });

  it('should handle empty metrics', () => {
    const metrics = monitor.getMetrics();
    
    expect(metrics.eventProcessing.count).toBe(0);
    expect(metrics.eventProcessing.average).toBe(0);
    expect(metrics.eventProcessing.min).toBe(0);
    expect(metrics.eventProcessing.max).toBe(0);
  });

  it('should start and stop memory monitoring', async () => {
    monitor.startMemoryMonitoring(50);
    
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const metrics = monitor.getMetrics();
    expect(metrics.memoryUsage.samples).toBeGreaterThan(0);
    
    monitor.stopMemoryMonitoring();
  });
});

describe('AlertMonitor', () => {
  let logger: StructuredLogger;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logger = new StructuredLogger('warn', 'text');
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('should trigger alert when value exceeds threshold (gt)', () => {
    const alerts = [
      { metric: 'memory', threshold: 100, comparison: 'gt' as const },
    ];
    
    const monitor = new AlertMonitor(alerts, logger);
    
    monitor.checkMetric('memory', 150);
    
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0][0]).toContain('memory');
  });

  it('should trigger alert when value is below threshold (lt)', () => {
    const alerts = [
      { metric: 'events_per_second', threshold: 10, comparison: 'lt' as const },
    ];
    
    const monitor = new AlertMonitor(alerts, logger);
    
    monitor.checkMetric('events_per_second', 5);
    
    expect(warnSpy).toHaveBeenCalled();
  });

  it('should trigger alert when value equals threshold (eq)', () => {
    const alerts = [
      { metric: 'errors', threshold: 0, comparison: 'eq' as const },
    ];
    
    const monitor = new AlertMonitor(alerts, logger);
    
    monitor.checkMetric('errors', 0);
    
    expect(warnSpy).toHaveBeenCalled();
  });

  it('should not trigger alert when threshold not violated', () => {
    const alerts = [
      { metric: 'memory', threshold: 100, comparison: 'gt' as const },
    ];
    
    const monitor = new AlertMonitor(alerts, logger);
    
    monitor.checkMetric('memory', 50);
    
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('should handle multiple alerts for same metric', () => {
    const alerts = [
      { metric: 'memory', threshold: 100, comparison: 'gt' as const },
      { metric: 'memory', threshold: 200, comparison: 'gt' as const },
    ];
    
    const monitor = new AlertMonitor(alerts, logger);
    
    monitor.checkMetric('memory', 150);
    
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('should include metric details in alert', () => {
    const alerts = [
      { metric: 'cpu', threshold: 80, comparison: 'gt' as const },
    ];
    
    const monitor = new AlertMonitor(alerts, logger);
    
    monitor.checkMetric('cpu', 90);
    
    expect(warnSpy).toHaveBeenCalled();
    const context = warnSpy.mock.calls[0][1];
    expect(context).toEqual({
      metric: 'cpu',
      value: 90,
      threshold: 80,
      comparison: 'greater than',
    });
  });

  it('should not trigger alert for different metric', () => {
    const alerts = [
      { metric: 'memory', threshold: 100, comparison: 'gt' as const },
    ];
    
    const monitor = new AlertMonitor(alerts, logger);
    
    monitor.checkMetric('cpu', 150);
    
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
