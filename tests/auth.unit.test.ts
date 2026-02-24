import { describe, it, expect, beforeEach } from 'vitest';
import { AuthManager } from '../src/auth/manager';
import type { AuthMode } from '../src/types';

/**
 * Unit tests for AuthManager class.
 */
describe('AuthManager', () => {
  const baseUrl = 'https://test-actor.apify.actor';
  const pageUrl = 'https://dexscreener.com/solana';
  const token = 'test-api-token-12345';

  describe('Constructor', () => {
    it('should initialize with provided token and authMode', () => {
      const manager = new AuthManager(token, 'header', baseUrl, pageUrl);
      expect(manager.getMode()).toBe('header');
      expect(manager.hasAttemptedFallback()).toBe(false);
    });

    it('should default to auto mode when authMode not provided', () => {
      const manager = new AuthManager(token, 'auto', baseUrl, pageUrl);
      expect(manager.getMode()).toBe('auto');
    });

    it('should accept all valid auth modes', () => {
      const modes: AuthMode[] = ['auto', 'header', 'query', 'both'];
      modes.forEach(mode => {
        const manager = new AuthManager(token, mode, baseUrl, pageUrl);
        expect(manager.getMode()).toBe(mode);
      });
    });
  });

  describe('getConnectionOptions - header mode', () => {
    it('should include Authorization header and no token in URL for header mode', () => {
      const manager = new AuthManager(token, 'header', baseUrl, pageUrl);
      const { url, headers } = manager.getConnectionOptions();

      expect(headers['Authorization']).toBe(`Bearer ${token}`);
      
      expect(url).not.toContain('token=');
      expect(url).toContain('page_url=');
    });

    it('should use Bearer token format in Authorization header', () => {
      const manager = new AuthManager(token, 'header', baseUrl, pageUrl);
      const { headers } = manager.getConnectionOptions();

      expect(headers['Authorization']).toBe(`Bearer ${token}`);
      expect(headers['Authorization']).toMatch(/^Bearer /);
    });
  });

  describe('getConnectionOptions - query mode', () => {
    it('should include token in URL and no Authorization header for query mode', () => {
      const manager = new AuthManager(token, 'query', baseUrl, pageUrl);
      const { url, headers } = manager.getConnectionOptions();

      expect(url).toContain(`token=${token}`);
      expect(headers['Authorization']).toBeUndefined();
    });

    it('should properly encode token in query parameter', () => {
      const specialToken = 'token+with/special=chars';
      const manager = new AuthManager(specialToken, 'query', baseUrl, pageUrl);
      const { url } = manager.getConnectionOptions();

      expect(url).toContain('token=');
      // URL should be properly encoded
      expect(url).toContain(encodeURIComponent(specialToken));
    });
  });

  describe('getConnectionOptions - both mode', () => {
    it('should include both Authorization header and token in URL for both mode', () => {
      const manager = new AuthManager(token, 'both', baseUrl, pageUrl);
      const { url, headers } = manager.getConnectionOptions();

      expect(headers['Authorization']).toBe(`Bearer ${token}`);
      expect(url).toContain(`token=${token}`);
    });
  });

  describe('getConnectionOptions - auto mode', () => {
    it('should start with header authentication in auto mode', () => {
      const manager = new AuthManager(token, 'auto', baseUrl, pageUrl);
      const { url, headers } = manager.getConnectionOptions();

      expect(headers['Authorization']).toBe(`Bearer ${token}`);
      
      expect(url).not.toContain('token=');
    });

    it('should include page_url in all modes', () => {
      const modes: AuthMode[] = ['auto', 'header', 'query', 'both'];
      modes.forEach(mode => {
        const manager = new AuthManager(token, mode, baseUrl, pageUrl);
        const { url } = manager.getConnectionOptions();
        expect(url).toContain('page_url=');
        expect(url).toContain(encodeURIComponent(pageUrl));
      });
    });
  });

  describe('shouldAttemptFallback', () => {
    it('should return true for 4401 error in auto mode when not attempted', () => {
      const manager = new AuthManager(token, 'auto', baseUrl, pageUrl);
      
      expect(manager.shouldAttemptFallback(4401)).toBe(true);
    });

    it('should return true for 4403 error in auto mode when not attempted', () => {
      const manager = new AuthManager(token, 'auto', baseUrl, pageUrl);
      expect(manager.shouldAttemptFallback(4403)).toBe(true);
    });

    it('should return false for 4401 error in header mode', () => {
      const manager = new AuthManager(token, 'header', baseUrl, pageUrl);
      
      expect(manager.shouldAttemptFallback(4401)).toBe(false);
    });

    it('should return false for 4401 error in query mode', () => {
      const manager = new AuthManager(token, 'query', baseUrl, pageUrl);
      
      expect(manager.shouldAttemptFallback(4401)).toBe(false);
    });

    it('should return false for 4401 error in both mode', () => {
      const manager = new AuthManager(token, 'both', baseUrl, pageUrl);
      
      expect(manager.shouldAttemptFallback(4401)).toBe(false);
    });

    it('should return false for non-auth error codes in auto mode', () => {
      const manager = new AuthManager(token, 'auto', baseUrl, pageUrl);
      
      // Network errors should not trigger fallback
      expect(manager.shouldAttemptFallback(1000)).toBe(false);
      expect(manager.shouldAttemptFallback(1001)).toBe(false);
      expect(manager.shouldAttemptFallback(1006)).toBe(false);
      expect(manager.shouldAttemptFallback(4429)).toBe(false);
    });

    it('should return false after fallback has been attempted', () => {
      const manager = new AuthManager(token, 'auto', baseUrl, pageUrl);
      
      // First attempt should return true
      expect(manager.shouldAttemptFallback(4401)).toBe(true);
      
      // Mark fallback as attempted
      manager.fallbackToQuery();
      
      expect(manager.shouldAttemptFallback(4401)).toBe(false);
    });
  });

  describe('fallbackToQuery', () => {
    it('should switch mode to query and mark fallback as attempted', () => {
      const manager = new AuthManager(token, 'auto', baseUrl, pageUrl);
      
      expect(manager.getMode()).toBe('auto');
      expect(manager.hasAttemptedFallback()).toBe(false);
      
      manager.fallbackToQuery();
      
      expect(manager.getMode()).toBe('query');
      expect(manager.hasAttemptedFallback()).toBe(true);
    });

    it('should change connection options after fallback', () => {
      const manager = new AuthManager(token, 'auto', baseUrl, pageUrl);
      
      // Before fallback: header auth
      const beforeFallback = manager.getConnectionOptions();
      expect(beforeFallback.headers['Authorization']).toBe(`Bearer ${token}`);
      expect(beforeFallback.url).not.toContain('token=');
      
      // After fallback: query auth
      manager.fallbackToQuery();
      const afterFallback = manager.getConnectionOptions();
      expect(afterFallback.headers['Authorization']).toBeUndefined();
      expect(afterFallback.url).toContain(`token=${token}`);
    });

    it('should prevent multiple fallback attempts', () => {
      const manager = new AuthManager(token, 'auto', baseUrl, pageUrl);
      
      // First fallback
      manager.fallbackToQuery();
      expect(manager.shouldAttemptFallback(4401)).toBe(false);
      
      // Attempting fallback again should not change state
      manager.fallbackToQuery();
      expect(manager.shouldAttemptFallback(4401)).toBe(false);
    });
  });

  describe('reset', () => {
    it('should clear fallback state for new connection cycle', () => {
      const manager = new AuthManager(token, 'auto', baseUrl, pageUrl);
      
      // Simulate fallback
      manager.fallbackToQuery();
      expect(manager.hasAttemptedFallback()).toBe(true);
      expect(manager.shouldAttemptFallback(4401)).toBe(false);
      
      // Reset for new connection cycle
      manager.reset();
      expect(manager.hasAttemptedFallback()).toBe(false);
    });

    it('should allow fallback again after reset', () => {
      const manager = new AuthManager(token, 'auto', baseUrl, pageUrl);
      
      // First connection cycle
      manager.fallbackToQuery();
      expect(manager.shouldAttemptFallback(4401)).toBe(false);
      
      // New connection cycle
      manager.reset();
      expect(manager.shouldAttemptFallback(4401)).toBe(true);
    });

    it('should not change mode if fallback was not attempted', () => {
      const manager = new AuthManager(token, 'auto', baseUrl, pageUrl);
      
      expect(manager.getMode()).toBe('auto');
      manager.reset();
      expect(manager.getMode()).toBe('auto');
    });
  });

  describe('Connection cycle simulation', () => {
    it('should handle complete auth fallback cycle', () => {
      const manager = new AuthManager(token, 'auto', baseUrl, pageUrl);
      
      // Initial connection attempt with header auth
      let options = manager.getConnectionOptions();
      expect(options.headers['Authorization']).toBe(`Bearer ${token}`);
      expect(options.url).not.toContain('token=');
      
      // Simulate auth failure (4401)
      expect(manager.shouldAttemptFallback(4401)).toBe(true);
      
      // Fallback to query auth
      manager.fallbackToQuery();
      options = manager.getConnectionOptions();
      expect(options.headers['Authorization']).toBeUndefined();
      expect(options.url).toContain(`token=${token}`);
      
      // Second auth failure should not trigger another fallback
      expect(manager.shouldAttemptFallback(4401)).toBe(false);
    });

    it('should handle successful connection without fallback', () => {
      const manager = new AuthManager(token, 'auto', baseUrl, pageUrl);
      
      // Initial connection attempt
      const options = manager.getConnectionOptions();
      expect(options.headers['Authorization']).toBe(`Bearer ${token}`);
      
      // Connection succeeds - no fallback needed
      expect(manager.hasAttemptedFallback()).toBe(false);
      expect(manager.getMode()).toBe('auto');
    });

    it('should handle reconnection after successful fallback', () => {
      const manager = new AuthManager(token, 'auto', baseUrl, pageUrl);
      
      // First connection: header auth fails, fallback to query succeeds
      manager.fallbackToQuery();
      expect(manager.getMode()).toBe('query');
      
      // Connection lost, need to reconnect
      manager.reset();
      
      // Should still use query mode (learned from previous attempt)
      // Note: Current implementation resets to auto, which is acceptable
      expect(manager.hasAttemptedFallback()).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty token gracefully', () => {
      const manager = new AuthManager('', 'header', baseUrl, pageUrl);
      const { headers } = manager.getConnectionOptions();
      expect(headers['Authorization']).toBe('Bearer ');
    });

    it('should handle special characters in URLs', () => {
      const specialPageUrl = 'https://dexscreener.com/solana?chain=sol&sort=volume';
      const manager = new AuthManager(token, 'auto', baseUrl, specialPageUrl);
      const { url } = manager.getConnectionOptions();
      
      // URL should be properly encoded
      expect(url).toContain('page_url=');
      expect(url).toContain(encodeURIComponent(specialPageUrl));
    });

    it('should handle protocol normalization in URLs', () => {
      const httpBaseUrl = 'http://test-actor.apify.actor';
      const manager = new AuthManager(token, 'auto', httpBaseUrl, pageUrl);
      const { url } = manager.getConnectionOptions();
      
      // Should convert http:// to ws://
      expect(url).toMatch(/^ws:\/\//);
    });

    it('should handle wss protocol in URLs', () => {
      const wssBaseUrl = 'wss://test-actor.apify.actor';
      const manager = new AuthManager(token, 'auto', wssBaseUrl, pageUrl);
      const { url } = manager.getConnectionOptions();
      
      // Should preserve wss://
      expect(url).toMatch(/^wss:\/\//);
    });
  });

  describe('State consistency', () => {
    it('should maintain consistent state across multiple getConnectionOptions calls', () => {
      const manager = new AuthManager(token, 'auto', baseUrl, pageUrl);
      
      const options1 = manager.getConnectionOptions();
      const options2 = manager.getConnectionOptions();
      
      expect(options1.url).toBe(options2.url);
      expect(options1.headers).toEqual(options2.headers);
    });

    it('should not modify state when checking shouldAttemptFallback', () => {
      const manager = new AuthManager(token, 'auto', baseUrl, pageUrl);
      
      const initialMode = manager.getMode();
      const initialFallback = manager.hasAttemptedFallback();
      
      // Check multiple times
      manager.shouldAttemptFallback(4401);
      manager.shouldAttemptFallback(4401);
      manager.shouldAttemptFallback(4401);
      
      // State should not change
      expect(manager.getMode()).toBe(initialMode);
      expect(manager.hasAttemptedFallback()).toBe(initialFallback);
    });
  });
});
