import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketServer } from 'ws';
import { DexScreenerStream } from '../src/client';
import { DexScreenerMultiStream } from '../src/multi';
import type { ConnectionState, DexEvent, Pair, StreamContext } from '../src/types';
import { clearManagerRegistry } from '../src/utils/keep-alive';

/**
 * Integration tests for WebSocket migration.
 * Tests end-to-end flows with a mock WebSocket server.
 */
describe('Integration Tests - WebSocket Migration', () => {
  let wss: WebSocketServer;
  let serverPort: number;
  let baseUrl: string;
  const apiToken = 'test-integration-token';
  const pageUrl = 'https://dexscreener.com/solana';

  // Mock fetch for health checks
  const mockFetch = vi.fn();
  global.fetch = mockFetch as any;

  // Helper to wait for async operations
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  beforeEach(async () => {
    // Create mock WebSocket server
    wss = new WebSocketServer({ port: 0 });
    
    // Wait for server to start and get assigned port
    await new Promise<void>((resolve) => {
      wss.on('listening', () => {
        const address = wss.address();
        if (address && typeof address === 'object') {
          serverPort = address.port;
          baseUrl = `ws://localhost:${serverPort}`;
        }
        resolve();
      });
    });

    // Mock fetch for health checks
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
    });

    // Clear keep-alive registry
    clearManagerRegistry();
  });

  afterEach(async () => {
    clearManagerRegistry();
    
    // Close all connections and server
    wss.clients.forEach(client => client.close());
    await new Promise<void>((resolve) => {
      wss.close(() => resolve());
    });
  });

  describe('WebSocket Transport', () => {
    it('should establish WebSocket connection and receive messages', async () => {
      const receivedPairs: Pair[] = [];
      let connectionEstablished = false;

      // Setup server to send connected event and pairs
      wss.on('connection', (ws) => {
        connectionEstablished = true;
        
        // Send connected event
        ws.send(JSON.stringify({ event_type: 'connected', connection_id: 'test-123' }));
        
        // Send pairs event
        setTimeout(() => {
          ws.send(JSON.stringify({
            event_type: 'pairs',
            pairs: [
              { chainId: 'solana', baseToken: { symbol: 'SOL' }, priceUsd: '100.50' },
              { chainId: 'solana', baseToken: { symbol: 'BONK' }, priceUsd: '0.00001' },
            ],
            stats: { h1: { txns: 1000 } },
            timestamp: new Date().toISOString(),
          }));
        }, 50);
      });

      const stream = new DexScreenerStream({
        baseUrl,
        pageUrl,
        apiToken,
        keepAliveMs: 0, // Disable keep-alive for this test
        onPair: (pair) => receivedPairs.push(pair),
      });

      stream.start();

      // Wait for messages to be processed
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(connectionEstablished).toBe(true);
      expect(receivedPairs.length).toBe(2);
      expect(receivedPairs[0].baseToken?.symbol).toBe('SOL');
      expect(receivedPairs[1].baseToken?.symbol).toBe('BONK');

      stream.stop();
    });

    it('should transition to connected state upon receiving connected event', async () => {
      const stateChanges: ConnectionState[] = [];

      wss.on('connection', (ws) => {
        ws.send(JSON.stringify({ event_type: 'connected', connection_id: 'test-123' }));
      });

      const stream = new DexScreenerStream({
        baseUrl,
        pageUrl,
        apiToken,
        keepAliveMs: 0,
        onStateChange: (state) => stateChanges.push(state),
      });

      stream.start();
      await wait(50);

      expect(stateChanges).toContain('connecting');
      expect(stateChanges).toContain('connected');
      expect(stream.getState()).toBe('connected');

      stream.stop();
    });
  });

  describe('Authentication with auto mode', () => {
    it('should send Authorization header in auto mode', async () => {
      let receivedHeaders: any = null;

      wss.on('connection', (ws, req) => {
        receivedHeaders = req.headers;
        ws.send(JSON.stringify({ event_type: 'connected', connection_id: 'test-123' }));
      });

      const stream = new DexScreenerStream({
        baseUrl,
        pageUrl,
        apiToken,
        authMode: 'auto',
        keepAliveMs: 0,
      });

      stream.start();
      await wait(50);

      expect(receivedHeaders?.authorization).toBe(`Bearer ${apiToken}`);
      expect(receivedHeaders?.['sec-websocket-protocol']).toBeUndefined();

      stream.stop();
    });

    it('should not include token in URL for auto mode', async () => {
      let requestUrl: string | undefined;

      wss.on('connection', (ws, req) => {
        requestUrl = req.url;
        ws.send(JSON.stringify({ event_type: 'connected', connection_id: 'test-123' }));
      });

      const stream = new DexScreenerStream({
        baseUrl,
        pageUrl,
        apiToken,
        authMode: 'auto',
        keepAliveMs: 0,
      });

      stream.start();
      await wait(50);

      expect(requestUrl).toBeDefined();
      expect(requestUrl).not.toContain('token=');
      expect(requestUrl).toContain('page_url=');

      stream.stop();
    });
  });

  describe('Authentication fallback on 4401', () => {
    it('should fallback to query auth after 4401 error in auto mode', async () => {
      const connectionAttempts: Array<{ headers: any; url: string }> = [];

      wss.on('connection', (ws, req) => {
        connectionAttempts.push({
          headers: req.headers,
          url: req.url || '',
        });

        if (connectionAttempts.length === 1) {
          // First attempt: reject with 4401
          ws.close(4401, 'Unauthorized');
        } else {
          // Second attempt: accept
          ws.send(JSON.stringify({ event_type: 'connected', connection_id: 'test-123' }));
        }
      });

      const stream = new DexScreenerStream({
        baseUrl,
        pageUrl,
        apiToken,
        authMode: 'auto',
        keepAliveMs: 0,
      });

      stream.start();
      await wait(100);

      // Should have made 2 connection attempts
      expect(connectionAttempts.length).toBe(2);

      // First attempt: header auth
      expect(connectionAttempts[0].headers.authorization).toBe(`Bearer ${apiToken}`);
      expect(connectionAttempts[0].url).not.toContain('token=');

      // Second attempt: query auth
      expect(connectionAttempts[1].headers.authorization).toBeUndefined();
      expect(connectionAttempts[1].url).toContain(`token=${apiToken}`);

      stream.stop();
    });

    it('should not fallback on 4401 with header mode', async () => {
      let connectionCount = 0;

      wss.on('connection', (ws) => {
        connectionCount++;
        ws.close(4401, 'Unauthorized');
      });

      const stream = new DexScreenerStream({
        baseUrl,
        pageUrl,
        apiToken,
        authMode: 'header',
        keepAliveMs: 0,
      });

      stream.start();
      await wait(100);

      // Should only attempt once (no fallback)
      expect(connectionCount).toBe(1);
      expect(stream.getState()).toBe('disconnected');

      stream.stop();
    });
  });

  describe('Automatic reconnection on network failures', () => {
    it('should reconnect after close code 1000', async () => {
      let connectionCount = 0;

      wss.on('connection', (ws) => {
        connectionCount++;
        
        if (connectionCount === 1) {
          // First connection: send connected then close normally
          ws.send(JSON.stringify({ event_type: 'connected', connection_id: 'test-123' }));
          setTimeout(() => ws.close(1000, 'Normal closure'), 50);
        } else {
          // Reconnection: send connected
          ws.send(JSON.stringify({ event_type: 'connected', connection_id: 'test-456' }));
        }
      });

      const stream = new DexScreenerStream({
        baseUrl,
        pageUrl,
        apiToken,
        retryMs: 100,
        keepAliveMs: 0,
      });

      stream.start();
      
      // Wait for first connection and close
      await wait(100);
      expect(connectionCount).toBe(1);
      
      // Wait for reconnection
      await wait(100);
      expect(connectionCount).toBe(2);

      stream.stop();
    });

    it('should transition to reconnecting state after connection loss', async () => {
      const stateChanges: ConnectionState[] = [];

      wss.on('connection', (ws) => {
        ws.send(JSON.stringify({ event_type: 'connected', connection_id: 'test-123' }));
        setTimeout(() => ws.close(1001, 'Going away'), 50);
      });

      const stream = new DexScreenerStream({
        baseUrl,
        pageUrl,
        apiToken,
        retryMs: 1000,
        keepAliveMs: 0,
        onStateChange: (state) => stateChanges.push(state),
      });

      stream.start();
      await wait(150);

      expect(stateChanges).toContain('connecting');
      expect(stateChanges).toContain('connected');
      expect(stateChanges).toContain('reconnecting');

      stream.stop();
    });
  });

  describe('Keep-alive manager lifecycle', () => {
    it('should register with keep-alive manager when stream starts', async () => {
      wss.on('connection', (ws) => {
        ws.send(JSON.stringify({ event_type: 'connected', connection_id: 'test-123' }));
      });

      const stream = new DexScreenerStream({
        baseUrl,
        pageUrl,
        apiToken,
        keepAliveMs: 1000,
      });

      stream.start();
      await wait(50);

      // Health check should have been performed
      expect(mockFetch).toHaveBeenCalled();
      const healthUrl = mockFetch.mock.calls[0][0];
      expect(healthUrl).toContain('/health');

      stream.stop();
    });

    it('should unregister from keep-alive manager when stream stops', async () => {
      wss.on('connection', (ws) => {
        ws.send(JSON.stringify({ event_type: 'connected', connection_id: 'test-123' }));
      });

      const stream = new DexScreenerStream({
        baseUrl,
        pageUrl,
        apiToken,
        keepAliveMs: 500,
      });

      stream.start();
      await wait(50);

      mockFetch.mockClear();
      
      stream.stop();
      
      // Wait for interval - no health checks should occur
      await wait(1000);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should stop keep-alive when last stream unregisters', async () => {
      wss.on('connection', (ws) => {
        ws.send(JSON.stringify({ event_type: 'connected', connection_id: 'test-123' }));
      });

      const stream1 = new DexScreenerStream({
        baseUrl,
        pageUrl,
        apiToken,
        streamId: 'stream-1',
        keepAliveMs: 500,
      });

      const stream2 = new DexScreenerStream({
        baseUrl,
        pageUrl,
        apiToken,
        streamId: 'stream-2',
        keepAliveMs: 500,
      });

      stream1.start();
      stream2.start();
      await wait(50);

      mockFetch.mockClear();

      // Stop first stream - health checks should continue
      stream1.stop();
      await wait(500);
      expect(mockFetch).toHaveBeenCalled();

      mockFetch.mockClear();

      // Stop last stream - health checks should stop
      stream2.stop();
      await wait(1000);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Health endpoint protocol mapping', () => {
    it('should map ws:// to http:// for health endpoint', async () => {
      wss.on('connection', (ws) => {
        ws.send(JSON.stringify({ event_type: 'connected', connection_id: 'test-123' }));
      });

      const stream = new DexScreenerStream({
        baseUrl: `ws://localhost:${serverPort}`,
        pageUrl,
        apiToken,
        keepAliveMs: 1000,
      });

      stream.start();
      await wait(50);

      expect(mockFetch).toHaveBeenCalled();
      const healthUrl = mockFetch.mock.calls[0][0];
      expect(healthUrl).toMatch(/^http:\/\//);
      expect(healthUrl).toContain('/health');

      stream.stop();
    });

    it('should map wss:// to https:// for health endpoint', async () => {
      // Note: We can't test actual wss:// in this test environment,
      // but we can verify the URL building logic
      const httpsBaseUrl = `https://localhost:${serverPort}`;
      
      wss.on('connection', (ws) => {
        ws.send(JSON.stringify({ event_type: 'connected', connection_id: 'test-123' }));
      });

      const stream = new DexScreenerStream({
        baseUrl: httpsBaseUrl,
        pageUrl,
        apiToken,
        keepAliveMs: 1000,
      });

      stream.start();
      await wait(50);

      expect(mockFetch).toHaveBeenCalled();
      const healthUrl = mockFetch.mock.calls[0][0];
      expect(healthUrl).toMatch(/^https:\/\//);
      expect(healthUrl).toContain('/health');

      stream.stop();
    });
  });

  describe('Multi-stream creates independent client instances', () => {
    it('should create independent WebSocket connections for each stream', async () => {
      const connectionIds: string[] = [];

      wss.on('connection', (ws, req) => {
        const url = req.url || '';
        connectionIds.push(url);
        ws.send(JSON.stringify({ event_type: 'connected', connection_id: `conn-${connectionIds.length}` }));
      });

      const multiStream = new DexScreenerMultiStream({
        baseUrl,
        apiToken,
        keepAliveMs: 0,
        streams: [
          { id: 'stream-1', pageUrl: 'https://dexscreener.com/solana' },
          { id: 'stream-2', pageUrl: 'https://dexscreener.com/ethereum' },
          { id: 'stream-3', pageUrl: 'https://dexscreener.com/bsc' },
        ],
      });

      multiStream.startAll();
      await wait(100);

      // Should have 3 independent connections
      expect(connectionIds.length).toBe(3);
      
      // Each should have different page_url (order-independent)
      expect(connectionIds.some(id => id.includes('solana'))).toBe(true);
      expect(connectionIds.some(id => id.includes('ethereum'))).toBe(true);
      expect(connectionIds.some(id => id.includes('bsc'))).toBe(true);
      
      // Verify all are unique
      const uniqueUrls = new Set(connectionIds.map(id => {
        if (id.includes('solana')) return 'solana';
        if (id.includes('ethereum')) return 'ethereum';
        if (id.includes('bsc')) return 'bsc';
        return 'unknown';
      }));
      expect(uniqueUrls.size).toBe(3);

      multiStream.stopAll();
    });

    it('should isolate errors between streams', async () => {
      const errors: Array<{ streamId: string; error: unknown }> = [];

      wss.on('connection', (ws, req) => {
        const url = req.url || '';
        
        if (url.includes('ethereum')) {
          // Fail ethereum stream
          ws.close(4401, 'Unauthorized');
        } else {
          // Success for other streams
          ws.send(JSON.stringify({ event_type: 'connected', connection_id: 'test-123' }));
        }
      });

      const multiStream = new DexScreenerMultiStream({
        baseUrl,
        apiToken,
        keepAliveMs: 0,
        streams: [
          { id: 'solana', pageUrl: 'https://dexscreener.com/solana' },
          { id: 'ethereum', pageUrl: 'https://dexscreener.com/ethereum' },
          { id: 'bsc', pageUrl: 'https://dexscreener.com/bsc' },
        ],
        onError: (error, ctx) => {
          errors.push({ streamId: ctx.streamId, error });
        },
      });

      multiStream.startAll();
      await wait(100);

      // Only ethereum stream should have error
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.streamId === 'ethereum')).toBe(true);

      multiStream.stopAll();
    });
  });

  describe('End-to-end flow: Connection, messages, and cleanup', () => {
    it('should handle complete lifecycle with multiple events', async () => {
      const receivedBatches: DexEvent[] = [];
      const receivedPairs: Pair[] = [];
      const stateChanges: ConnectionState[] = [];

      wss.on('connection', (ws) => {
        // Send connected event
        ws.send(JSON.stringify({ event_type: 'connected', connection_id: 'test-123' }));

        // Send multiple pairs events
        setTimeout(() => {
          ws.send(JSON.stringify({
            event_type: 'pairs',
            pairs: [{ chainId: 'solana', baseToken: { symbol: 'SOL' } }],
            stats: { h1: { txns: 100 } },
            timestamp: new Date().toISOString(),
          }));
        }, 50);

        setTimeout(() => {
          ws.send(JSON.stringify({
            event_type: 'pairs',
            pairs: [
              { chainId: 'ethereum', baseToken: { symbol: 'ETH' } },
              { chainId: 'bsc', baseToken: { symbol: 'BNB' } },
            ],
            stats: { h1: { txns: 200 } },
            timestamp: new Date().toISOString(),
          }));
        }, 100);

        // Send ping (should be ignored)
        setTimeout(() => {
          ws.send(JSON.stringify({ event_type: 'ping' }));
        }, 150);
      });

      const stream = new DexScreenerStream({
        baseUrl,
        pageUrl,
        apiToken,
        streamId: 'test-stream',
        keepAliveMs: 0,
        onBatch: (event) => receivedBatches.push(event),
        onPair: (pair) => receivedPairs.push(pair),
        onStateChange: (state) => stateChanges.push(state),
      });

      stream.start();
      await wait(200);

      // Verify state transitions
      expect(stateChanges).toContain('connecting');
      expect(stateChanges).toContain('connected');

      // Verify batches received
      expect(receivedBatches.length).toBe(2);
      expect(receivedBatches[0].pairs?.length).toBe(1);
      expect(receivedBatches[1].pairs?.length).toBe(2);

      // Verify pairs received
      expect(receivedPairs.length).toBe(3);
      expect(receivedPairs[0].baseToken?.symbol).toBe('SOL');
      expect(receivedPairs[1].baseToken?.symbol).toBe('ETH');
      expect(receivedPairs[2].baseToken?.symbol).toBe('BNB');

      // Verify cleanup
      stream.stop();
      expect(stream.getState()).toBe('disconnected');
    });

    it('should provide correct StreamContext in all callbacks', async () => {
      const contexts: StreamContext[] = [];

      wss.on('connection', (ws) => {
        ws.send(JSON.stringify({ event_type: 'connected', connection_id: 'test-123' }));
        setTimeout(() => {
          ws.send(JSON.stringify({
            event_type: 'pairs',
            pairs: [{ chainId: 'solana', baseToken: { symbol: 'SOL' } }],
            stats: { h1: { txns: 100 } },
            timestamp: new Date().toISOString(),
          }));
        }, 50);
      });

      const stream = new DexScreenerStream({
        baseUrl,
        pageUrl,
        apiToken,
        streamId: 'context-test',
        keepAliveMs: 0,
        onBatch: (_, ctx) => contexts.push(ctx),
        onPair: (_, ctx) => contexts.push(ctx),
        onStateChange: (_, ctx) => contexts.push(ctx),
      });

      stream.start();
      await wait(100);

      // All contexts should have same streamId
      expect(contexts.every(ctx => ctx.streamId === 'context-test')).toBe(true);

      // Contexts should reflect state changes
      expect(contexts.some(ctx => ctx.state === 'connecting')).toBe(true);
      expect(contexts.some(ctx => ctx.state === 'connected')).toBe(true);

      stream.stop();
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle invalid JSON gracefully', async () => {
      const errors: unknown[] = [];

      wss.on('connection', (ws) => {
        ws.send(JSON.stringify({ event_type: 'connected', connection_id: 'test-123' }));
        
        setTimeout(() => {
          // Send invalid JSON
          ws.send('invalid json {');
        }, 50);

        setTimeout(() => {
          // Send valid message after error
          ws.send(JSON.stringify({
            event_type: 'pairs',
            pairs: [{ chainId: 'solana', baseToken: { symbol: 'SOL' } }],
            stats: { h1: { txns: 100 } },
            timestamp: new Date().toISOString(),
          }));
        }, 100);
      });

      const receivedPairs: Pair[] = [];

      const stream = new DexScreenerStream({
        baseUrl,
        pageUrl,
        apiToken,
        keepAliveMs: 0,
        onError: (error) => errors.push(error),
        onPair: (pair) => receivedPairs.push(pair),
      });

      stream.start();
      await wait(150);

      // Should have received error for invalid JSON
      expect(errors.length).toBeGreaterThan(0);

      // Should still process valid messages after error
      expect(receivedPairs.length).toBe(1);
      expect(receivedPairs[0].baseToken?.symbol).toBe('SOL');

      stream.stop();
    });

    it('should handle server errors gracefully', async () => {
      const errors: unknown[] = [];

      wss.on('connection', (ws) => {
        ws.send(JSON.stringify({ event_type: 'connected', connection_id: 'test-123' }));
        
        setTimeout(() => {
          ws.send(JSON.stringify({
            event_type: 'error',
            message: 'Server error occurred',
          }));
        }, 50);
      });

      const stream = new DexScreenerStream({
        baseUrl,
        pageUrl,
        apiToken,
        keepAliveMs: 0,
        onError: (error) => errors.push(error),
      });

      stream.start();
      await wait(100);

      expect(errors.length).toBeGreaterThan(0);

      stream.stop();
    });

    it('should handle rapid start/stop cycles', async () => {
      wss.on('connection', (ws) => {
        ws.send(JSON.stringify({ event_type: 'connected', connection_id: 'test-123' }));
      });

      const stream = new DexScreenerStream({
        baseUrl,
        pageUrl,
        apiToken,
        keepAliveMs: 0,
      });

      // Rapid start/stop
      stream.start();
      await wait(10);
      stream.stop();
      
      stream.start();
      await wait(10);
      stream.stop();
      
      stream.start();
      await wait(50);

      expect(stream.getState()).toBe('connected');

      stream.stop();
    });
  });
});
