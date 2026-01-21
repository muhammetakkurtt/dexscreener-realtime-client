import { describe, it, expect } from 'vitest';
import { Transformer } from '../src/transforms/transformer.js';
import type { Pair } from '../src/types.js';

describe('Transformer', () => {
  const mockPair: Pair = {
    chainId: 'solana',
    dexId: 'raydium',
    pairAddress: '0x123',
    baseToken: {
      address: '0xabc',
      name: 'Solana',
      symbol: 'SOL',
      decimals: 9
    },
    quoteToken: {
      address: '0xdef',
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6
    },
    priceUsd: '123.45',
    liquidity: {
      usd: 1000000,
      base: 5000,
      quote: 617250
    },
    volume: {
      h24: 500000,
      h6: 150000,
      h1: 30000,
      m5: 2500
    },
    priceChange: {
      h24: 5.2,
      h6: 2.1,
      h1: 0.8,
      m5: 0.1
    }
  };

  describe('Field Selection', () => {
    it('should select top-level fields', () => {
      const transformer = new Transformer({
        fields: ['chainId', 'priceUsd']
      });

      const result = transformer.transform(mockPair);

      expect(result).toEqual({
        chainId: 'solana',
        priceUsd: '123.45'
      });
    });

    it('should select nested fields with dot notation', () => {
      const transformer = new Transformer({
        fields: ['baseToken.symbol', 'baseToken.decimals']
      });

      const result = transformer.transform(mockPair);

      expect(result).toEqual({
        baseToken: {
          symbol: 'SOL',
          decimals: 9
        }
      });
    });

    it('should select deeply nested fields', () => {
      const transformer = new Transformer({
        fields: ['liquidity.usd', 'volume.h24']
      });

      const result = transformer.transform(mockPair);

      expect(result).toEqual({
        liquidity: {
          usd: 1000000
        },
        volume: {
          h24: 500000
        }
      });
    });

    it('should handle missing fields gracefully', () => {
      const transformer = new Transformer({
        fields: ['chainId', 'nonExistentField', 'baseToken.nonExistent']
      });

      const result = transformer.transform(mockPair);

      expect(result).toEqual({
        chainId: 'solana'
      });
    });

    it('should preserve nested structure when selecting multiple fields from same parent', () => {
      const transformer = new Transformer({
        fields: ['baseToken.symbol', 'baseToken.name', 'quoteToken.symbol']
      });

      const result = transformer.transform(mockPair);

      expect(result).toEqual({
        baseToken: {
          symbol: 'SOL',
          name: 'Solana'
        },
        quoteToken: {
          symbol: 'USDC'
        }
      });
    });
  });

  describe('Field Aliasing', () => {
    it('should rename top-level fields', () => {
      const transformer = new Transformer({
        fields: ['priceUsd', 'chainId'],
        aliases: {
          priceUsd: 'price',
          chainId: 'chain'
        }
      });

      const result = transformer.transform(mockPair);

      expect(result).toEqual({
        price: '123.45',
        chain: 'solana'
      });
    });

    it('should apply aliases to nested objects', () => {
      const transformer = new Transformer({
        fields: ['baseToken.symbol', 'baseToken.decimals'],
        aliases: {
          symbol: 'ticker',
          decimals: 'precision'
        }
      });

      const result = transformer.transform(mockPair);

      expect(result).toEqual({
        baseToken: {
          ticker: 'SOL',
          precision: 9
        }
      });
    });

    it('should handle aliases without field selection', () => {
      const pairSubset: Pair = {
        chainId: 'solana',
        priceUsd: '123.45'
      };

      const transformer = new Transformer({
        aliases: {
          priceUsd: 'price',
          chainId: 'chain'
        }
      });

      const result = transformer.transform(pairSubset);

      expect(result).toHaveProperty('price', '123.45');
      expect(result).toHaveProperty('chain', 'solana');
    });
  });

  describe('No Field Selection', () => {
    it('should return unchanged pair when no fields specified', () => {
      const transformer = new Transformer({});

      const result = transformer.transform(mockPair);

      expect(result).toEqual(mockPair);
    });

    it('should return unchanged pair when fields array is empty', () => {
      const transformer = new Transformer({
        fields: []
      });

      const result = transformer.transform(mockPair);

      expect(result).toEqual(mockPair);
    });
  });

  describe('Batch Transformation', () => {
    it('should transform multiple pairs', () => {
      const pairs: Pair[] = [
        { chainId: 'solana', priceUsd: '123.45' },
        { chainId: 'ethereum', priceUsd: '2500.00' },
        { chainId: 'bsc', priceUsd: '0.99' }
      ];

      const transformer = new Transformer({
        fields: ['chainId', 'priceUsd'],
        aliases: { priceUsd: 'price' }
      });

      const results = transformer.transformBatch(pairs);

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ chainId: 'solana', price: '123.45' });
      expect(results[1]).toEqual({ chainId: 'ethereum', price: '2500.00' });
      expect(results[2]).toEqual({ chainId: 'bsc', price: '0.99' });
    });

    it('should handle empty array', () => {
      const transformer = new Transformer({
        fields: ['chainId']
      });

      const results = transformer.transformBatch([]);

      expect(results).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null values in nested paths', () => {
      const pairWithNull: Pair = {
        chainId: 'solana',
        baseToken: null as any
      };

      const transformer = new Transformer({
        fields: ['chainId', 'baseToken.symbol']
      });

      const result = transformer.transform(pairWithNull);

      expect(result).toEqual({
        chainId: 'solana'
      });
    });

    it('should handle undefined values in nested paths', () => {
      const pairWithUndefined: Pair = {
        chainId: 'solana',
        baseToken: undefined as any
      };

      const transformer = new Transformer({
        fields: ['chainId', 'baseToken.symbol']
      });

      const result = transformer.transform(pairWithUndefined);

      expect(result).toEqual({
        chainId: 'solana'
      });
    });

    it('should handle empty field path segments', () => {
      const transformer = new Transformer({
        fields: ['chainId', '', 'priceUsd']
      });

      const result = transformer.transform(mockPair);

      expect(result).toEqual({
        chainId: 'solana',
        priceUsd: '123.45'
      });
    });

    it('should handle field paths with multiple dots', () => {
      const transformer = new Transformer({
        fields: ['baseToken..symbol']
      });

      const result = transformer.transform(mockPair);

      // Empty segments are filtered out, so this should work like 'baseToken.symbol'
      expect(result).toEqual({
        baseToken: {
          symbol: 'SOL'
        }
      });
    });
  });

  describe('Computed Fields', () => {
    it('should add computed fields using functions', () => {
      const transformer = new Transformer({
        fields: ['chainId', 'priceUsd'],
        computed: [
          {
            name: 'priceNumber',
            expression: (pair: Pair) => parseFloat(pair.priceUsd || '0')
          }
        ]
      });

      const result = transformer.transform(mockPair);

      expect(result).toEqual({
        chainId: 'solana',
        priceUsd: '123.45',
        priceNumber: 123.45
      });
    });

    it('should handle multiple computed fields', () => {
      const transformer = new Transformer({
        fields: ['chainId'],
        computed: [
          {
            name: 'hasLiquidity',
            expression: (pair: Pair) => !!pair.liquidity?.usd
          },
          {
            name: 'liquidityTier',
            expression: (pair: Pair) => {
              const usd = pair.liquidity?.usd || 0;
              if (usd >= 1000000) return 'high';
              if (usd >= 100000) return 'medium';
              return 'low';
            }
          }
        ]
      });

      const result = transformer.transform(mockPair);

      expect(result).toEqual({
        chainId: 'solana',
        hasLiquidity: true,
        liquidityTier: 'high'
      });
    });
  });
});
