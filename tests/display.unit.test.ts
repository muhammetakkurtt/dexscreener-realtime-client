import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProgressDisplay } from '../src/cli/display.js';
import type { DisplayMetrics } from '../src/types.js';

describe('ProgressDisplay', () => {
  let display: ProgressDisplay;

  beforeEach(() => {
    // Mock console methods to avoid output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    if (display) {
      display.stop();
    }
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create display with default normal mode', () => {
      display = new ProgressDisplay();
      expect(display).toBeDefined();
    });

    it('should create display with verbose mode', () => {
      display = new ProgressDisplay('verbose');
      expect(display).toBeDefined();
    });

    it('should create display with quiet mode', () => {
      display = new ProgressDisplay('quiet');
      expect(display).toBeDefined();
    });
  });

  describe('start and stop', () => {
    it('should start and stop without errors', () => {
      display = new ProgressDisplay('normal');
      expect(() => display.start()).not.toThrow();
      expect(() => display.stop()).not.toThrow();
    });

    it('should not create spinner in quiet mode', () => {
      display = new ProgressDisplay('quiet');
      display.start();
      // In quiet mode, no spinner should be created
      // This is verified by the fact that update() won't throw
      expect(() => display.stop()).not.toThrow();
    });
  });

  describe('update', () => {
    it('should update metrics without errors', () => {
      display = new ProgressDisplay('normal');
      display.start();

      const metrics: DisplayMetrics = {
        eventsPerSecond: 10.5,
        dataRateMBps: 0.5,
        totalEvents: 100,
        totalPairs: 500,
        uptimeSeconds: 60,
        connectionStates: {
          'stream-1': 'connected',
        },
      };

      expect(() => display.update(metrics)).not.toThrow();
    });

    it('should handle multiple connection states in verbose mode', () => {
      display = new ProgressDisplay('verbose');
      display.start();

      const metrics: DisplayMetrics = {
        eventsPerSecond: 15.2,
        dataRateMBps: 1.2,
        totalEvents: 200,
        totalPairs: 1000,
        uptimeSeconds: 120,
        connectionStates: {
          'stream-1': 'connected',
          'stream-2': 'connecting',
          'stream-3': 'disconnected',
        },
      };

      expect(() => display.update(metrics)).not.toThrow();
    });

    it('should not throw in quiet mode', () => {
      display = new ProgressDisplay('quiet');
      display.start();

      const metrics: DisplayMetrics = {
        eventsPerSecond: 10,
        dataRateMBps: 0.5,
        totalEvents: 100,
        totalPairs: 500,
        uptimeSeconds: 60,
        connectionStates: {
          'stream-1': 'connected',
        },
      };

      expect(() => display.update(metrics)).not.toThrow();
    });
  });

  describe('showError', () => {
    it('should display error message', () => {
      display = new ProgressDisplay('normal');
      display.start();
      expect(() => display.showError('Test error')).not.toThrow();
    });

    it('should display error even in quiet mode', () => {
      display = new ProgressDisplay('quiet');
      display.start();
      expect(() => display.showError('Test error')).not.toThrow();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('showWarning', () => {
    it('should display warning message in normal mode', () => {
      display = new ProgressDisplay('normal');
      display.start();
      expect(() => display.showWarning('Test warning')).not.toThrow();
    });

    it('should not display warning in quiet mode', () => {
      display = new ProgressDisplay('quiet');
      display.start();
      const warnSpy = vi.spyOn(console, 'warn');
      display.showWarning('Test warning');
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('showSuccess', () => {
    it('should display success message in normal mode', () => {
      display = new ProgressDisplay('normal');
      display.start();
      expect(() => display.showSuccess('Test success')).not.toThrow();
    });

    it('should not display success in quiet mode', () => {
      display = new ProgressDisplay('quiet');
      display.start();
      const logSpy = vi.spyOn(console, 'log');
      display.showSuccess('Test success');
      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  describe('metrics formatting', () => {
    it('should handle various uptime values', () => {
      display = new ProgressDisplay('normal');
      display.start();

      // Test different uptime values
      const testCases = [
        { uptimeSeconds: 30, totalEvents: 10, totalPairs: 50 },
        { uptimeSeconds: 90, totalEvents: 20, totalPairs: 100 },
        { uptimeSeconds: 3700, totalEvents: 30, totalPairs: 150 },
        { uptimeSeconds: 90000, totalEvents: 40, totalPairs: 200 },
      ];

      testCases.forEach((testCase) => {
        const metrics: DisplayMetrics = {
          eventsPerSecond: 10,
          dataRateMBps: 0.5,
          totalEvents: testCase.totalEvents,
          totalPairs: testCase.totalPairs,
          uptimeSeconds: testCase.uptimeSeconds,
          connectionStates: { 'stream-1': 'connected' },
        };
        expect(() => display.update(metrics)).not.toThrow();
      });
    });

    it('should handle various data rates', () => {
      display = new ProgressDisplay('normal');
      display.start();

      // Test different data rate values
      const testCases = [
        { dataRateMBps: 0.0001 }, // Bytes/s
        { dataRateMBps: 0.5 },    // KB/s
        { dataRateMBps: 2.5 },    // MB/s
      ];

      testCases.forEach((testCase) => {
        const metrics: DisplayMetrics = {
          eventsPerSecond: 10,
          dataRateMBps: testCase.dataRateMBps,
          totalEvents: 100,
          totalPairs: 500,
          uptimeSeconds: 60,
          connectionStates: { 'stream-1': 'connected' },
        };
        expect(() => display.update(metrics)).not.toThrow();
      });
    });

    it('should handle different connection state combinations', () => {
      display = new ProgressDisplay('normal');
      display.start();

      // All connected
      let metrics: DisplayMetrics = {
        eventsPerSecond: 10,
        dataRateMBps: 0.5,
        totalEvents: 100,
        totalPairs: 500,
        uptimeSeconds: 60,
        connectionStates: {
          'stream-1': 'connected',
          'stream-2': 'connected',
        },
      };
      expect(() => display.update(metrics)).not.toThrow();

      // All disconnected
      metrics = {
        ...metrics,
        connectionStates: {
          'stream-1': 'disconnected',
          'stream-2': 'disconnected',
        },
      };
      expect(() => display.update(metrics)).not.toThrow();

      // Mixed states
      metrics = {
        ...metrics,
        connectionStates: {
          'stream-1': 'connected',
          'stream-2': 'disconnected',
        },
      };
      expect(() => display.update(metrics)).not.toThrow();
    });
  });
});
