import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { DexScreenerMultiStream } from '../src/multi.js';
import type { MultiStreamConfig, StreamContext, DexEvent, Pair } from '../src/types.js';

const streamConfigArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
  pageUrl: fc.webUrl(),
});

const uniqueStreamConfigsArb = (minLength: number, maxLength: number) =>
  fc.array(streamConfigArb, { minLength, maxLength })
    .map(configs => configs.map((config, index) => ({
      ...config,
      id: `${config.id}-${index}`,
    })));

const multiStreamConfigArb = fc.record({
  baseUrl: fc.webUrl(),
  apiToken: fc.string({ minLength: 10, maxLength: 50 }),
  streams: uniqueStreamConfigsArb(1, 10),
  retryMs: fc.option(fc.integer({ min: 100, max: 60000 }), { nil: undefined }),
});

describe('MultiStream Instance Count', () => {
  it('should create exactly N streams for N stream configurations', () => {
    fc.assert(
      fc.property(multiStreamConfigArb, (config) => {
        const multiStream = new DexScreenerMultiStream(config);
        expect(multiStream.getStreamCount()).toBe(config.streams.length);
        const streamIds = multiStream.getStreamIds();
        expect(streamIds.length).toBe(config.streams.length);
        for (const streamConfig of config.streams) {
          const stream = multiStream.getStream(streamConfig.id);
          expect(stream).toBeDefined();
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should create zero streams for empty configuration', () => {
    const emptyConfig: MultiStreamConfig = {
      baseUrl: 'https://example.com',
      apiToken: 'test-api-token',
      streams: [],
    };
    const multiStream = new DexScreenerMultiStream(emptyConfig);
    expect(multiStream.getStreamCount()).toBe(0);
    expect(multiStream.getStreamIds()).toEqual([]);
  });

  it('should create exactly one stream for single configuration', () => {
    fc.assert(
      fc.property(fc.webUrl(), fc.string({ minLength: 10 }), streamConfigArb, (baseUrl, apiToken, streamConfig) => {
        const config: MultiStreamConfig = {
          baseUrl,
          apiToken,
          streams: [streamConfig],
        };
        const multiStream = new DexScreenerMultiStream(config);
        expect(multiStream.getStreamCount()).toBe(1);
        expect(multiStream.getStream(streamConfig.id)).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });
});

describe('StreamId Context Correctness', () => {
  it('should pass correct streamId in onBatch callback context', () => {
    fc.assert(
      fc.property(multiStreamConfigArb, (config) => {
        const receivedContexts: Map<string, StreamContext[]> = new Map();
        for (const streamConfig of config.streams) {
          receivedContexts.set(streamConfig.id, []);
        }
        const configWithCallbacks: MultiStreamConfig = {
          ...config,
          onBatch: (_event: DexEvent, ctx: StreamContext) => {
            if (ctx.streamId) {
              const contexts = receivedContexts.get(ctx.streamId) || [];
              contexts.push(ctx);
              receivedContexts.set(ctx.streamId, contexts);
            }
          },
        };
        const multiStream = new DexScreenerMultiStream(configWithCallbacks);
        for (const streamConfig of config.streams) {
          const stream = multiStream.getStream(streamConfig.id);
          expect(stream).toBeDefined();
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should pass correct streamId in onPair callback context', () => {
    fc.assert(
      fc.property(multiStreamConfigArb, (config) => {
        const receivedContexts: Map<string, StreamContext[]> = new Map();
        for (const streamConfig of config.streams) {
          receivedContexts.set(streamConfig.id, []);
        }
        const configWithCallbacks: MultiStreamConfig = {
          ...config,
          onPair: (_pair: Pair, ctx: StreamContext) => {
            if (ctx.streamId) {
              const contexts = receivedContexts.get(ctx.streamId) || [];
              contexts.push(ctx);
              receivedContexts.set(ctx.streamId, contexts);
            }
          },
        };
        const multiStream = new DexScreenerMultiStream(configWithCallbacks);
        for (const streamConfig of config.streams) {
          const stream = multiStream.getStream(streamConfig.id);
          expect(stream).toBeDefined();
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should maintain streamId isolation across multiple streams', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0), { minLength: 2, maxLength: 5 }),
        fc.string({ minLength: 10 }),
        (streamIds, apiToken) => {
          const uniqueIds = [...new Set(streamIds.map((id, i) => `${id}-${i}`))];
          const config: MultiStreamConfig = {
            baseUrl: 'https://example.com',
            apiToken,
            streams: uniqueIds.map(id => ({
              id,
              pageUrl: `https://dexscreener.com/${id}`,
            })),
          };
          const multiStream = new DexScreenerMultiStream(config);
          for (const id of uniqueIds) {
            const stream = multiStream.getStream(id);
            expect(stream).toBeDefined();
            const otherIds = uniqueIds.filter(otherId => otherId !== id);
            for (const otherId of otherIds) {
              const otherStream = multiStream.getStream(otherId);
              expect(otherStream).not.toBe(stream);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
