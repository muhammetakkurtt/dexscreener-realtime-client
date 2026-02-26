import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DexScreenerMultiStream } from '../src/multi';
import type { ConnectionState, MultiStreamConfig } from '../src/types';

const mockWebSocketInstances: Map<string, {
  close: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  _eventHandlers: Map<string, Function>;
}> = new Map();

let webSocketConstructorCalls: Array<{ url: string; options: any }> = [];

vi.mock('ws', () => {
  return {
    default: class MockWebSocket {
      close = vi.fn();
      _eventHandlers: Map<string, Function> = new Map();
      
      on = vi.fn((event: string, handler: Function) => {
        this._eventHandlers.set(event, handler);
      });
      
      constructor(url: string, options?: any) {
        const key = `${url}|${JSON.stringify(options)}`;
        webSocketConstructorCalls.push({ url, options });
        const instance = {
          close: vi.fn(),
          on: vi.fn((event: string, handler: Function) => {
            instance._eventHandlers.set(event, handler);
          }),
          _eventHandlers: new Map<string, Function>(),
        };
        mockWebSocketInstances.set(key, instance);
        Object.assign(this, instance);
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
    webSocketConstructorCalls = [];
    mockWebSocketInstances.clear();
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
      expect(webSocketConstructorCalls.length).toBe(3);
    });

    it('should create WebSocket for each stream with correct URL', () => {
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
      expect(webSocketConstructorCalls[0].url).toContain(encodeURIComponent('https://dexscreener.com/solana/trending'));
      expect(webSocketConstructorCalls[1].url).toContain(encodeURIComponent('https://dexscreener.com/ethereum/trending'));
    });

    it('should handle empty streams array', () => {
      const config: MultiStreamConfig = {
        baseUrl,
        apiToken,
        streams: [],
      };
      const multiStream = new DexScreenerMultiStream(config);
      multiStream.startAll();
      expect(webSocketConstructorCalls.length).toBe(0);
    });

    it('should pass authMode to all streams', () => {
      const config: MultiStreamConfig = {
        baseUrl,
        apiToken,
        authMode: 'query',
        streams: [
          { id: 'stream-1', pageUrl: 'https://dexscreener.com/solana/trending' },
          { id: 'stream-2', pageUrl: 'https://dexscreener.com/ethereum/trending' },
        ],
      };
      const multiStream = new DexScreenerMultiStream(config);
      multiStream.startAll();
      // When authMode is 'query', token should be in URL
      expect(webSocketConstructorCalls[0].url).toContain('token=');
      expect(webSocketConstructorCalls[1].url).toContain('token=');
    });

    it('should use header auth when authMode is header', () => {
      const config: MultiStreamConfig = {
        baseUrl,
        apiToken,
        authMode: 'header',
        streams: [
          { id: 'stream-1', pageUrl: 'https://dexscreener.com/solana/trending' },
        ],
      };
      const multiStream = new DexScreenerMultiStream(config);
      multiStream.startAll();
      // When authMode is 'header', token should NOT be in URL but in headers
      expect(webSocketConstructorCalls[0].url).not.toContain('token=');
      expect(webSocketConstructorCalls[0].options?.headers?.Authorization).toBe(`Bearer ${apiToken}`);
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
      for (const instance of mockWebSocketInstances.values()) {
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
      expect(webSocketConstructorCalls.length).toBe(1);
      multiStream.stopAll();
      multiStream.startAll();
      expect(webSocketConstructorCalls.length).toBe(2);
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
      expect(webSocketConstructorCalls.length).toBe(2);
      
      // Get first stream instance and trigger close event (network error)
      const stream1Key = Array.from(mockWebSocketInstances.keys())[0];
      const stream1Instance = mockWebSocketInstances.get(stream1Key)!;
      const closeHandler = stream1Instance._eventHandlers.get('close');
      // Close code 1006 is abnormal closure (network error) - should trigger reconnection
      closeHandler?.(1006, Buffer.from('Connection lost'));
      
      // Advance timers to trigger reconnection
      vi.advanceTimersByTime(3000);
      expect(webSocketConstructorCalls.length).toBe(3);
      
      // Verify second stream was not affected
      const stream2Key = Array.from(mockWebSocketInstances.keys())[1];
      const stream2Instance = mockWebSocketInstances.get(stream2Key)!;
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
      
      // Trigger error on failing stream
      const failingKey = Array.from(mockWebSocketInstances.keys())[1];
      const failingInstance = mockWebSocketInstances.get(failingKey)!;
      const errorHandler = failingInstance._eventHandlers.get('error');
      errorHandler?.(new Error('Connection failed'));
      
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
      
      // Trigger error on failing stream
      const failingKey = Array.from(mockWebSocketInstances.keys())[1];
      const failingInstance = mockWebSocketInstances.get(failingKey)!;
      const errorHandler = failingInstance._eventHandlers.get('error');
      errorHandler?.(new Error('Connection failed'));
      
      // Send message to healthy stream
      const healthyKey = Array.from(mockWebSocketInstances.keys())[0];
      const healthyInstance = mockWebSocketInstances.get(healthyKey)!;
      const messageHandler = healthyInstance._eventHandlers.get('message');
      const messageData = JSON.stringify({
        event_type: 'pairs',
        pairs: [{ chainId: 'solana', baseToken: { symbol: 'SOL' } }],
      });
      messageHandler?.(messageData);
      
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
      
      // Get the WebSocket instance and trigger message
      const wsKey = Array.from(mockWebSocketInstances.keys())[0];
      const instance = mockWebSocketInstances.get(wsKey)!;
      const messageHandler = instance._eventHandlers.get('message');
      const messageData = JSON.stringify({ event_type: 'pairs', pairs: [] });
      messageHandler?.(messageData);
      
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
      
      // Get the WebSocket instance and trigger message with pairs
      const wsKey = Array.from(mockWebSocketInstances.keys())[0];
      const instance = mockWebSocketInstances.get(wsKey)!;
      const messageHandler = instance._eventHandlers.get('message');
      const messageData = JSON.stringify({
        event_type: 'pairs',
        pairs: [{ chainId: 'solana' }, { chainId: 'solana' }],
      });
      messageHandler?.(messageData);
      
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
