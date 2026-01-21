import { describe, it, expect } from 'vitest';
import { ProcessingPipeline } from '../src/pipeline/index.js';
import type { DexEvent, Pair } from '../src/types.js';

describe('ProcessingPipeline', () => {
  const createPair = (overrides: Partial<Pair> = {}): Pair => ({
    chainId: 'ethereum',
    dexId: 'uniswap',
    pairAddress: '0x123',
    baseToken: { symbol: 'ETH', address: '0xabc' },
    quoteToken: { symbol: 'USDC', address: '0xdef' },
    priceUsd: '2000',
    liquidity: { usd: 50000 },
    volume: { h24: 100000 },
    priceChange: { h24: 5 },
    ...overrides,
  });

  const createEvent = (pairs: Pair[]): DexEvent => ({
    pairs,
    stats: { h24: { txns: 1000, volumeUsd: 500000 } },
    timestamp: new Date().toISOString(),
  });

  describe('constructor', () => {
    it('should create pipeline with no configuration', () => {
      const pipeline = new ProcessingPipeline({});
      expect(pipeline.getFilterCount()).toBe(0);
      expect(pipeline.hasTransformer()).toBe(false);
      expect(pipeline.hasAggregator()).toBe(false);
    });

    it('should create pipeline with filters', () => {
      const pipeline = new ProcessingPipeline({
        filters: [
          { type: 'chain', params: { chains: ['ethereum'] } },
          { type: 'liquidity', params: { minUsd: 10000 } },
        ],
      });
      expect(pipeline.getFilterCount()).toBe(2);
    });

    it('should create pipeline with transformer', () => {
      const pipeline = new ProcessingPipeline({
        transforms: {
          fields: ['baseToken.symbol', 'priceUsd'],
        },
      });
      expect(pipeline.hasTransformer()).toBe(true);
    });

    it('should create pipeline with aggregator', () => {
      const pipeline = new ProcessingPipeline({
        aggregate: true,
      });
      expect(pipeline.hasAggregator()).toBe(true);
    });

    it('should handle invalid filter configuration gracefully', () => {
      const pipeline = new ProcessingPipeline({
        filters: [
          { type: 'chain', params: { chains: 'invalid' } }, // Invalid params
        ],
      });
      // Should not throw, but filter count should be 0
      expect(pipeline.getFilterCount()).toBe(0);
    });
  });

  describe('process - no configuration', () => {
    it('should pass through all pairs when no filters configured', () => {
      const pipeline = new ProcessingPipeline({});
      const pairs = [createPair(), createPair({ chainId: 'solana' })];
      const event = createEvent(pairs);

      const result = pipeline.process(event, 'stream-1');

      expect(result.filtered).toBe(false);
      expect(result.transformed).toHaveLength(2);
      expect(result.droppedPairs).toBe(0);
    });

    it('should handle empty event', () => {
      const pipeline = new ProcessingPipeline({});
      const event = createEvent([]);

      const result = pipeline.process(event, 'stream-1');

      expect(result.filtered).toBe(false);
      expect(result.transformed).toHaveLength(0);
      expect(result.droppedPairs).toBe(0);
    });

    it('should handle event without pairs array', () => {
      const pipeline = new ProcessingPipeline({});
      const event: DexEvent = {
        stats: { h24: { txns: 1000, volumeUsd: 500000 } },
      };

      const result = pipeline.process(event, 'stream-1');

      expect(result.filtered).toBe(false);
      expect(result.transformed).toHaveLength(0);
      expect(result.droppedPairs).toBe(0);
    });
  });

  describe('process - filtering', () => {
    it('should filter pairs by chain', () => {
      const pipeline = new ProcessingPipeline({
        filters: [
          { type: 'chain', params: { chains: ['ethereum'] } },
        ],
      });

      const pairs = [
        createPair({ chainId: 'ethereum' }),
        createPair({ chainId: 'solana' }),
        createPair({ chainId: 'ethereum' }),
      ];
      const event = createEvent(pairs);

      const result = pipeline.process(event, 'stream-1');

      expect(result.filtered).toBe(false);
      expect(result.transformed).toHaveLength(2);
      expect(result.droppedPairs).toBe(1);
    });

    it('should filter pairs by liquidity', () => {
      const pipeline = new ProcessingPipeline({
        filters: [
          { type: 'liquidity', params: { minUsd: 100000 } },
        ],
      });

      const pairs = [
        createPair({ liquidity: { usd: 150000 } }),
        createPair({ liquidity: { usd: 50000 } }),
        createPair({ liquidity: { usd: 200000 } }),
      ];
      const event = createEvent(pairs);

      const result = pipeline.process(event, 'stream-1');

      expect(result.filtered).toBe(false);
      expect(result.transformed).toHaveLength(2);
      expect(result.droppedPairs).toBe(1);
    });

    it('should apply multiple filters with AND logic', () => {
      const pipeline = new ProcessingPipeline({
        filters: [
          { type: 'chain', params: { chains: ['ethereum'] } },
          { type: 'liquidity', params: { minUsd: 100000 } },
        ],
      });

      const pairs = [
        createPair({ chainId: 'ethereum', liquidity: { usd: 150000 } }), // Pass both
        createPair({ chainId: 'ethereum', liquidity: { usd: 50000 } }),  // Fail liquidity
        createPair({ chainId: 'solana', liquidity: { usd: 150000 } }),   // Fail chain
        createPair({ chainId: 'solana', liquidity: { usd: 50000 } }),    // Fail both
      ];
      const event = createEvent(pairs);

      const result = pipeline.process(event, 'stream-1');

      expect(result.filtered).toBe(false);
      expect(result.transformed).toHaveLength(1);
      expect(result.droppedPairs).toBe(3);
    });

    it('should set filtered=true when all pairs are filtered out', () => {
      const pipeline = new ProcessingPipeline({
        filters: [
          { type: 'chain', params: { chains: ['solana'] } },
        ],
      });

      const pairs = [
        createPair({ chainId: 'ethereum' }),
        createPair({ chainId: 'ethereum' }),
      ];
      const event = createEvent(pairs);

      const result = pipeline.process(event, 'stream-1');

      expect(result.filtered).toBe(true);
      expect(result.transformed).toHaveLength(0);
      expect(result.droppedPairs).toBe(2);
    });

    it('should handle filter execution errors gracefully', () => {
      const pipeline = new ProcessingPipeline({
        filters: [
          { type: 'chain', params: { chains: ['ethereum'] } },
        ],
      });

      // Create a pair that might cause issues
      const pairs = [
        createPair({ chainId: 'ethereum' }),
        createPair({ chainId: undefined as any }),
      ];
      const event = createEvent(pairs);

      const result = pipeline.process(event, 'stream-1');

      // Should not throw, should handle gracefully
      expect(result.transformed).toHaveLength(1);
      expect(result.droppedPairs).toBe(1);
    });
  });

  describe('process - transformation', () => {
    it('should transform pairs with field selection', () => {
      const pipeline = new ProcessingPipeline({
        transforms: {
          fields: ['baseToken.symbol', 'priceUsd'],
        },
      });

      const pairs = [createPair()];
      const event = createEvent(pairs);

      const result = pipeline.process(event, 'stream-1');

      expect(result.transformed).toHaveLength(1);
      expect(result.transformed![0]).toEqual({
        baseToken: { symbol: 'ETH' },
        priceUsd: '2000',
      });
    });

    it('should transform pairs with field aliasing', () => {
      const pipeline = new ProcessingPipeline({
        transforms: {
          fields: ['priceUsd'],
          aliases: { priceUsd: 'price' },
        },
      });

      const pairs = [createPair()];
      const event = createEvent(pairs);

      const result = pipeline.process(event, 'stream-1');

      expect(result.transformed).toHaveLength(1);
      expect(result.transformed![0]).toEqual({
        price: '2000',
      });
    });

    it('should handle transformation errors gracefully', () => {
      const pipeline = new ProcessingPipeline({
        transforms: {
          fields: ['baseToken.symbol'],
        },
      });

      const pairs = [createPair()];
      const event = createEvent(pairs);

      const result = pipeline.process(event, 'stream-1');

      // Should not throw
      expect(result.transformed).toBeDefined();
    });
  });

  describe('process - filtering and transformation', () => {
    it('should filter then transform pairs', () => {
      const pipeline = new ProcessingPipeline({
        filters: [
          { type: 'chain', params: { chains: ['ethereum'] } },
        ],
        transforms: {
          fields: ['baseToken.symbol', 'chainId'],
        },
      });

      const pairs = [
        createPair({ chainId: 'ethereum', baseToken: { symbol: 'ETH' } }),
        createPair({ chainId: 'solana', baseToken: { symbol: 'SOL' } }),
      ];
      const event = createEvent(pairs);

      const result = pipeline.process(event, 'stream-1');

      expect(result.transformed).toHaveLength(1);
      expect(result.transformed![0]).toEqual({
        baseToken: { symbol: 'ETH' },
        chainId: 'ethereum',
      });
      expect(result.droppedPairs).toBe(1);
    });

    it('should not transform when all pairs are filtered out', () => {
      const pipeline = new ProcessingPipeline({
        filters: [
          { type: 'chain', params: { chains: ['solana'] } },
        ],
        transforms: {
          fields: ['baseToken.symbol'],
        },
      });

      const pairs = [createPair({ chainId: 'ethereum' })];
      const event = createEvent(pairs);

      const result = pipeline.process(event, 'stream-1');

      expect(result.filtered).toBe(true);
      expect(result.transformed).toHaveLength(0);
    });
  });

  describe('process - aggregation', () => {
    it('should aggregate event statistics', () => {
      const pipeline = new ProcessingPipeline({
        aggregate: true,
      });

      const pairs = [
        createPair({ chainId: 'ethereum', dexId: 'uniswap' }),
        createPair({ chainId: 'ethereum', dexId: 'sushiswap' }),
        createPair({ chainId: 'solana', dexId: 'raydium' }),
      ];
      const event = createEvent(pairs);

      const result = pipeline.process(event, 'stream-1');

      expect(result.aggregated).toBeDefined();
      expect(result.aggregated!.totalPairs).toBe(3);
      expect(result.aggregated!.uniqueChains).toBe(2);
      expect(result.aggregated!.uniqueDexs).toBe(3);
      expect(result.aggregated!.streamId).toBe('stream-1');
    });

    it('should aggregate filtered pairs', () => {
      const pipeline = new ProcessingPipeline({
        filters: [
          { type: 'chain', params: { chains: ['ethereum'] } },
        ],
        aggregate: true,
      });

      const pairs = [
        createPair({ chainId: 'ethereum', dexId: 'uniswap' }),
        createPair({ chainId: 'solana', dexId: 'raydium' }),
      ];
      const event = createEvent(pairs);

      const result = pipeline.process(event, 'stream-1');

      expect(result.aggregated).toBeDefined();
      expect(result.aggregated!.totalPairs).toBe(1);
      expect(result.aggregated!.uniqueChains).toBe(1);
    });

    it('should handle aggregation errors gracefully', () => {
      const pipeline = new ProcessingPipeline({
        aggregate: true,
      });

      const pairs = [createPair()];
      const event = createEvent(pairs);

      const result = pipeline.process(event, 'stream-1');

      // Should not throw
      expect(result.aggregated).toBeDefined();
    });
  });

  describe('process - complete pipeline', () => {
    it('should process through all stages: filter, transform, aggregate', () => {
      const pipeline = new ProcessingPipeline({
        filters: [
          { type: 'chain', params: { chains: ['ethereum'] } },
          { type: 'liquidity', params: { minUsd: 100000 } },
        ],
        transforms: {
          fields: ['baseToken.symbol', 'priceUsd', 'chainId'],
          aliases: { priceUsd: 'price' },
        },
        aggregate: true,
      });

      const pairs = [
        createPair({ 
          chainId: 'ethereum', 
          liquidity: { usd: 150000 },
          baseToken: { symbol: 'ETH' },
          priceUsd: '2000',
        }),
        createPair({ 
          chainId: 'ethereum', 
          liquidity: { usd: 50000 },
          baseToken: { symbol: 'USDC' },
        }),
        createPair({ 
          chainId: 'solana', 
          liquidity: { usd: 200000 },
          baseToken: { symbol: 'SOL' },
        }),
      ];
      const event = createEvent(pairs);

      const result = pipeline.process(event, 'stream-1');

      // Check filtering
      expect(result.droppedPairs).toBe(2);
      
      // Check transformation
      expect(result.transformed).toHaveLength(1);
      expect(result.transformed![0]).toEqual({
        baseToken: { symbol: 'ETH' },
        price: '2000',
        chainId: 'ethereum',
      });
      
      // Check aggregation
      expect(result.aggregated).toBeDefined();
      expect(result.aggregated!.totalPairs).toBe(1);
      expect(result.aggregated!.uniqueChains).toBe(1);
    });
  });

  describe('helper methods', () => {
    it('should return correct filter count', () => {
      const pipeline1 = new ProcessingPipeline({});
      expect(pipeline1.getFilterCount()).toBe(0);

      const pipeline2 = new ProcessingPipeline({
        filters: [
          { type: 'chain', params: { chains: ['ethereum'] } },
          { type: 'liquidity', params: { minUsd: 10000 } },
        ],
      });
      expect(pipeline2.getFilterCount()).toBe(2);
    });

    it('should return correct transformer status', () => {
      const pipeline1 = new ProcessingPipeline({});
      expect(pipeline1.hasTransformer()).toBe(false);

      const pipeline2 = new ProcessingPipeline({
        transforms: { fields: ['priceUsd'] },
      });
      expect(pipeline2.hasTransformer()).toBe(true);
    });

    it('should return correct aggregator status', () => {
      const pipeline1 = new ProcessingPipeline({});
      expect(pipeline1.hasAggregator()).toBe(false);

      const pipeline2 = new ProcessingPipeline({ aggregate: true });
      expect(pipeline2.hasAggregator()).toBe(true);

      const pipeline3 = new ProcessingPipeline({ aggregate: false });
      expect(pipeline3.hasAggregator()).toBe(false);
    });
  });
});
