import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KeepAliveManager, clearManagerRegistry } from '../src/utils/keep-alive';

/**
 * Unit tests for KeepAliveManager class.
 */
describe('KeepAliveManager', () => {
  const baseUrl = 'https://test-actor.apify.actor';
  const wsBaseUrl = 'ws://test-actor.apify.actor';
  const wssBaseUrl = 'wss://test-actor.apify.actor';
  const apiToken = 'test-api-token-12345';
  const intervalMs = 1000; // 1 second for testing

  // Mock fetch globally
  const mockFetch = vi.fn();
  global.fetch = mockFetch as any;

  beforeEach(() => {
    clearManagerRegistry();
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    clearManagerRegistry();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Constructor', () => {
    it('should initialize with provided parameters', () => {
      const manager = new KeepAliveManager(baseUrl, apiToken, intervalMs);
      
      expect(manager.getActiveStreamCount()).toBe(0);
    });

    it('should use default interval when not provided', () => {
      const manager = new KeepAliveManager(baseUrl, apiToken);
      
      expect(manager.getActiveStreamCount()).toBe(0);
    });

    it('should sanitize base URL by removing trailing slashes', () => {
      const urlWithSlashes = 'https://test-actor.apify.actor///';
      const manager = new KeepAliveManager(urlWithSlashes, apiToken, intervalMs);
      
      manager.register('test-stream');
      vi.advanceTimersByTime(100);
      
      // Health check should use sanitized URL
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/^https:\/\/test-actor\.apify\.actor\/health$/),
        expect.any(Object)
      );
    });
  });

  describe('getOrCreate - Singleton Pattern', () => {
    it('should create new manager for unique baseUrl+token combination', () => {
      const manager1 = KeepAliveManager.getOrCreate(baseUrl, apiToken, intervalMs);
      const manager2 = KeepAliveManager.getOrCreate('https://other-actor.apify.actor', apiToken, intervalMs);
      
      expect(manager1).not.toBe(manager2);
    });

    it('should return same manager for identical baseUrl+token combination', () => {
      const manager1 = KeepAliveManager.getOrCreate(baseUrl, apiToken, intervalMs);
      const manager2 = KeepAliveManager.getOrCreate(baseUrl, apiToken, intervalMs);
      
      expect(manager1).toBe(manager2);
    });

    it('should create different managers for same baseUrl but different tokens', () => {
      const manager1 = KeepAliveManager.getOrCreate(baseUrl, 'token1', intervalMs);
      const manager2 = KeepAliveManager.getOrCreate(baseUrl, 'token2', intervalMs);
      
      expect(manager1).not.toBe(manager2);
    });

    it('should normalize URLs with trailing slashes for registry key', () => {
      const manager1 = KeepAliveManager.getOrCreate('https://test-actor.apify.actor', apiToken, intervalMs);
      const manager2 = KeepAliveManager.getOrCreate('https://test-actor.apify.actor///', apiToken, intervalMs);
      
      expect(manager1).toBe(manager2);
    });
  });

  describe('Lifecycle Management', () => {
    it('should start health checks when first stream registers', () => {
      const manager = new KeepAliveManager(baseUrl, apiToken, intervalMs);
      
      expect(mockFetch).not.toHaveBeenCalled();
      
      manager.register('stream-1');
      
      // Should perform immediate health check
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should not start duplicate health checks when second stream registers', () => {
      const manager = new KeepAliveManager(baseUrl, apiToken, intervalMs);
      
      manager.register('stream-1');
      mockFetch.mockClear();
      
      manager.register('stream-2');
      
      // Should not trigger additional immediate health check
      expect(mockFetch).not.toHaveBeenCalled();
      expect(manager.getActiveStreamCount()).toBe(2);
    });

    it('should stop health checks when last stream unregisters', () => {
      const manager = new KeepAliveManager(baseUrl, apiToken, intervalMs);
      
      manager.register('stream-1');
      manager.register('stream-2');
      
      mockFetch.mockClear();
      
      // Unregister first stream - health checks should continue
      manager.unregister('stream-1');
      vi.advanceTimersByTime(intervalMs);
      expect(mockFetch).toHaveBeenCalled();
      
      mockFetch.mockClear();
      
      // Unregister last stream - health checks should stop
      manager.unregister('stream-2');
      vi.advanceTimersByTime(intervalMs * 2);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should continue health checks while at least one stream is active', () => {
      const manager = new KeepAliveManager(baseUrl, apiToken, intervalMs);
      
      manager.register('stream-1');
      manager.register('stream-2');
      manager.register('stream-3');
      
      mockFetch.mockClear();
      
      manager.unregister('stream-1');
      manager.unregister('stream-2');
      
      // One stream still active - health checks should continue
      vi.advanceTimersByTime(intervalMs);
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('Health Check Timing', () => {
    it('should use keepAliveMs interval for health check timing', () => {
      const manager = new KeepAliveManager(baseUrl, apiToken, intervalMs);
      
      manager.register('stream-1');
      mockFetch.mockClear();
      
      // Advance time by interval - should trigger health check
      vi.advanceTimersByTime(intervalMs);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      // Advance again - should trigger another health check
      vi.advanceTimersByTime(intervalMs);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      // Advance again - should trigger another health check
      vi.advanceTimersByTime(intervalMs);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should perform immediate health check on first registration', () => {
      const manager = new KeepAliveManager(baseUrl, apiToken, intervalMs);
      
      manager.register('stream-1');
      
      // Should have performed immediate health check
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should respect custom interval timing', () => {
      const customInterval = 5000;
      const manager = new KeepAliveManager(baseUrl, apiToken, customInterval);
      
      manager.register('stream-1');
      mockFetch.mockClear();
      
      // Advance by less than interval - no health check
      vi.advanceTimersByTime(customInterval - 100);
      expect(mockFetch).not.toHaveBeenCalled();
      
      // Advance to reach interval - health check triggered
      vi.advanceTimersByTime(100);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Protocol Mapping', () => {
    it('should map ws:// to http:// for health endpoint', () => {
      const manager = new KeepAliveManager(wsBaseUrl, apiToken, intervalMs);
      
      manager.register('stream-1');
      
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-actor.apify.actor/health',
        expect.any(Object)
      );
    });

    it('should map wss:// to https:// for health endpoint', () => {
      const manager = new KeepAliveManager(wssBaseUrl, apiToken, intervalMs);
      
      manager.register('stream-1');
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-actor.apify.actor/health',
        expect.any(Object)
      );
    });

    it('should preserve http:// protocol for health endpoint', () => {
      const httpUrl = 'http://test-actor.apify.actor';
      const manager = new KeepAliveManager(httpUrl, apiToken, intervalMs);
      
      manager.register('stream-1');
      
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-actor.apify.actor/health',
        expect.any(Object)
      );
    });

    it('should preserve https:// protocol for health endpoint', () => {
      const manager = new KeepAliveManager(baseUrl, apiToken, intervalMs);
      
      manager.register('stream-1');
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-actor.apify.actor/health',
        expect.any(Object)
      );
    });

    it('should always use /health path regardless of base URL path', () => {
      const urlWithPath = 'https://test-actor.apify.actor/some/path';
      const manager = new KeepAliveManager(urlWithPath, apiToken, intervalMs);
      
      manager.register('stream-1');
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-actor.apify.actor/health',
        expect.any(Object)
      );
    });
  });

  describe('Health Check Request Format', () => {
    it('should send GET request to health endpoint', () => {
      const manager = new KeepAliveManager(baseUrl, apiToken, intervalMs);
      
      manager.register('stream-1');
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should include Authorization header with Bearer token', () => {
      const manager = new KeepAliveManager(baseUrl, apiToken, intervalMs);
      
      manager.register('stream-1');
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${apiToken}`,
          }),
        })
      );
    });

    it('should include timeout signal', () => {
      const manager = new KeepAliveManager(baseUrl, apiToken, intervalMs);
      
      manager.register('stream-1');
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(Object),
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should not throw error on health check failure', () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      const manager = new KeepAliveManager(baseUrl, apiToken, intervalMs);
      
      // Should not throw
      expect(() => {
        manager.register('stream-1');
      }).not.toThrow();
    });

    it('should continue health checks after failure', () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      const manager = new KeepAliveManager(baseUrl, apiToken, intervalMs);
      manager.register('stream-1');
      
      mockFetch.mockClear();
      
      // Health checks should continue despite failure
      vi.advanceTimersByTime(intervalMs);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should continue health checks after non-200 response', () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });
      
      const manager = new KeepAliveManager(baseUrl, apiToken, intervalMs);
      manager.register('stream-1');
      
      mockFetch.mockClear();
      
      // Health checks should continue despite non-200 response
      vi.advanceTimersByTime(intervalMs);
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('Stream Management', () => {
    it('should track active stream count correctly', () => {
      const manager = new KeepAliveManager(baseUrl, apiToken, intervalMs);
      
      expect(manager.getActiveStreamCount()).toBe(0);
      
      manager.register('stream-1');
      expect(manager.getActiveStreamCount()).toBe(1);
      
      manager.register('stream-2');
      expect(manager.getActiveStreamCount()).toBe(2);
      
      manager.unregister('stream-1');
      expect(manager.getActiveStreamCount()).toBe(1);
      
      manager.unregister('stream-2');
      expect(manager.getActiveStreamCount()).toBe(0);
    });

    it('should check if stream is registered', () => {
      const manager = new KeepAliveManager(baseUrl, apiToken, intervalMs);
      
      expect(manager.hasStream('stream-1')).toBe(false);
      
      manager.register('stream-1');
      expect(manager.hasStream('stream-1')).toBe(true);
      
      manager.unregister('stream-1');
      expect(manager.hasStream('stream-1')).toBe(false);
    });

    it('should handle duplicate registrations idempotently', () => {
      const manager = new KeepAliveManager(baseUrl, apiToken, intervalMs);
      
      manager.register('stream-1');
      manager.register('stream-1');
      manager.register('stream-1');
      
      expect(manager.getActiveStreamCount()).toBe(1);
      expect(manager.hasStream('stream-1')).toBe(true);
    });

    it('should handle unregistering non-existent stream gracefully', () => {
      const manager = new KeepAliveManager(baseUrl, apiToken, intervalMs);
      
      expect(() => {
        manager.unregister('non-existent-stream');
      }).not.toThrow();
      
      expect(manager.getActiveStreamCount()).toBe(0);
    });
  });

  describe('stop() Method', () => {
    it('should stop all health checks', () => {
      const manager = new KeepAliveManager(baseUrl, apiToken, intervalMs);
      
      manager.register('stream-1');
      mockFetch.mockClear();
      
      manager.stop();
      
      // Advance time - no health checks should occur
      vi.advanceTimersByTime(intervalMs * 3);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should be safe to call multiple times', () => {
      const manager = new KeepAliveManager(baseUrl, apiToken, intervalMs);
      
      manager.register('stream-1');
      
      expect(() => {
        manager.stop();
        manager.stop();
        manager.stop();
      }).not.toThrow();
    });

    it('should be safe to call when no health checks are active', () => {
      const manager = new KeepAliveManager(baseUrl, apiToken, intervalMs);
      
      expect(() => {
        manager.stop();
      }).not.toThrow();
    });
  });

  describe('clearManagerRegistry', () => {
    it('should stop all managers and clear registry', () => {
      const manager1 = KeepAliveManager.getOrCreate(baseUrl, apiToken, intervalMs);
      const manager2 = KeepAliveManager.getOrCreate('https://other-actor.apify.actor', apiToken, intervalMs);
      
      manager1.register('stream-1');
      manager2.register('stream-2');
      
      mockFetch.mockClear();
      
      clearManagerRegistry();
      
      // Advance time - no health checks should occur
      vi.advanceTimersByTime(intervalMs * 3);
      expect(mockFetch).not.toHaveBeenCalled();
      
      // New managers should be created after clearing
      const manager3 = KeepAliveManager.getOrCreate(baseUrl, apiToken, intervalMs);
      expect(manager3).not.toBe(manager1);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle multiple streams with same baseUrl sharing one manager', () => {
      const manager = KeepAliveManager.getOrCreate(baseUrl, apiToken, intervalMs);
      
      manager.register('stream-1');
      manager.register('stream-2');
      manager.register('stream-3');
      
      mockFetch.mockClear();
      
      // Only one health check per interval despite multiple streams
      vi.advanceTimersByTime(intervalMs);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle stream lifecycle: register, unregister, re-register', () => {
      const manager = new KeepAliveManager(baseUrl, apiToken, intervalMs);
      
      // First lifecycle
      manager.register('stream-1');
      expect(manager.getActiveStreamCount()).toBe(1);
      
      manager.unregister('stream-1');
      expect(manager.getActiveStreamCount()).toBe(0);
      
      mockFetch.mockClear();
      
      // Health checks should have stopped
      vi.advanceTimersByTime(intervalMs);
      expect(mockFetch).not.toHaveBeenCalled();
      
      // Second lifecycle
      manager.register('stream-1');
      expect(manager.getActiveStreamCount()).toBe(1);
      
      // Health checks should have restarted
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle rapid register/unregister cycles', () => {
      const manager = new KeepAliveManager(baseUrl, apiToken, intervalMs);
      
      for (let i = 0; i < 10; i++) {
        manager.register(`stream-${i}`);
      }
      
      expect(manager.getActiveStreamCount()).toBe(10);
      
      for (let i = 0; i < 10; i++) {
        manager.unregister(`stream-${i}`);
      }
      
      expect(manager.getActiveStreamCount()).toBe(0);
      
      mockFetch.mockClear();
      
      // Health checks should have stopped
      vi.advanceTimersByTime(intervalMs);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
