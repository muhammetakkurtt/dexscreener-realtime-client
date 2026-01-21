import { describe, it, expect } from 'vitest';
import { Aggregator } from '../src/aggregators/aggregator.js';
import type { DexEvent } from '../src/types.js';

describe('Aggregator', () => {
  const aggregator = new Aggregator();

  it('should aggregate event with multiple pairs', () => {
    const event: DexEvent = {
      timestamp: '2024-01-01T00:00:00Z',
      stats: {
        m5: { txns: 100, volumeUsd: 50000 },
        h1: { txns: 500, volumeUsd: 250000 },
      },
      pairs: [
        { chainId: 'solana', dexId: 'raydium', pairAddress: '0x1' },
        { chainId: 'solana', dexId: 'orca', pairAddress: '0x2' },
        { chainId: 'ethereum', dexId: 'uniswap', pairAddress: '0x3' },
        { chainId: 'ethereum', dexId: 'uniswap', pairAddress: '0x4' },
        { chainId: 'solana', dexId: 'raydium', pairAddress: '0x5' },
      ],
    };

    const result = aggregator.aggregate(event, 'test-stream');

    expect(result.timestamp).toBe('2024-01-01T00:00:00Z');
    expect(result.streamId).toBe('test-stream');
    expect(result.eventStats).toEqual(event.stats);
    expect(result.totalPairs).toBe(5);
    expect(result.uniqueChains).toBe(2);
    expect(result.uniqueDexs).toBe(3);
  });

  it('should calculate top chains correctly', () => {
    const event: DexEvent = {
      pairs: [
        { chainId: 'solana', dexId: 'raydium' },
        { chainId: 'solana', dexId: 'orca' },
        { chainId: 'ethereum', dexId: 'uniswap' },
        { chainId: 'solana', dexId: 'raydium' },
        { chainId: 'bsc', dexId: 'pancakeswap' },
      ],
    };

    const result = aggregator.aggregate(event, 'test-stream');

    expect(result.topChains).toEqual([
      { chain: 'solana', count: 3 },
      { chain: 'ethereum', count: 1 },
      { chain: 'bsc', count: 1 },
    ]);
  });

  it('should calculate top dexs correctly', () => {
    const event: DexEvent = {
      pairs: [
        { chainId: 'solana', dexId: 'raydium' },
        { chainId: 'solana', dexId: 'raydium' },
        { chainId: 'ethereum', dexId: 'uniswap' },
        { chainId: 'solana', dexId: 'orca' },
        { chainId: 'solana', dexId: 'raydium' },
      ],
    };

    const result = aggregator.aggregate(event, 'test-stream');

    expect(result.topDexs).toEqual([
      { dex: 'raydium', count: 3 },
      { dex: 'uniswap', count: 1 },
      { dex: 'orca', count: 1 },
    ]);
  });

  it('should handle empty pairs array', () => {
    const event: DexEvent = {
      timestamp: '2024-01-01T00:00:00Z',
      stats: {},
      pairs: [],
    };

    const result = aggregator.aggregate(event, 'test-stream');

    expect(result.totalPairs).toBe(0);
    expect(result.uniqueChains).toBe(0);
    expect(result.uniqueDexs).toBe(0);
    expect(result.topChains).toEqual([]);
    expect(result.topDexs).toEqual([]);
  });

  it('should handle missing pairs array', () => {
    const event: DexEvent = {
      timestamp: '2024-01-01T00:00:00Z',
      stats: {},
    };

    const result = aggregator.aggregate(event, 'test-stream');

    expect(result.totalPairs).toBe(0);
    expect(result.uniqueChains).toBe(0);
    expect(result.uniqueDexs).toBe(0);
    expect(result.topChains).toEqual([]);
    expect(result.topDexs).toEqual([]);
  });

  it('should handle pairs with missing chainId or dexId', () => {
    const event: DexEvent = {
      pairs: [
        { chainId: 'solana', dexId: 'raydium' },
        { chainId: 'solana' }, // missing dexId
        { dexId: 'uniswap' }, // missing chainId
        {}, // missing both
      ],
    };

    const result = aggregator.aggregate(event, 'test-stream');

    expect(result.totalPairs).toBe(4);
    expect(result.uniqueChains).toBe(1); // only 'solana'
    expect(result.uniqueDexs).toBe(2); // 'raydium' and 'uniswap'
    expect(result.topChains).toEqual([{ chain: 'solana', count: 2 }]);
    expect(result.topDexs).toEqual([
      { dex: 'raydium', count: 1 },
      { dex: 'uniswap', count: 1 },
    ]);
  });

  it('should use current timestamp when event timestamp is missing', () => {
    const event: DexEvent = {
      pairs: [],
    };

    const beforeTime = new Date().toISOString();
    const result = aggregator.aggregate(event, 'test-stream');
    const afterTime = new Date().toISOString();

    // Timestamp should be between before and after
    expect(result.timestamp >= beforeTime).toBe(true);
    expect(result.timestamp <= afterTime).toBe(true);
  });

  it('should preserve event stats', () => {
    const stats = {
      m5: { txns: 100, volumeUsd: 50000 },
      h1: { txns: 500, volumeUsd: 250000 },
      h6: { txns: 2000, volumeUsd: 1000000 },
      h24: { txns: 10000, volumeUsd: 5000000 },
    };

    const event: DexEvent = {
      stats,
      pairs: [],
    };

    const result = aggregator.aggregate(event, 'test-stream');

    expect(result.eventStats).toEqual(stats);
  });

  it('should handle missing event stats', () => {
    const event: DexEvent = {
      pairs: [],
    };

    const result = aggregator.aggregate(event, 'test-stream');

    expect(result.eventStats).toEqual({});
  });
});
