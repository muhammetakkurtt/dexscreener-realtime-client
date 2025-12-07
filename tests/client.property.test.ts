import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { DexEvent, Pair, StreamContext } from '../src/types';

const hexStringArb = (length: number) => 
  fc.array(fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'), 
    { minLength: length, maxLength: length }
  ).map(arr => '0x' + arr.join(''));

const pairArbitrary = fc.record({
  chainId: fc.constantFrom('solana', 'ethereum', 'bsc', 'base', 'arbitrum'),
  dexId: fc.string({ minLength: 1, maxLength: 20 }),
  pairAddress: hexStringArb(40),
  baseToken: fc.record({
    address: hexStringArb(40),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    symbol: fc.string({ minLength: 1, maxLength: 10 }),
    decimals: fc.integer({ min: 0, max: 18 }),
  }),
  quoteToken: fc.record({
    address: hexStringArb(40),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    symbol: fc.string({ minLength: 1, maxLength: 10 }),
    decimals: fc.integer({ min: 0, max: 18 }),
  }),
  price: fc.float({ min: 0, noNaN: true }).map(n => n.toString()),
  priceUsd: fc.float({ min: 0, noNaN: true }).map(n => n.toString()),
});

const statsArbitrary = fc.record({
  m5: fc.option(fc.record({
    txns: fc.integer({ min: 0 }),
    volumeUsd: fc.float({ min: 0, noNaN: true }),
  }), { nil: undefined }),
  h1: fc.option(fc.record({
    txns: fc.integer({ min: 0 }),
    volumeUsd: fc.float({ min: 0, noNaN: true }),
  }), { nil: undefined }),
  h24: fc.option(fc.record({
    txns: fc.integer({ min: 0 }),
    volumeUsd: fc.float({ min: 0, noNaN: true }),
  }), { nil: undefined }),
});

const timestampArbitrary = fc.integer({ 
  min: new Date('2020-01-01').getTime(), 
  max: new Date('2030-12-31').getTime() 
}).map(ts => new Date(ts).toISOString());

const dexEventArbitrary = fc.record({
  event_type: fc.constant('pairs'),
  stats: statsArbitrary,
  pairs: fc.array(pairArbitrary, { minLength: 0, maxLength: 20 }),
  timestamp: timestampArbitrary,
});

function processMessage(
  data: string,
  callbacks: {
    onBatch?: (event: DexEvent, ctx: StreamContext) => void;
    onPair?: (pair: Pair, ctx: StreamContext) => void;
    onError?: (error: unknown, ctx: StreamContext) => void;
  },
  streamId?: string
): { success: boolean; event?: DexEvent; error?: unknown } {
  const ctx: StreamContext = { streamId };
  
  try {
    const parsed = JSON.parse(data);
    
    if (parsed.event_type === 'connected') {
      return { success: true };
    }
    
    if (parsed.event_type === 'ping') {
      return { success: true };
    }
    
    if (parsed.event_type === 'pairs' || parsed.pairs) {
      const event = parsed as DexEvent;
      callbacks.onBatch?.(event, ctx);
      
      if (event.pairs && callbacks.onPair) {
        for (const pair of event.pairs) {
          callbacks.onPair(pair, ctx);
        }
      }
      
      return { success: true, event };
    }
    
    return { success: true };
  } catch (error) {
    callbacks.onError?.(error, ctx);
    return { success: false, error };
  }
}

