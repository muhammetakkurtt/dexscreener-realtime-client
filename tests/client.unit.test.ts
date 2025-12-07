import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DexScreenerStream } from '../src/client';
import type { ConnectionState, Pair, StreamContext } from '../src/types';

let mockEventSourceInstance: {
  close: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  _eventListeners: Map<string, ((event: MessageEvent) => void)[]>;
};

let eventSourceConstructorCalls: string[] = [];

vi.mock('eventsource', () => {
  return {
    EventSource: class MockEventSource {
      close = vi.fn();
      onopen: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      _eventListeners: Map<string, ((event: MessageEvent) => void)[]> = new Map();
      
      addEventListener = vi.fn((type: string, listener: (event: MessageEvent) => void) => {
        if (!this._eventListeners.has(type)) {
          this._eventListeners.set(type, []);
        }
        this._eventListeners.get(type)!.push(listener);
      });
      
      constructor(url: string) {
        eventSourceConstructorCalls.push(url);
        mockEventSourceInstance = this;
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
    eventSourceConstructorCalls = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Connection Lifecycle', () => {
    it('should establish EventSource connection when start() is called', () => {
      const stream = new DexScreenerStream({ baseUrl, pageUrl, apiToken });
      stream.start();
      expect(eventSourceConstructorCalls.length).toBe(1);
      expect(eventSourceConstructorCalls[0]).toContain('/events/dex/pairs?page_url=');
    });

    it('should close EventSource connection when stop() is called', () => {
      const stream = new DexScreenerStream({ baseUrl, pageUrl, apiToken });
      stream.start();
      stream.stop();
      expect(mockEventSourceInstance.close).toHaveBeenCalledTimes(1);
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
      expect(eventSourceConstructorCalls.length).toBe(1);
      stream.stop();
      expect(mockEventSourceInstance.close).toHaveBeenCalledTimes(1);
      stream.start();
      expect(eventSourceConstructorCalls.length).toBe(2);
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
      const connectedEvent = new MessageEvent('message', {
        data: JSON.stringify({ event_type: 'connected', connection_id: '123' }),
      });
      mockEventSourceInstance.onmessage?.(connectedEvent);
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
      const pairsEvent = new MessageEvent('message', {
        data: JSON.stringify({
          event_type: 'pairs',
          pairs: [
            { chainId: 'solana', baseToken: { symbol: 'SOL' } },
            { chainId: 'solana', baseToken: { symbol: 'BONK' } },
          ],
        }),
      });
      mockEventSourceInstance.onmessage?.(pairsEvent);
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
      const pairs = [
        { chainId: 'solana', baseToken: { symbol: 'SOL' } },
        { chainId: 'ethereum', baseToken: { symbol: 'ETH' } },
        { chainId: 'bsc', baseToken: { symbol: 'BNB' } },
      ];
      const pairsEvent = new MessageEvent('message', {
        data: JSON.stringify({ event_type: 'pairs', pairs }),
      });
      mockEventSourceInstance.onmessage?.(pairsEvent);
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
      const pairsEvent = new MessageEvent('message', {
        data: JSON.stringify({ event_type: 'pairs', pairs: [] }),
      });
      mockEventSourceInstance.onmessage?.(pairsEvent);
      expect(receivedContext?.streamId).toBe('test-stream');
    });
  });

  describe('Reconnection Behavior', () => {
    it('should schedule reconnection after error when not stopped', () => {
      const stream = new DexScreenerStream({ baseUrl, pageUrl, apiToken, retryMs: 3000 });
      stream.start();
      expect(eventSourceConstructorCalls.length).toBe(1);
      mockEventSourceInstance.onerror?.(new Event('error'));
      vi.advanceTimersByTime(3000);
      expect(eventSourceConstructorCalls.length).toBe(2);
    });

    it('should invoke onError before reconnection attempt', () => {
      const callOrder: string[] = [];
      const stream = new DexScreenerStream({
        baseUrl, pageUrl, apiToken, retryMs: 3000,
        onError: () => callOrder.push('error'),
      });
      stream.start();
      mockEventSourceInstance.onerror?.(new Event('error'));
      expect(callOrder).toContain('error');
      vi.advanceTimersByTime(3000);
      expect(eventSourceConstructorCalls.length).toBe(2);
    });

    it('should cancel pending reconnection when stop() is called', () => {
      const stream = new DexScreenerStream({ baseUrl, pageUrl, apiToken, retryMs: 3000 });
      stream.start();
      expect(eventSourceConstructorCalls.length).toBe(1);
      mockEventSourceInstance.onerror?.(new Event('error'));
      stream.stop();
      vi.advanceTimersByTime(5000);
      expect(eventSourceConstructorCalls.length).toBe(1);
    });

    it('should use configured retryMs for reconnection delay', () => {
      const customRetryMs = 5000;
      const stream = new DexScreenerStream({ baseUrl, pageUrl, apiToken, retryMs: customRetryMs });
      stream.start();
      mockEventSourceInstance.onerror?.(new Event('error'));
      vi.advanceTimersByTime(4000);
      expect(eventSourceConstructorCalls.length).toBe(1);
      vi.advanceTimersByTime(1000);
      expect(eventSourceConstructorCalls.length).toBe(2);
    });

    it('should use default retryMs (3000) when not configured', () => {
      const stream = new DexScreenerStream({ baseUrl, pageUrl, apiToken });
      stream.start();
      mockEventSourceInstance.onerror?.(new Event('error'));
      vi.advanceTimersByTime(2000);
      expect(eventSourceConstructorCalls.length).toBe(1);
      vi.advanceTimersByTime(1000);
      expect(eventSourceConstructorCalls.length).toBe(2);
    });

    it('should set state to reconnecting during reconnection wait', () => {
      const stateChanges: ConnectionState[] = [];
      const stream = new DexScreenerStream({
        baseUrl, pageUrl, apiToken, retryMs: 3000,
        onStateChange: (state) => stateChanges.push(state),
      });
      stream.start();
      mockEventSourceInstance.onerror?.(new Event('error'));
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
      const pingEvent = new MessageEvent('message', {
        data: JSON.stringify({ event_type: 'ping' }),
      });
      mockEventSourceInstance.onmessage?.(pingEvent);
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
      const invalidEvent = new MessageEvent('message', { data: 'not valid json {' });
      mockEventSourceInstance.onmessage?.(invalidEvent);
      expect(errorReceived).toBeInstanceOf(SyntaxError);
    });

    it('should handle events with pairs array but no event_type', () => {
      let receivedEvent: { pairs?: { chainId?: string }[] } | undefined;
      const stream = new DexScreenerStream({
        baseUrl, pageUrl, apiToken,
        onBatch: (event) => { receivedEvent = event; },
      });
      stream.start();
      const pairsEvent = new MessageEvent('message', {
        data: JSON.stringify({
          pairs: [{ chainId: 'solana' }],
          stats: { h1: { txns: 100 } },
        }),
      });
      mockEventSourceInstance.onmessage?.(pairsEvent);
      expect(receivedEvent).toBeDefined();
      expect(receivedEvent?.pairs?.length).toBe(1);
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

  describe('Authentication Error Handling', () => {
    it('should not reconnect on 401 authentication error', () => {
      const stream = new DexScreenerStream({ baseUrl, pageUrl, apiToken, retryMs: 1000 });
      stream.start();
      expect(eventSourceConstructorCalls.length).toBe(1);
      
      const authError = Object.assign(new Event('error'), { code: 401, message: 'Unauthorized' });
      mockEventSourceInstance.onerror?.(authError);
      
      vi.advanceTimersByTime(5000);
      expect(eventSourceConstructorCalls.length).toBe(1);
    });

    it('should set state to disconnected on 401 error', () => {
      const stateChanges: ConnectionState[] = [];
      const stream = new DexScreenerStream({
        baseUrl, pageUrl, apiToken,
        onStateChange: (state) => stateChanges.push(state),
      });
      stream.start();
      
      const authError = Object.assign(new Event('error'), { code: 401 });
      mockEventSourceInstance.onerror?.(authError);
      
      expect(stream.getState()).toBe('disconnected');
    });

    it('should invoke onError with descriptive message on 401', () => {
      let errorReceived: unknown;
      const stream = new DexScreenerStream({
        baseUrl, pageUrl, apiToken,
        onError: (error) => { errorReceived = error; },
      });
      stream.start();
      
      const authError = Object.assign(new Event('error'), { code: 401 });
      mockEventSourceInstance.onerror?.(authError);
      
      expect(errorReceived).toBeInstanceOf(Error);
      expect((errorReceived as Error).message).toContain('Authentication failed');
    });

    it('should not reconnect on other 4xx client errors', () => {
      const stream = new DexScreenerStream({ baseUrl, pageUrl, apiToken, retryMs: 1000 });
      stream.start();
      
      const clientError = Object.assign(new Event('error'), { code: 403, message: 'Forbidden' });
      mockEventSourceInstance.onerror?.(clientError);
      
      vi.advanceTimersByTime(5000);
      expect(eventSourceConstructorCalls.length).toBe(1);
    });

    it('should reconnect on 5xx server errors', () => {
      const stream = new DexScreenerStream({ baseUrl, pageUrl, apiToken, retryMs: 1000 });
      stream.start();
      expect(eventSourceConstructorCalls.length).toBe(1);
      
      const serverError = Object.assign(new Event('error'), { code: 500, message: 'Internal Server Error' });
      mockEventSourceInstance.onerror?.(serverError);
      
      vi.advanceTimersByTime(1000);
      expect(eventSourceConstructorCalls.length).toBe(2);
    });
  });
});
