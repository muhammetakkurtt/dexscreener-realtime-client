import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DexScreenerStream } from '../src/client';
import type { ConnectionState, DexEvent, Pair, StreamContext } from '../src/types';
import type WebSocket from 'ws';
import { KeepAliveManager } from '../src/utils/keep-alive';

let mockWebSocketInstance: {
  close: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  removeAllListeners: ReturnType<typeof vi.fn>;
  _eventHandlers: Map<string, Function>;
};

let webSocketConstructorCalls: Array<{ url: string; options: any }> = [];

vi.mock('ws', () => {
  return {
    default: class MockWebSocket {
      close = vi.fn();
      removeAllListeners = vi.fn();
      _eventHandlers: Map<string, Function> = new Map();
      
      on = vi.fn((event: string, handler: Function) => {
        this._eventHandlers.set(event, handler);
      });
      
      constructor(url: string, options?: any) {
        webSocketConstructorCalls.push({ url, options });
        mockWebSocketInstance = this;
      }
    },
  };
});

vi.mock('../src/utils/keep-alive', () => ({
  KeepAliveManager: {
    getOrCreate: vi.fn().mockReturnValue({
      register: vi.fn(),
      unregister: vi.fn(),
      stop: vi.fn(),
    }),
  },
}));

describe('DexScreenerStream', () => {
  const baseUrl = 'https://test-actor.apify.actor';
  const pageUrl = 'https://dexscreener.com/solana/trending';
  const apiToken = 'test-api-token';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    webSocketConstructorCalls = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Connection Lifecycle', () => {
    it('should establish WebSocket connection when start() is called', () => {
      const stream = new DexScreenerStream({ baseUrl, pageUrl, apiToken });
      stream.start();
      expect(webSocketConstructorCalls.length).toBe(1);
      expect(webSocketConstructorCalls[0].url).toContain('/events/dex/pairs?page_url=');
    });

    it('should close WebSocket connection when stop() is called', () => {
      const stream = new DexScreenerStream({ baseUrl, pageUrl, apiToken });
      stream.start();
      stream.stop();
      expect(mockWebSocketInstance.close).toHaveBeenCalledTimes(1);
    });

    it('should set state to disconnected after stop()', () => {
      const stateChanges: ConnectionState[] = [];
      const stream = new DexScreenerStream({
        baseUrl, pageUrl, apiToken,
        onStateChange: (state) => stateChanges.push(state),
      });
      stream.start();
      stream.stop();
      expect(stream.getState()).toBe('disconnected');
      expect(stateChanges).toContain('disconnected');
    });

    it('should allow restart after stop()', () => {
      const stream = new DexScreenerStream({ baseUrl, pageUrl, apiToken });
      stream.start();
      expect(webSocketConstructorCalls.length).toBe(1);
      stream.stop();
      expect(mockWebSocketInstance.close).toHaveBeenCalledTimes(1);
      stream.start();
      expect(webSocketConstructorCalls.length).toBe(2);
    });

    it('should transition to connecting state on start()', () => {
      const stateChanges: ConnectionState[] = [];
      const stream = new DexScreenerStream({
        baseUrl, pageUrl, apiToken,
        onStateChange: (state) => stateChanges.push(state),
      });
      stream.start();
      expect(stateChanges[0]).toBe('connecting');
    });

    it('should transition to connected state on "connected" event', () => {
      const stateChanges: ConnectionState[] = [];
      const stream = new DexScreenerStream({
        baseUrl, pageUrl, apiToken,
        onStateChange: (state) => stateChanges.push(state),
      });
      stream.start();
      const messageHandler = mockWebSocketInstance._eventHandlers.get('message');
      const connectedData = Buffer.from(JSON.stringify({ event_type: 'connected', connection_id: '123' }));
      messageHandler?.(connectedData);
      expect(stream.getState()).toBe('connected');
      expect(stateChanges).toContain('connected');
    });
  });

  describe('Callback Ordering', () => {
    it('should invoke onBatch before onPair callbacks', () => {
      const callOrder: string[] = [];
      const stream = new DexScreenerStream({
        baseUrl, pageUrl, apiToken,
        onBatch: () => callOrder.push('batch'),
        onPair: () => callOrder.push('pair'),
      });
      stream.start();
      const messageHandler = mockWebSocketInstance._eventHandlers.get('message');
      const pairsData = Buffer.from(JSON.stringify({
        event_type: 'pairs',
        pairs: [
          { chainId: 'solana', baseToken: { symbol: 'SOL' } },
          { chainId: 'solana', baseToken: { symbol: 'BONK' } },
        ],
      }));
      messageHandler?.(pairsData);
      expect(callOrder[0]).toBe('batch');
      expect(callOrder.slice(1)).toEqual(['pair', 'pair']);
    });

    it('should invoke onPair for each pair in order', () => {
      const receivedPairs: Pair[] = [];
      const stream = new DexScreenerStream({
        baseUrl, pageUrl, apiToken,
        onPair: (pair) => receivedPairs.push(pair),
      });
      stream.start();
      const messageHandler = mockWebSocketInstance._eventHandlers.get('message');
      const pairs = [
        { chainId: 'solana', baseToken: { symbol: 'SOL' } },
        { chainId: 'ethereum', baseToken: { symbol: 'ETH' } },
        { chainId: 'bsc', baseToken: { symbol: 'BNB' } },
      ];
      const pairsData = Buffer.from(JSON.stringify({ event_type: 'pairs', pairs }));
      messageHandler?.(pairsData);
      expect(receivedPairs.length).toBe(3);
      expect(receivedPairs[0].baseToken?.symbol).toBe('SOL');
      expect(receivedPairs[1].baseToken?.symbol).toBe('ETH');
      expect(receivedPairs[2].baseToken?.symbol).toBe('BNB');
    });

    it('should include streamId in callback context', () => {
      let receivedContext: StreamContext | undefined;
      const stream = new DexScreenerStream({
        baseUrl, pageUrl, apiToken,
        streamId: 'test-stream',
        onBatch: (_, ctx) => { receivedContext = ctx; },
      });
      stream.start();
      const messageHandler = mockWebSocketInstance._eventHandlers.get('message');
      const pairsData = Buffer.from(JSON.stringify({ event_type: 'pairs', pairs: [] }));
      messageHandler?.(pairsData);
      expect(receivedContext?.streamId).toBe('test-stream');
    });
  });

  describe('Stream Context', () => {
    it('should include connection state in StreamContext', () => {
      let receivedContext: StreamContext | undefined;
      const stream = new DexScreenerStream({
        baseUrl, pageUrl, apiToken,
        onBatch: (_, ctx) => { receivedContext = ctx; },
      });
      stream.start();
      
      // Trigger connected state
      const messageHandler = mockWebSocketInstance._eventHandlers.get('message');
      const connectedData = Buffer.from(JSON.stringify({ event_type: 'connected', connection_id: '123' }));
      messageHandler?.(connectedData);
      
      // Send pairs event
      const pairsData = Buffer.from(JSON.stringify({ event_type: 'pairs', pairs: [] }));
      messageHandler?.(pairsData);
      
      expect(receivedContext?.state).toBe('connected');
    });

    it('should auto-generate streamId when not provided', () => {
      let receivedContext: StreamContext | undefined;
      const stream = new DexScreenerStream({
        baseUrl, pageUrl, apiToken,
        onBatch: (_, ctx) => { receivedContext = ctx; },
      });
      stream.start();
      
      const messageHandler = mockWebSocketInstance._eventHandlers.get('message');
      const pairsData = Buffer.from(JSON.stringify({ event_type: 'pairs', pairs: [] }));
      messageHandler?.(pairsData);
      
      expect(receivedContext?.streamId).toBeDefined();
      expect(receivedContext?.streamId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should maintain consistent context across multiple callbacks', () => {
      const batchContexts: StreamContext[] = [];
      const pairContexts: StreamContext[] = [];
      
      const stream = new DexScreenerStream({
        baseUrl, pageUrl, apiToken,
        streamId: 'test-stream',
        onBatch: (_, ctx) => batchContexts.push(ctx),
        onPair: (_, ctx) => pairContexts.push(ctx),
      });
      stream.start();
      
      const messageHandler = mockWebSocketInstance._eventHandlers.get('message');
      const pairsData = Buffer.from(JSON.stringify({
        event_type: 'pairs',
        pairs: [
          { chainId: 'solana', baseToken: { symbol: 'SOL' } },
          { chainId: 'ethereum', baseToken: { symbol: 'ETH' } },
        ],
      }));
      messageHandler?.(pairsData);
      
      // All contexts should have same streamId
      expect(batchContexts[0].streamId).toBe('test-stream');
      expect(pairContexts[0].streamId).toBe('test-stream');
      expect(pairContexts[1].streamId).toBe('test-stream');
      
      // All contexts should have same state
      expect(batchContexts[0].state).toBe('connecting');
      expect(pairContexts[0].state).toBe('connecting');
      expect(pairContexts[1].state).toBe('connecting');
      
      // Context should be same reference within same event
      expect(pairContexts[0]).toBe(pairContexts[1]);
    });

    it('should include correct state during state transitions', () => {
      const stateContexts: Array<{ state: ConnectionState; ctx: StreamContext }> = [];
      
      const stream = new DexScreenerStream({
        baseUrl, pageUrl, apiToken,
        onStateChange: (state, ctx) => stateContexts.push({ state, ctx }),
      });
      
      stream.start();
      expect(stateContexts[0].state).toBe('connecting');
      expect(stateContexts[0].ctx.state).toBe('connecting');
      
      const messageHandler = mockWebSocketInstance._eventHandlers.get('message');
      const connectedData = Buffer.from(JSON.stringify({ event_type: 'connected', connection_id: '123' }));
      messageHandler?.(connectedData);
      
      expect(stateContexts[1].state).toBe('connected');
      expect(stateContexts[1].ctx.state).toBe('connected');
      
      const closeHandler = mockWebSocketInstance._eventHandlers.get('close');
      closeHandler?.(1006, 'Connection lost');
      
      expect(stateContexts[2].state).toBe('reconnecting');
      expect(stateContexts[2].ctx.state).toBe('reconnecting');
    });

    it('should provide context to all callback types', () => {
      const contexts: Record<string, StreamContext> = {};
      
      const stream = new DexScreenerStream({
        baseUrl, pageUrl, apiToken,
        streamId: 'multi-callback-test',
        onBatch: (_, ctx) => { contexts.batch = ctx; },
        onPair: (_, ctx) => { contexts.pair = ctx; },
        onError: (_, ctx) => { contexts.error = ctx; },
        onStateChange: (_, ctx) => { contexts.stateChange = ctx; },
      });
      
      stream.start();
      expect(contexts.stateChange).toBeDefined();
      expect(contexts.stateChange.streamId).toBe('multi-callback-test');
      
      const messageHandler = mockWebSocketInstance._eventHandlers.get('message');
      
      // Trigger batch and pair callbacks
      const pairsData = Buffer.from(JSON.stringify({
        event_type: 'pairs',
        pairs: [{ chainId: 'solana', baseToken: { symbol: 'SOL' } }],
      }));
      messageHandler?.(pairsData);
      
      expect(contexts.batch).toBeDefined();
      expect(contexts.batch.streamId).toBe('multi-callback-test');
      expect(contexts.pair).toBeDefined();
      expect(contexts.pair.streamId).toBe('multi-callback-test');
      
      // Trigger error callback
      const invalidData = Buffer.from('invalid json {');
      messageHandler?.(invalidData);
      
      expect(contexts.error).toBeDefined();
      expect(contexts.error.streamId).toBe('multi-callback-test');
    });

    it('should update context state when connection state changes', () => {
      let latestContext: StreamContext | undefined;
      
      const stream = new DexScreenerStream({
        baseUrl, pageUrl, apiToken,
        onBatch: (_, ctx) => { latestContext = ctx; },
      });
      
      stream.start();
      
      const messageHandler = mockWebSocketInstance._eventHandlers.get('message');
      
      // Send event while connecting
      let pairsData = Buffer.from(JSON.stringify({ event_type: 'pairs', pairs: [] }));
      messageHandler?.(pairsData);
      expect(latestContext?.state).toBe('connecting');
      
      // Transition to connected
      const connectedData = Buffer.from(JSON.stringify({ event_type: 'connected', connection_id: '123' }));
      messageHandler?.(connectedData);
      
      // Send event while connected
      pairsData = Buffer.from(JSON.stringify({ event_type: 'pairs', pairs: [] }));
      messageHandler?.(pairsData);
      expect(latestContext?.state).toBe('connected');
    });
  });

  describe('Reconnection Behavior', () => {
    it('should schedule reconnection after close when not stopped', () => {
      const stream = new DexScreenerStream({ baseUrl, pageUrl, apiToken, retryMs: 3000 });
      stream.start();
      expect(webSocketConstructorCalls.length).toBe(1);
      const closeHandler = mockWebSocketInstance._eventHandlers.get('close');
      closeHandler?.(1006, 'Connection lost'); // Network error
      vi.advanceTimersByTime(3000);
      expect(webSocketConstructorCalls.length).toBe(2);
    });

    it('should invoke onError before reconnection attempt', () => {
      const callOrder: string[] = [];
      const stream = new DexScreenerStream({
        baseUrl, pageUrl, apiToken, retryMs: 3000,
        onError: () => callOrder.push('error'),
      });
      stream.start();
      const errorHandler = mockWebSocketInstance._eventHandlers.get('error');
      errorHandler?.(new Error('Network error'));
      vi.advanceTimersByTime(3000);
      expect(callOrder).toContain('error');
      expect(webSocketConstructorCalls.length).toBe(1); // Error doesn't trigger reconnect, close does
    });

    it('should cancel pending reconnection when stop() is called', () => {
      const stream = new DexScreenerStream({ baseUrl, pageUrl, apiToken, retryMs: 3000 });
      stream.start();
      expect(webSocketConstructorCalls.length).toBe(1);
      const closeHandler = mockWebSocketInstance._eventHandlers.get('close');
      closeHandler?.(1006, 'Connection lost');
      stream.stop();
      vi.advanceTimersByTime(5000);
      expect(webSocketConstructorCalls.length).toBe(1);
    });

    it('should use configured retryMs for reconnection delay', () => {
      const customRetryMs = 5000;
      const stream = new DexScreenerStream({ baseUrl, pageUrl, apiToken, retryMs: customRetryMs });
      stream.start();
      const closeHandler = mockWebSocketInstance._eventHandlers.get('close');
      closeHandler?.(1006, 'Connection lost');
      vi.advanceTimersByTime(4000);
      expect(webSocketConstructorCalls.length).toBe(1);
      vi.advanceTimersByTime(1000);
      expect(webSocketConstructorCalls.length).toBe(2);
    });

    it('should use default retryMs (3000) when not configured', () => {
      const stream = new DexScreenerStream({ baseUrl, pageUrl, apiToken });
      stream.start();
      const closeHandler = mockWebSocketInstance._eventHandlers.get('close');
      closeHandler?.(1006, 'Connection lost');
      vi.advanceTimersByTime(2000);
      expect(webSocketConstructorCalls.length).toBe(1);
      vi.advanceTimersByTime(1000);
      expect(webSocketConstructorCalls.length).toBe(2);
    });

    it('should set state to reconnecting during reconnection wait', () => {
      const stateChanges: ConnectionState[] = [];
      const stream = new DexScreenerStream({
        baseUrl, pageUrl, apiToken, retryMs: 3000,
        onStateChange: (state) => stateChanges.push(state),
      });
      stream.start();
      const closeHandler = mockWebSocketInstance._eventHandlers.get('close');
      closeHandler?.(1006, 'Connection lost');
      expect(stream.getState()).toBe('reconnecting');
      expect(stateChanges).toContain('reconnecting');
    });
  });

  describe('Event Handling', () => {
    it('should not invoke user callbacks for ping events', () => {
      let batchCalled = false;
      let pairCalled = false;
      const stream = new DexScreenerStream({
        baseUrl, pageUrl, apiToken,
        onBatch: () => { batchCalled = true; },
        onPair: () => { pairCalled = true; },
      });
      stream.start();
      const messageHandler = mockWebSocketInstance._eventHandlers.get('message');
      const pingData = Buffer.from(JSON.stringify({ event_type: 'ping' }));
      messageHandler?.(pingData);
      expect(batchCalled).toBe(false);
      expect(pairCalled).toBe(false);
    });

    it('should invoke onError for invalid JSON', () => {
      let errorReceived: unknown;
      const stream = new DexScreenerStream({
        baseUrl, pageUrl, apiToken,
        onError: (error) => { errorReceived = error; },
      });
      stream.start();
      const messageHandler = mockWebSocketInstance._eventHandlers.get('message');
      const invalidData = Buffer.from('not valid json {');
      messageHandler?.(invalidData);
      expect(errorReceived).toBeInstanceOf(Error);
      expect((errorReceived as Error).message).toContain('Protocol error');
    });

    it('should handle events with pairs array but no event_type', () => {
      let receivedEvent: { pairs?: { chainId?: string }[] } | undefined;
      const stream = new DexScreenerStream({
        baseUrl, pageUrl, apiToken,
        onBatch: (event) => { receivedEvent = event; },
      });
      stream.start();
      const messageHandler = mockWebSocketInstance._eventHandlers.get('message');
      const pairsData = Buffer.from(JSON.stringify({
        pairs: [{ chainId: 'solana' }],
        stats: { h1: { txns: 100 } },
      }));
      messageHandler?.(pairsData);
      expect(receivedEvent).toBeDefined();
      expect(receivedEvent?.pairs?.length).toBe(1);
    });

    it('should normalize current actor envelope payloads', () => {
      let receivedEvent: DexEvent | undefined;
      let receivedPair: Pair | undefined;
      const stream = new DexScreenerStream({
        baseUrl, pageUrl, apiToken,
        onBatch: (event) => { receivedEvent = event; },
        onPair: (pair) => { receivedPair = pair; },
      });
      stream.start();

      const messageHandler = mockWebSocketInstance._eventHandlers.get('message');
      const pairsData = Buffer.from(JSON.stringify({
        event_type: 'pairs',
        timestamp: '2026-04-24T10:58:36.126Z',
        data: {
          stats: {
            m5: { txns: 134, volumeUSD: 13969 },
          },
          pairs: [{
            type: {
              case: 'typeAMM',
              value: {
                a: 'meteora',
                launchpad: {
                  progress: 100,
                  creator: 'creator-address',
                  migrationDEX: 'meteora',
                  meta: { id: 'meteoradbc' },
                },
              },
            },
            chainId: 'solana',
            dexId: 'meteora',
            pairAddress: 'Dbc5hNaA9VatXYiYT5Vg4PpfvXLXM17wbUCABFjfP8wi',
            baseToken: { symbol: 'CHOI' },
            quoteToken: { symbol: 'SOL' },
            price: '0.00002588',
            priceUSD: '0.002218',
            pairCreatedAt: { seconds: 1776392344, nanos: 123000000 },
          }],
        },
      }));

      messageHandler?.(pairsData);

      const pair = receivedEvent?.pairs?.[0];
      expect(pair).toBeDefined();
      expect(pair?.priceUsd).toBe('0.002218');
      expect(pair?.priceUSD).toBe('0.002218');
      expect(pair?.quoteTokenSymbol).toBe('SOL');
      expect(pair?.pairCreatedAt).toBe(1776392344123);
      expect(pair?.pairCreatedAtRaw).toEqual({ seconds: 1776392344, nanos: 123000000 });
      expect(pair?.launchpad?.migrationDex).toBe('meteora');
      expect(pair?.launchpad?.migrationDEX).toBe('meteora');
      expect(pair?.type?.value?.launchpad?.migrationDex).toBe('meteora');
      expect(receivedEvent?.stats?.m5?.volumeUsd).toBe(13969);
      expect(receivedEvent?.stats?.m5?.volumeUSD).toBe(13969);
      expect(receivedEvent?.event_type).toBe('pairs');
      expect(receivedEvent?.timestamp).toBe('2026-04-24T10:58:36.126Z');
      expect(receivedPair).toBe(pair);
    });

    it('should preserve legacy top-level camelCase payloads', () => {
      let receivedEvent: DexEvent | undefined;
      const stream = new DexScreenerStream({
        baseUrl, pageUrl, apiToken,
        onBatch: (event) => { receivedEvent = event; },
      });
      stream.start();

      const messageHandler = mockWebSocketInstance._eventHandlers.get('message');
      const pairsData = Buffer.from(JSON.stringify({
        event_type: 'pairs',
        pairs: [{
          chainId: 'solana',
          quoteToken: { symbol: 'USDC' },
          quoteTokenSymbol: 'USDC',
          priceUsd: '1.23',
          pairCreatedAt: 1776392344123,
          launchpad: { migrationDex: 'pumpswap' },
        }],
        stats: { h24: { txns: 10, volumeUsd: 1000 } },
      }));

      messageHandler?.(pairsData);

      const pair = receivedEvent?.pairs?.[0];
      expect(pair?.priceUsd).toBe('1.23');
      expect(pair?.quoteTokenSymbol).toBe('USDC');
      expect(pair?.pairCreatedAt).toBe(1776392344123);
      expect(pair?.pairCreatedAtRaw).toBeUndefined();
      expect(pair?.launchpad?.migrationDex).toBe('pumpswap');
      expect(receivedEvent?.stats?.h24?.volumeUsd).toBe(1000);
    });

    it('should use actor error data message when present', () => {
      let errorReceived: unknown;
      const stream = new DexScreenerStream({
        baseUrl, pageUrl, apiToken,
        onError: (error) => { errorReceived = error; },
      });
      stream.start();

      const messageHandler = mockWebSocketInstance._eventHandlers.get('message');
      const errorData = Buffer.from(JSON.stringify({
        event_type: 'error',
        data: {
          code: 'BAD_REQUEST',
          message: 'page_url must be a valid Dexscreener URL',
        },
      }));

      messageHandler?.(errorData);

      expect(errorReceived).toBeInstanceOf(Error);
      expect((errorReceived as Error).message).toContain('BAD_REQUEST');
      expect((errorReceived as Error).message).toContain('page_url must be a valid Dexscreener URL');
    });
  });

  describe('Validation', () => {
    it('should throw error for empty baseUrl', () => {
      expect(() => new DexScreenerStream({ baseUrl: '', pageUrl, apiToken })).toThrow();
    });

    it('should throw error for empty pageUrl', () => {
      expect(() => new DexScreenerStream({ baseUrl, pageUrl: '', apiToken })).toThrow();
    });

    it('should throw error for empty apiToken', () => {
      expect(() => new DexScreenerStream({ baseUrl, pageUrl, apiToken: '' })).toThrow('apiToken is required');
    });

    it('should throw error for whitespace-only apiToken', () => {
      expect(() => new DexScreenerStream({ baseUrl, pageUrl, apiToken: '   ' })).toThrow('apiToken is required');
    });
  });

  describe('Configuration Defaults', () => {
    it('should default authMode to auto when not specified', () => {
      const stream = new DexScreenerStream({ baseUrl, pageUrl, apiToken });
      stream.start();
      
      expect(webSocketConstructorCalls.length).toBe(1);
      const { url, options } = webSocketConstructorCalls[0];
      
      // In auto mode, token should be in header, not in URL
      expect(url).not.toContain('token=');
      expect(options?.headers?.Authorization).toBe(`Bearer ${apiToken}`);
    });

    it('should default retryMs to 3000 when not specified', () => {
      const stream = new DexScreenerStream({ baseUrl, pageUrl, apiToken });
      stream.start();
      
      const closeHandler = mockWebSocketInstance._eventHandlers.get('close');
      closeHandler?.(1000, 'Normal closure');
      
      // Should not reconnect before 3000ms
      vi.advanceTimersByTime(2999);
      expect(webSocketConstructorCalls.length).toBe(1);
      
      // Should reconnect after 3000ms
      vi.advanceTimersByTime(1);
      expect(webSocketConstructorCalls.length).toBe(2);
    });

    it('should default keepAliveMs to 120000 when not specified', () => {
      const stream = new DexScreenerStream({ baseUrl, pageUrl, apiToken });
      stream.start();
      
      // Keep-alive manager should be registered with default interval
      expect(KeepAliveManager.getOrCreate).toHaveBeenCalledWith(
        expect.any(String),
        apiToken,
        120000
      );
    });

    it('should auto-generate streamId (UUID format) when not specified', () => {
      const stream = new DexScreenerStream({ baseUrl, pageUrl, apiToken });
      
      let capturedContext: StreamContext | undefined;
      const streamWithCallback = new DexScreenerStream({
        baseUrl,
        pageUrl,
        apiToken,
        onStateChange: (state, ctx) => {
          capturedContext = ctx;
        },
      });
      streamWithCallback.start();
      
      // Trigger state change to capture context
      const openHandler = mockWebSocketInstance._eventHandlers.get('open');
      openHandler?.();
      
      expect(capturedContext?.streamId).toBeDefined();
      // UUID format: 8-4-4-4-12 hex characters
      expect(capturedContext?.streamId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should allow all defaults to be overridden with custom values', () => {
      const customStreamId = 'custom-stream-id';
      const customRetryMs = 5000;
      const customKeepAliveMs = 60000;
      const customAuthMode = 'query';
      
      const stream = new DexScreenerStream({
        baseUrl,
        pageUrl,
        apiToken,
        streamId: customStreamId,
        retryMs: customRetryMs,
        keepAliveMs: customKeepAliveMs,
        authMode: customAuthMode,
      });
      
      stream.start();
      
      // Verify authMode override (query mode should have token in URL)
      expect(webSocketConstructorCalls.length).toBe(1);
      const { url } = webSocketConstructorCalls[0];
      expect(url).toContain(`token=${apiToken}`);
      
      // Verify retryMs override
      const closeHandler = mockWebSocketInstance._eventHandlers.get('close');
      closeHandler?.(1000, 'Normal closure');
      
      vi.advanceTimersByTime(4999);
      expect(webSocketConstructorCalls.length).toBe(1);
      
      vi.advanceTimersByTime(1);
      expect(webSocketConstructorCalls.length).toBe(2);
      
      // Verify keepAliveMs override
      expect(KeepAliveManager.getOrCreate).toHaveBeenCalledWith(
        expect.any(String),
        apiToken,
        customKeepAliveMs
      );
    });
  });

  describe('Authentication Error Handling', () => {
    it('should not reconnect on 4401 authentication error after fallback', () => {
      const stream = new DexScreenerStream({ baseUrl, pageUrl, apiToken, retryMs: 1000, authMode: 'header' });
      stream.start();
      expect(webSocketConstructorCalls.length).toBe(1);
      
      const closeHandler = mockWebSocketInstance._eventHandlers.get('close');
      closeHandler?.(4401, 'Unauthorized');
      
      vi.advanceTimersByTime(5000);
      expect(webSocketConstructorCalls.length).toBe(1);
    });

    it('should set state to disconnected on 4401 error with no fallback', () => {
      const stateChanges: ConnectionState[] = [];
      const stream = new DexScreenerStream({
        baseUrl, pageUrl, apiToken,
        authMode: 'header',
        onStateChange: (state) => stateChanges.push(state),
      });
      stream.start();
      
      const closeHandler = mockWebSocketInstance._eventHandlers.get('close');
      closeHandler?.(4401, 'Unauthorized');
      
      expect(stream.getState()).toBe('disconnected');
    });

    it('should invoke onError with descriptive message on 4401', () => {
      let errorReceived: unknown;
      const stream = new DexScreenerStream({
        baseUrl, pageUrl, apiToken,
        authMode: 'header',
        onError: (error) => { errorReceived = error; },
      });
      stream.start();
      
      const closeHandler = mockWebSocketInstance._eventHandlers.get('close');
      closeHandler?.(4401, 'Unauthorized');
      
      expect(errorReceived).toBeInstanceOf(Error);
      expect((errorReceived as Error).message).toContain('Authentication failed');
    });

    it('should not reconnect on 4403 forbidden error', () => {
      const stream = new DexScreenerStream({ baseUrl, pageUrl, apiToken, authMode: 'header', retryMs: 1000 });
      stream.start();
      
      const closeHandler = mockWebSocketInstance._eventHandlers.get('close');
      closeHandler?.(4403, 'Forbidden');
      
      vi.advanceTimersByTime(5000);
      expect(webSocketConstructorCalls.length).toBe(1);
    });

    it('should reconnect on normal close codes', () => {
      const stream = new DexScreenerStream({ baseUrl, pageUrl, apiToken, retryMs: 1000 });
      stream.start();
      expect(webSocketConstructorCalls.length).toBe(1);
      
      const closeHandler = mockWebSocketInstance._eventHandlers.get('close');
      closeHandler?.(1000, 'Normal closure');
      
      vi.advanceTimersByTime(1000);
      expect(webSocketConstructorCalls.length).toBe(2);
    });

    it('should attempt fallback on 4401 with auto mode', () => {
      const stream = new DexScreenerStream({ baseUrl, pageUrl, apiToken, authMode: 'auto', retryMs: 1000 });
      stream.start();
      expect(webSocketConstructorCalls.length).toBe(1);
      
      const closeHandler = mockWebSocketInstance._eventHandlers.get('close');
      closeHandler?.(4401, 'Unauthorized');
      
      // Should immediately retry with query auth
      expect(webSocketConstructorCalls.length).toBe(2);
      // Second URL should have token in query
      expect(webSocketConstructorCalls[1].url).toContain('token=');
    });

    it('should not reconnect on upgrade auth error in header mode', () => {
      const stream = new DexScreenerStream({ baseUrl, pageUrl, apiToken, authMode: 'header', retryMs: 1000 });
      stream.start();
      expect(webSocketConstructorCalls.length).toBe(1);
      
      const errorHandler = mockWebSocketInstance._eventHandlers.get('error');
      errorHandler?.(new Error('Unexpected server response: 401'));
      
      // Should not schedule reconnect
      vi.advanceTimersByTime(5000);
      expect(webSocketConstructorCalls.length).toBe(1);
      expect(stream.getState()).toBe('disconnected');
    });

    it('should not reconnect on upgrade auth error after fallback exhausted', () => {
      const stream = new DexScreenerStream({ baseUrl, pageUrl, apiToken, authMode: 'auto', retryMs: 1000 });
      stream.start();
      expect(webSocketConstructorCalls.length).toBe(1);
      
      // First error triggers fallback
      const errorHandler = mockWebSocketInstance._eventHandlers.get('error');
      errorHandler?.(new Error('Unexpected server response: 401'));
      expect(webSocketConstructorCalls.length).toBe(2);
      
      // Second error should NOT reconnect
      const errorHandler2 = mockWebSocketInstance._eventHandlers.get('error');
      errorHandler2?.(new Error('Unexpected server response: 401'));
      
      vi.advanceTimersByTime(5000);
      expect(webSocketConstructorCalls.length).toBe(2);
      expect(stream.getState()).toBe('disconnected');
    });

    it('should invoke onError with auth error on upgrade failure without fallback', () => {
      let errorReceived: unknown;
      const stream = new DexScreenerStream({
        baseUrl, pageUrl, apiToken,
        authMode: 'header',
        onError: (error) => { errorReceived = error; },
      });
      stream.start();
      
      const errorHandler = mockWebSocketInstance._eventHandlers.get('error');
      errorHandler?.(new Error('Unexpected server response: 403'));
      
      expect(errorReceived).toBeInstanceOf(Error);
      expect((errorReceived as Error).message).toContain('Authentication failed');
      expect(stream.getState()).toBe('disconnected');
    });

    it('should reconnect on non-auth network errors', () => {
      const stream = new DexScreenerStream({ baseUrl, pageUrl, apiToken, retryMs: 1000 });
      stream.start();
      expect(webSocketConstructorCalls.length).toBe(1);
      
      const errorHandler = mockWebSocketInstance._eventHandlers.get('error');
      errorHandler?.(new Error('ECONNREFUSED'));
      
      // Should trigger handleClose which schedules reconnect
      const closeHandler = mockWebSocketInstance._eventHandlers.get('close');
      closeHandler?.(1006, 'Abnormal closure');
      
      vi.advanceTimersByTime(1000);
      expect(webSocketConstructorCalls.length).toBe(2);
    });

    it('should reconnect on upgrade 500 error', () => {
      const stream = new DexScreenerStream({ baseUrl, pageUrl, apiToken, retryMs: 1000 });
      stream.start();
      expect(webSocketConstructorCalls.length).toBe(1);
      
      const errorHandler = mockWebSocketInstance._eventHandlers.get('error');
      errorHandler?.(new Error('Unexpected server response: 500'));
      
      // Should trigger close which schedules reconnect
      const closeHandler = mockWebSocketInstance._eventHandlers.get('close');
      closeHandler?.(1006, Buffer.from(''));
      
      vi.advanceTimersByTime(1000);
      expect(webSocketConstructorCalls.length).toBe(2); // Reconnected
      expect(stream.getState()).toBe('connecting');
    });

    it('should reconnect on upgrade 502 error', () => {
      const stream = new DexScreenerStream({ baseUrl, pageUrl, apiToken, retryMs: 1000 });
      stream.start();
      
      const errorHandler = mockWebSocketInstance._eventHandlers.get('error');
      errorHandler?.(new Error('Unexpected server response: 502'));
      
      const closeHandler = mockWebSocketInstance._eventHandlers.get('close');
      closeHandler?.(1006, Buffer.from(''));
      
      vi.advanceTimersByTime(1000);
      expect(webSocketConstructorCalls.length).toBe(2);
    });

    it('should reconnect on upgrade 429 rate limit error', () => {
      const stream = new DexScreenerStream({ baseUrl, pageUrl, apiToken, retryMs: 1000 });
      stream.start();
      
      const errorHandler = mockWebSocketInstance._eventHandlers.get('error');
      errorHandler?.(new Error('Unexpected server response: 429'));
      
      const closeHandler = mockWebSocketInstance._eventHandlers.get('close');
      closeHandler?.(1006, Buffer.from(''));
      
      vi.advanceTimersByTime(1000);
      expect(webSocketConstructorCalls.length).toBe(2);
    });

    it('should NOT reconnect on upgrade 401 error in header mode', () => {
      const stream = new DexScreenerStream({ baseUrl, pageUrl, apiToken, authMode: 'header', retryMs: 1000 });
      stream.start();
      
      const errorHandler = mockWebSocketInstance._eventHandlers.get('error');
      errorHandler?.(new Error('Unexpected server response: 401'));
      
      vi.advanceTimersByTime(5000);
      expect(webSocketConstructorCalls.length).toBe(1); // No reconnect
      expect(stream.getState()).toBe('disconnected');
    });
  });
});
