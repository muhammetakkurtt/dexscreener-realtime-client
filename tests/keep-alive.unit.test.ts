import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KeepAliveManager, clearManagerRegistry } from '../src/utils/keep-alive';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('KeepAliveManager', () => {
  const baseUrl = 'https://test-actor.apify.actor';
  const apiToken = 'test-api-token';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    clearManagerRegistry();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    vi.useRealTimers();
    clearManagerRegistry();
  });

  describe('Registration and Unregistration', () => {
    it('should register a stream and track it as active', () => {
      const manager = new KeepAliveManager(baseUrl, apiToken);
      manager.register('stream-1');
      expect(manager.hasStream('stream-1')).toBe(true);
      expect(manager.getActiveStreamCount()).toBe(1);
    });

    it('should unregister a stream and remove it from active', () => {
      const manager = new KeepAliveManager(baseUrl, apiToken);
      manager.register('stream-1');
      manager.unregister('stream-1');
      expect(manager.hasStream('stream-1')).toBe(false);
      expect(manager.getActiveStreamCount()).toBe(0);
    });

    it('should track multiple streams independently', () => {
      const manager = new KeepAliveManager(baseUrl, apiToken);
      manager.register('stream-1');
      manager.register('stream-2');
      manager.register('stream-3');
      expect(manager.getActiveStreamCount()).toBe(3);
      expect(manager.hasStream('stream-1')).toBe(true);
      expect(manager.hasStream('stream-2')).toBe(true);
      expect(manager.hasStream('stream-3')).toBe(true);
    });

    it('should handle unregistering non-existent stream gracefully', () => {
      const manager = new KeepAliveManager(baseUrl, apiToken);
      expect(() => manager.unregister('non-existent')).not.toThrow();
      expect(manager.getActiveStreamCount()).toBe(0);
    });

    it('should not duplicate stream registration', () => {
      const manager = new KeepAliveManager(baseUrl, apiToken);
      manager.register('stream-1');
      manager.register('stream-1');
      manager.register('stream-1');
      expect(manager.getActiveStreamCount()).toBe(1);
    });

    it('should share manager for same baseUrl and apiToken via getOrCreate', () => {
      const manager1 = KeepAliveManager.getOrCreate(baseUrl, apiToken);
      const manager2 = KeepAliveManager.getOrCreate(baseUrl, apiToken);
      expect(manager1).toBe(manager2);
    });

    it('should share manager for baseUrl with trailing slash', () => {
      const manager1 = KeepAliveManager.getOrCreate(baseUrl, apiToken);
      const manager2 = KeepAliveManager.getOrCreate(baseUrl + '/', apiToken);
      expect(manager1).toBe(manager2);
    });

    it('should create separate managers for different baseUrls', () => {
      const manager1 = KeepAliveManager.getOrCreate('https://actor1.apify.actor', apiToken);
      const manager2 = KeepAliveManager.getOrCreate('https://actor2.apify.actor', apiToken);
      expect(manager1).not.toBe(manager2);
    });
  });

  describe('Health Check Interval', () => {
    it('should start health checks when first stream is registered', async () => {
      const manager = new KeepAliveManager(baseUrl, apiToken, 60000);
      manager.register('stream-1');
      await Promise.resolve();
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/health`,
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should include Authorization header in health check', async () => {
      const manager = new KeepAliveManager(baseUrl, apiToken, 60000);
      manager.register('stream-1');
      await Promise.resolve();
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/health`,
        expect.objectContaining({
          headers: { 'Authorization': `Bearer ${apiToken}` }
        })
      );
    });

    it('should use default interval of 120000ms when not configured', async () => {
      const manager = new KeepAliveManager(baseUrl, apiToken);
      manager.register('stream-1');
      await Promise.resolve();
      const initialCalls = mockFetch.mock.calls.length;
      expect(initialCalls).toBeGreaterThanOrEqual(1);
      await vi.advanceTimersByTimeAsync(100000);
      expect(mockFetch).toHaveBeenCalledTimes(initialCalls);
      await vi.advanceTimersByTimeAsync(20000);
      expect(mockFetch).toHaveBeenCalledTimes(initialCalls + 1);
    });

    it('should use custom interval when configured', async () => {
      const customInterval = 30000;
      const manager = new KeepAliveManager(baseUrl, apiToken, customInterval);
      manager.register('stream-1');
      await Promise.resolve();
      const initialCalls = mockFetch.mock.calls.length;
      await vi.advanceTimersByTimeAsync(customInterval);
      expect(mockFetch).toHaveBeenCalledTimes(initialCalls + 1);
      await vi.advanceTimersByTimeAsync(customInterval);
      expect(mockFetch).toHaveBeenCalledTimes(initialCalls + 2);
    });

    it('should stop health checks when last stream is unregistered', async () => {
      const manager = new KeepAliveManager(baseUrl, apiToken, 30000);
      manager.register('stream-1');
      await Promise.resolve();
      const callsAfterRegister = mockFetch.mock.calls.length;
      manager.unregister('stream-1');
      await vi.advanceTimersByTimeAsync(60000);
      expect(mockFetch).toHaveBeenCalledTimes(callsAfterRegister);
    });

    it('should continue health checks while any stream is active', async () => {
      const manager = new KeepAliveManager(baseUrl, apiToken, 30000);
      manager.register('stream-1');
      manager.register('stream-2');
      await Promise.resolve();
      const initialCalls = mockFetch.mock.calls.length;
      manager.unregister('stream-1');
      await vi.advanceTimersByTimeAsync(30000);
      expect(mockFetch).toHaveBeenCalledTimes(initialCalls + 1);
    });

    it('should stop health checks when stop() is called', async () => {
      const manager = new KeepAliveManager(baseUrl, apiToken, 30000);
      manager.register('stream-1');
      await Promise.resolve();
      const callsAfterRegister = mockFetch.mock.calls.length;
      manager.stop();
      await vi.advanceTimersByTimeAsync(60000);
      expect(mockFetch).toHaveBeenCalledTimes(callsAfterRegister);
    });

    it('should not start duplicate health check intervals', async () => {
      const manager = new KeepAliveManager(baseUrl, apiToken, 30000);
      manager.register('stream-1');
      manager.register('stream-2');
      manager.register('stream-3');
      await Promise.resolve();
      const initialCalls = mockFetch.mock.calls.length;
      expect(initialCalls).toBe(1);
      await vi.advanceTimersByTimeAsync(30000);
      expect(mockFetch).toHaveBeenCalledTimes(initialCalls + 1);
    });
  });

  describe('Failure Handling', () => {
    it('should log warning on health check failure without stopping', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      const manager = new KeepAliveManager(baseUrl, apiToken, 30000);
      manager.register('stream-1');
      await Promise.resolve();
      await Promise.resolve();
      expect(mockConsoleWarn).toHaveBeenCalled();
      expect(manager.hasStream('stream-1')).toBe(true);
    });

    it('should continue health checks after failure', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({ ok: true, status: 200 });
      const manager = new KeepAliveManager(baseUrl, apiToken, 30000);
      manager.register('stream-1');
      await Promise.resolve();
      const initialCalls = mockFetch.mock.calls.length;
      await vi.advanceTimersByTimeAsync(30000);
      expect(mockFetch).toHaveBeenCalledTimes(initialCalls + 1);
    });

    it('should log warning on non-2xx status code', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });
      const manager = new KeepAliveManager(baseUrl, apiToken, 30000);
      manager.register('stream-1');
      await Promise.resolve();
      await Promise.resolve();
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Health check warning')
      );
    });

    it('should not tear down streams on repeated failures', async () => {
      mockFetch.mockRejectedValue(new Error('Persistent failure'));
      const manager = new KeepAliveManager(baseUrl, apiToken, 30000);
      manager.register('stream-1');
      manager.register('stream-2');
      await Promise.resolve();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(30000);
      await vi.advanceTimersByTimeAsync(30000);
      expect(manager.getActiveStreamCount()).toBe(2);
      expect(manager.hasStream('stream-1')).toBe(true);
      expect(manager.hasStream('stream-2')).toBe(true);
    });
  });

  describe('URL Sanitization', () => {
    it('should sanitize baseUrl with trailing slash', async () => {
      const manager = new KeepAliveManager(baseUrl + '/', apiToken, 30000);
      manager.register('stream-1');
      await vi.runOnlyPendingTimersAsync();
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/health`,
        expect.any(Object)
      );
    });

    it('should sanitize baseUrl with multiple trailing slashes', async () => {
      const manager = new KeepAliveManager(baseUrl + '///', apiToken, 30000);
      manager.register('stream-1');
      await vi.runOnlyPendingTimersAsync();
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/health`,
        expect.any(Object)
      );
    });
  });

  describe('clearManagerRegistry', () => {
    it('should stop all managers and clear registry', async () => {
      const manager1 = KeepAliveManager.getOrCreate('https://actor1.apify.actor', apiToken, 30000);
      const manager2 = KeepAliveManager.getOrCreate('https://actor2.apify.actor', apiToken, 30000);
      manager1.register('stream-1');
      manager2.register('stream-2');
      await Promise.resolve();
      const initialCalls = mockFetch.mock.calls.length;
      expect(initialCalls).toBe(2);
      clearManagerRegistry();
      await vi.advanceTimersByTimeAsync(60000);
      expect(mockFetch).toHaveBeenCalledTimes(initialCalls);
      const manager3 = KeepAliveManager.getOrCreate('https://actor1.apify.actor', apiToken, 30000);
      expect(manager3).not.toBe(manager1);
    });
  });
});