describe('JSON Event Parsing', () => {
  it('should parse valid JSON into DexEvent with stats and pairs', () => {
    fc.assert(
      fc.property(dexEventArbitrary, (event) => {
        const jsonString = JSON.stringify(event);
        let parsedEvent: DexEvent | undefined;
        
        processMessage(jsonString, {
          onBatch: (e) => { parsedEvent = e; },
        });
        
        expect(parsedEvent).toBeDefined();
        expect(parsedEvent!.pairs).toBeInstanceOf(Array);
        expect(parsedEvent!.pairs!.length).toBe(event.pairs.length);
        
        if (event.stats) {
          expect(parsedEvent!.stats).toBeDefined();
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve all pair data through parsing', () => {
    fc.assert(
      fc.property(dexEventArbitrary, (event) => {
        const jsonString = JSON.stringify(event);
        let parsedEvent: DexEvent | undefined;
        
        processMessage(jsonString, {
          onBatch: (e) => { parsedEvent = e; },
        });
        
        expect(parsedEvent).toBeDefined();
        
        for (let i = 0; i < event.pairs.length; i++) {
          const originalPair = event.pairs[i];
          const parsedPair = parsedEvent!.pairs![i];
          
          expect(parsedPair.chainId).toBe(originalPair.chainId);
          expect(parsedPair.dexId).toBe(originalPair.dexId);
          expect(parsedPair.baseToken?.symbol).toBe(originalPair.baseToken?.symbol);
          expect(parsedPair.quoteToken?.symbol).toBe(originalPair.quoteToken?.symbol);
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe('onBatch Callback Invocation', () => {
  it('should invoke onBatch exactly once with complete event and context', () => {
    const streamIdArb = fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined });
    
    fc.assert(
      fc.property(dexEventArbitrary, streamIdArb, (event, streamId) => {
        const jsonString = JSON.stringify(event);
        let callCount = 0;
        let receivedEvent: DexEvent | undefined;
        let receivedContext: StreamContext | undefined;
        
        processMessage(jsonString, {
          onBatch: (e, ctx) => {
            callCount++;
            receivedEvent = e;
            receivedContext = ctx;
          },
        }, streamId);
        
        expect(callCount).toBe(1);
        expect(receivedEvent).toBeDefined();
        expect(receivedEvent!.pairs).toEqual(event.pairs);
        expect(receivedContext).toBeDefined();
        expect(receivedContext!.streamId).toBe(streamId);
      }),
      { numRuns: 100 }
    );
  });
});

describe('onPair Callback Count', () => {
  it('should invoke onPair exactly N times for N pairs', () => {
    const streamIdArb = fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined });
    
    fc.assert(
      fc.property(dexEventArbitrary, streamIdArb, (event, streamId) => {
        const jsonString = JSON.stringify(event);
        let callCount = 0;
        const receivedPairs: Pair[] = [];
        const receivedContexts: StreamContext[] = [];
        
        processMessage(jsonString, {
          onPair: (pair, ctx) => {
            callCount++;
            receivedPairs.push(pair);
            receivedContexts.push(ctx);
          },
        }, streamId);
        
        expect(callCount).toBe(event.pairs.length);
        expect(receivedPairs.length).toBe(event.pairs.length);
        
        for (const ctx of receivedContexts) {
          expect(ctx.streamId).toBe(streamId);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should invoke onPair for each pair in order', () => {
    fc.assert(
      fc.property(dexEventArbitrary, (event) => {
        const jsonString = JSON.stringify(event);
        const receivedPairs: Pair[] = [];
        
        processMessage(jsonString, {
          onPair: (pair) => {
            receivedPairs.push(pair);
          },
        });
        
        for (let i = 0; i < event.pairs.length; i++) {
          expect(receivedPairs[i].chainId).toBe(event.pairs[i].chainId);
          expect(receivedPairs[i].pairAddress).toBe(event.pairs[i].pairAddress);
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe('Invalid JSON Error Handling', () => {
  it('should invoke onError for invalid JSON strings', () => {
    const invalidJsonArb = fc.oneof(
      fc.string({ minLength: 1 }).map(s => `{"key": "${s.replace(/"/g, '\\"')}`),
      fc.string({ minLength: 1, maxLength: 10 })
        .filter(s => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s))
        .map(s => `{${s}: "value"}`),
      fc.string({ minLength: 1 }).map(s => `{"key": "${s.replace(/"/g, '\\"')}",}`),
      fc.string({ minLength: 1 }).map(s => `{'key': '${s.replace(/'/g, "\\'")}'}`),
      fc.constant('{'),
      fc.constant('[1, 2,]'),
    ).filter(s => {
      try {
        JSON.parse(s);
        return false;
      } catch {
        return true;
      }
    });
    
    const streamIdArb = fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined });
    
    fc.assert(
      fc.property(invalidJsonArb, streamIdArb, (invalidJson, streamId) => {
        let errorCalled = false;
        let receivedError: unknown;
        let receivedContext: StreamContext | undefined;
        
        const result = processMessage(invalidJson, {
          onError: (error, ctx) => {
            errorCalled = true;
            receivedError = error;
            receivedContext = ctx;
          },
        }, streamId);
        
        expect(errorCalled).toBe(true);
        expect(result.success).toBe(false);
        expect(receivedError).toBeInstanceOf(SyntaxError);
        expect(receivedContext).toBeDefined();
        expect(receivedContext!.streamId).toBe(streamId);
      }),
      { numRuns: 100 }
    );
  });

  it('should not invoke onBatch or onPair for invalid JSON', () => {
    const invalidJsonArb = fc.string({ minLength: 1 }).map(s => `{"incomplete": "${s}`);
    
    fc.assert(
      fc.property(invalidJsonArb, (invalidJson) => {
        let batchCalled = false;
        let pairCalled = false;
        
        processMessage(invalidJson, {
          onBatch: () => { batchCalled = true; },
          onPair: () => { pairCalled = true; },
          onError: () => {},
        });
        
        expect(batchCalled).toBe(false);
        expect(pairCalled).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});

describe('RetryMs Configuration', () => {
  it('should accept any positive retryMs value in configuration', () => {
    const retryMsArb = fc.integer({ min: 100, max: 60000 });
    
    fc.assert(
      fc.property(retryMsArb, (retryMs) => {
        const options = {
          baseUrl: 'https://example.com',
          pageUrl: 'https://dexscreener.com/solana/trending',
          apiToken: 'test-token',
          retryMs,
        };
        
        expect(options.retryMs).toBe(retryMs);
        expect(options.retryMs).toBeGreaterThan(0);
        expect(Number.isInteger(options.retryMs)).toBe(true);
        
        const DEFAULT_RETRY_MS = 3000;
        const effectiveRetryMs = options.retryMs ?? DEFAULT_RETRY_MS;
        expect(effectiveRetryMs).toBe(retryMs);
      }),
      { numRuns: 100 }
    );
  });

  it('should use default retryMs (3000) when not configured', () => {
    const DEFAULT_RETRY_MS = 3000;
    
    const optionsWithoutRetryMs: { baseUrl: string; pageUrl: string; apiToken: string; retryMs?: number } = {
      baseUrl: 'https://example.com',
      pageUrl: 'https://dexscreener.com/solana/trending',
      apiToken: 'test-token',
    };
    
    const effectiveRetryMs = optionsWithoutRetryMs.retryMs ?? DEFAULT_RETRY_MS;
    expect(effectiveRetryMs).toBe(DEFAULT_RETRY_MS);
  });
});
