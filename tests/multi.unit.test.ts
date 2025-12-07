import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DexScreenerMultiStream } from '../src/multi';
import type { ConnectionState, MultiStreamConfig } from '../src/types';

const mockEventSourceInstances: Map<string, {
  close: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  _eventListeners: Map<string, ((event: MessageEvent) => void)[]>;
}> = new Map();

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
        mockEventSourceInstances.set(url, this);
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

describe('DexScreenerMultiStream', () => {
  const baseUrl = 'https://test-actor.apify.actor';
  const apiToken = 'test-api-token';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    eventSourceConstructorCalls = [];
    mockEventSourceInstances.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('startAll()', () => {
    it('should start all configured streams', () => {
      const config: MultiStreamConfig = {
        baseUrl,
        apiToken,
        streams: [
          { id: 'stream-1', pageUrl: 'https://dexscreener.com/solana/trending' },
          { id: 'stream-2', pageUrl: 'https://dexscreener.com/ethereum/trending' },
          { id: 'stream-3', pageUrl: 'https://dexscreener.com/bsc/trending' },
        ],
      };
      const multiStream = new DexScreenerMultiStream(config);
      multiStream.startAll();
      expect(eventSourceConstructorCalls.length).toBe(3);
    });

    it('should create EventSource for each stream with correct URL', () => {
      const config: MultiStreamConfig = {
        baseUrl,
        apiToken,
        streams: [
          { id: 'solana', pageUrl: 'https://dexscreener.com/solana/trending' },
          { id: 'ethereum', pageUrl: 'https://dexscreener.com/ethereum/trending' },
        ],
      };
      const multiStream = new DexScreenerMultiStream(config);
      multiStream.startAll();
      expect(eventSourceConstructorCalls[0]).toContain(encodeURIComponent('https://dexscreener.com/solana/trending'));
      expect(eventSourceConstructorCalls[1]).toContain(encodeURIComponent('https://dexscreener.com/ethereum/trending'));
    });

    it('should handle empty streams array', () => {
      const config: MultiStreamConfig = {
        baseUrl,
        apiToken,
        streams: [],
      };
      const multiStream = new DexScreenerMultiStream(config);
      multiStream.startAll();
      expect(eventSourceConstructorCalls.length).toBe(0);
    });
  });

  describe('stopAll()', () => {
    it('should stop all active streams', () => {
      const config: MultiStreamConfig = {
        baseUrl,
        apiToken,
        streams: [
          { id: 'stream-1', pageUrl: 'https://dexscreener.com/solana/trending' },
          { id: 'stream-2', pageUrl: 'https://dexscreener.com/ethereum/trending' },
        ],
      };
      const multiStream = new DexScreenerMultiStream(config);
      multiStream.startAll();
      multiStream.stopAll();
      for (const instance of mockEventSourceInstances.values()) {
        expect(instance.close).toHaveBeenCalledTimes(1);
      }
    });

    it('should allow restart after stopAll', () => {
      const config: MultiStreamConfig = {
        baseUrl,
        apiToken,
        streams: [
          { id: 'stream-1', pageUrl: 'https://dexscreener.com/solana/trending' },
        ],
      };
      const multiStream = new DexScreenerMultiStream(config);
      multiStream.startAll();
      expect(eventSourceConstructorCalls.length).toBe(1);
      multiStream.stopAll();
      multiStream.startAll();
      expect(eventSourceConstructorCalls.length).toBe(2);
    });

    it('should set all streams to disconnected state after stopAll', () => {
      const stateChanges: { streamId: string; state: ConnectionState }[] = [];
      const config: MultiStreamConfig = {
        baseUrl,
        apiToken,
        streams: [
          { id: 'stream-1', pageUrl: 'https://dexscreener.com/solana/trending' },
          { id: 'stream-2', pageUrl: 'https://dexscreener.com/ethereum/trending' },
        ],
        onStateChange: (state, ctx) => {
          stateChanges.push({ streamId: ctx.streamId!, state });
        },
      };
      const multiStream = new DexScreenerMultiStream(config);
      multiStream.startAll();
      multiStream.stopAll();
      const disconnectedStates = stateChanges.filter(s => s.state === 'disconnected');
      expect(disconnectedStates.length).toBe(2);
      expect(disconnectedStates.map(s => s.streamId).sort()).toEqual(['stream-1', 'stream-2']);
    });
  });

  describe('Stream Isolation on Failure', () => {
    it('should handle reconnection for failed stream independently', () => {
      const config: MultiStreamConfig = {
        baseUrl,
        apiToken,
        streams: [
          { id: 'stream-1', pageUrl: 'https://dexscreener.com/solana/trending' },
          { id: 'stream-2', pageUrl: 'https://dexscreener.com/ethereum/trending' },
        ],
        retryMs: 3000,
      };
      const multiStream = new DexScreenerMultiStream(config);
      multiStream.startAll();
      expect(eventSourceConstructorCalls.length).toBe(2);
      const stream1Url = eventSourceConstructorCalls[0];
      const stream1Instance = mockEventSourceInstances.get(stream1Url)!;
      stream1Instance.onerror?.(new Event('error'));
      vi.advanceTimersByTime(3000);
      expect(eventSourceConstructorCalls.length).toBe(3);
      const stream2Url = eventSourceConstructorCalls[1];
      const stream2Instance = mockEventSourceInstances.get(stream2Url)!;
      expect(stream2Instance.close).not.toHaveBeenCalled();
    });

    it('should not affect other streams when one stream fails', () => {
      const errorCallbacks: { streamId: string; error: unknown }[] = [];
      const config: MultiStreamConfig = {
        baseUrl,
        apiToken,
        streams: [
          { id: 'healthy', pageUrl: 'https://dexscreener.com/solana/trending' },
          { id: 'failing', pageUrl: 'https://dexscreener.com/ethereum/trending' },
        ],
        onError: (error, ctx) => {
          errorCallbacks.push({ streamId: ctx.streamId!, error });
        },
      };
      const multiStream = new DexScreenerMultiStream(config);
      multiStream.startAll();
      const failingStreamUrl = eventSourceConstructorCalls[1];
      const failingInstance = mockEventSourceInstances.get(failingStreamUrl)!;
      failingInstance.onerror?.(new Event('error'));
      expect(errorCallbacks.length).toBe(1);
      expect(errorCallbacks[0].streamId).toBe('failing');
    });

    it('should continue receiving events on healthy streams when one fails', () => {
      const receivedEvents: { streamId: string; pairs: number }[] = [];
      const config: MultiStreamConfig = {
        baseUrl,
        apiToken,
        streams: [
          { id: 'healthy', pageUrl: 'https://dexscreener.com/solana/trending' },
          { id: 'failing', pageUrl: 'https://dexscreener.com/ethereum/trending' },
        ],
        onBatch: (event, ctx) => {
          receivedEvents.push({ streamId: ctx.streamId!, pairs: event.pairs?.length ?? 0 });
        },
      };
      const multiStream = new DexScreenerMultiStream(config);
      multiStream.startAll();
      const healthyStreamUrl = eventSourceConstructorCalls[0];
      const failingStreamUrl = eventSourceConstructorCalls[1];
      const healthyInstance = mockEventSourceInstances.get(healthyStreamUrl)!;
      const failingInstance = mockEventSourceInstances.get(failingStreamUrl)!;
      failingInstance.onerror?.(new Event('error'));
      const pairsEvent = new MessageEvent('message', {
        data: JSON.stringify({
          event_type: 'pairs',
          pairs: [{ chainId: 'solana', baseToken: { symbol: 'SOL' } }],
        }),
      });
      healthyInstance.onmessage?.(pairsEvent);
      expect(receivedEvents.length).toBe(1);
      expect(receivedEvents[0].streamId).toBe('healthy');
      expect(receivedEvents[0].pairs).toBe(1);
    });
  });

  describe('Callback Context', () => {
    it('should pass correct streamId in onBatch callback', () => {
      const receivedContexts: string[] = [];
      const config: MultiStreamConfig = {
        baseUrl,
        apiToken,
        streams: [
          { id: 'my-stream', pageUrl: 'https://dexscreener.com/solana/trending' },
        ],
        onBatch: (_, ctx) => {
          receivedContexts.push(ctx.streamId!);
        },
      };
      const multiStream = new DexScreenerMultiStream(config);
      multiStream.startAll();
      const streamUrl = eventSourceConstructorCalls[0];
      const instance = mockEventSourceInstances.get(streamUrl)!;
      const pairsEvent = new MessageEvent('message', {
        data: JSON.stringify({ event_type: 'pairs', pairs: [] }),
      });
      instance.onmessage?.(pairsEvent);
      expect(receivedContexts).toEqual(['my-stream']);
    });

    it('should pass correct streamId in onPair callback', () => {
      const receivedContexts: string[] = [];
      const config: MultiStreamConfig = {
        baseUrl,
        apiToken,
        streams: [
          { id: 'pair-stream', pageUrl: 'https://dexscreener.com/solana/trending' },
        ],
        onPair: (_, ctx) => {
          receivedContexts.push(ctx.streamId!);
        },
      };
      const multiStream = new DexScreenerMultiStream(config);
      multiStream.startAll();
      const streamUrl = eventSourceConstructorCalls[0];
      const instance = mockEventSourceInstances.get(streamUrl)!;
      const pairsEvent = new MessageEvent('message', {
        data: JSON.stringify({
          event_type: 'pairs',
          pairs: [{ chainId: 'solana' }, { chainId: 'solana' }],
        }),
      });
      instance.onmessage?.(pairsEvent);
      expect(receivedContexts).toEqual(['pair-stream', 'pair-stream']);
    });
  });

  describe('getStream()', () => {
    it('should return undefined for non-existent stream ID', () => {
      const config: MultiStreamConfig = {
        baseUrl,
        apiToken,
        streams: [
          { id: 'existing', pageUrl: 'https://dexscreener.com/solana/trending' },
        ],
      };
      const multiStream = new DexScreenerMultiStream(config);
      expect(multiStream.getStream('non-existent')).toBeUndefined();
    });

    it('should return the correct stream for valid ID', () => {
      const config: MultiStreamConfig = {
        baseUrl,
        apiToken,
        streams: [
          { id: 'stream-a', pageUrl: 'https://dexscreener.com/solana/trending' },
          { id: 'stream-b', pageUrl: 'https://dexscreener.com/ethereum/trending' },
        ],
      };
      const multiStream = new DexScreenerMultiStream(config);
      const streamA = multiStream.getStream('stream-a');
      const streamB = multiStream.getStream('stream-b');
      expect(streamA).toBeDefined();
      expect(streamB).toBeDefined();
      expect(streamA).not.toBe(streamB);
    });
  });
});
