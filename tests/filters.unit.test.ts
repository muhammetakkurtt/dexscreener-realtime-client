/**
 * Unit tests for filter system
 */

import { describe, it, expect } from 'vitest';
import { FilterBuilder } from '../src/filters/index.js';
import type { Pair, FilterContext } from '../src/types.js';

describe('FilterBuilder', () => {
  const createContext = (pair: Partial<Pair>): FilterContext => ({
    pair: pair as Pair,
    event: { pairs: [pair as Pair] },
    streamId: 'test-stream',
  });

  describe('chainFilter', () => {
    it('should match pairs with chainId in the allowed list', () => {
      const filter = FilterBuilder.chainFilter(['ethereum', 'solana']);
      
      expect(filter(createContext({ chainId: 'ethereum' }))).toBe(true);
      expect(filter(createContext({ chainId: 'solana' }))).toBe(true);
      expect(filter(createContext({ chainId: 'bsc' }))).toBe(false);
    });

    it('should return false for pairs without chainId', () => {
      const filter = FilterBuilder.chainFilter(['ethereum']);
      expect(filter(createContext({}))).toBe(false);
    });
  });

  describe('liquidityFilter', () => {
    it('should match pairs with liquidity >= threshold', () => {
      const filter = FilterBuilder.liquidityFilter(10000);
      
      expect(filter(createContext({ liquidity: { usd: 15000 } }))).toBe(true);
      expect(filter(createContext({ liquidity: { usd: 10000 } }))).toBe(true);
      expect(filter(createContext({ liquidity: { usd: 5000 } }))).toBe(false);
    });

    it('should return false for pairs without liquidity', () => {
      const filter = FilterBuilder.liquidityFilter(10000);
      expect(filter(createContext({}))).toBe(false);
      expect(filter(createContext({ liquidity: {} }))).toBe(false);
    });
  });

  describe('volumeFilter', () => {
    it('should match pairs with volume >= threshold for specified period', () => {
      const filter = FilterBuilder.volumeFilter('h24', 50000);
      
      expect(filter(createContext({ volume: { h24: 100000 } }))).toBe(true);
      expect(filter(createContext({ volume: { h24: 50000 } }))).toBe(true);
      expect(filter(createContext({ volume: { h24: 25000 } }))).toBe(false);
    });

    it('should return false for pairs without volume data', () => {
      const filter = FilterBuilder.volumeFilter('h24', 50000);
      expect(filter(createContext({}))).toBe(false);
      expect(filter(createContext({ volume: {} }))).toBe(false);
      expect(filter(createContext({ volume: { h24: null } }))).toBe(false);
    });
  });

  describe('priceChangeFilter', () => {
    it('should match pairs with price change >= threshold for specified period', () => {
      const filter = FilterBuilder.priceChangeFilter('h24', 5);
      
      expect(filter(createContext({ priceChange: { h24: 10 } }))).toBe(true);
      expect(filter(createContext({ priceChange: { h24: 5 } }))).toBe(true);
      expect(filter(createContext({ priceChange: { h24: 2 } }))).toBe(false);
    });

    it('should return false for pairs without price change data', () => {
      const filter = FilterBuilder.priceChangeFilter('h24', 5);
      expect(filter(createContext({}))).toBe(false);
      expect(filter(createContext({ priceChange: {} }))).toBe(false);
      expect(filter(createContext({ priceChange: { h24: null } }))).toBe(false);
    });
  });

  describe('symbolFilter', () => {
    it('should match pairs with exact symbol match', () => {
      const filter = FilterBuilder.symbolFilter('USDC');
      
      expect(filter(createContext({ baseToken: { symbol: 'USDC' } }))).toBe(true);
      expect(filter(createContext({ baseToken: { symbol: 'USDT' } }))).toBe(false);
    });

    it('should match pairs with regex pattern', () => {
      const filter = FilterBuilder.symbolFilter(/^USD/);
      
      expect(filter(createContext({ baseToken: { symbol: 'USDC' } }))).toBe(true);
      expect(filter(createContext({ baseToken: { symbol: 'USDT' } }))).toBe(true);
      expect(filter(createContext({ baseToken: { symbol: 'ETH' } }))).toBe(false);
    });

    it('should return false for pairs without base token symbol', () => {
      const filter = FilterBuilder.symbolFilter('USDC');
      expect(filter(createContext({}))).toBe(false);
      expect(filter(createContext({ baseToken: {} }))).toBe(false);
    });
  });

  describe('combineFilters', () => {
    it('should combine filters with AND logic', () => {
      const chainFilter = FilterBuilder.chainFilter(['ethereum']);
      const liquidityFilter = FilterBuilder.liquidityFilter(10000);
      const combined = FilterBuilder.combineFilters([chainFilter, liquidityFilter], 'AND');
      
      // Both conditions met
      expect(combined(createContext({ 
        chainId: 'ethereum', 
        liquidity: { usd: 15000 } 
      }))).toBe(true);
      
      // Only one condition met
      expect(combined(createContext({ 
        chainId: 'ethereum', 
        liquidity: { usd: 5000 } 
      }))).toBe(false);
      
      expect(combined(createContext({ 
        chainId: 'solana', 
        liquidity: { usd: 15000 } 
      }))).toBe(false);
    });

    it('should combine filters with OR logic', () => {
      const chainFilter = FilterBuilder.chainFilter(['ethereum']);
      const liquidityFilter = FilterBuilder.liquidityFilter(10000);
      const combined = FilterBuilder.combineFilters([chainFilter, liquidityFilter], 'OR');
      
      // Both conditions met
      expect(combined(createContext({ 
        chainId: 'ethereum', 
        liquidity: { usd: 15000 } 
      }))).toBe(true);
      
      // Only one condition met
      expect(combined(createContext({ 
        chainId: 'ethereum', 
        liquidity: { usd: 5000 } 
      }))).toBe(true);
      
      expect(combined(createContext({ 
        chainId: 'solana', 
        liquidity: { usd: 15000 } 
      }))).toBe(true);
      
      // No conditions met
      expect(combined(createContext({ 
        chainId: 'solana', 
        liquidity: { usd: 5000 } 
      }))).toBe(false);
    });

    it('should return true for empty filter array', () => {
      const combined = FilterBuilder.combineFilters([], 'AND');
      expect(combined(createContext({}))).toBe(true);
    });
  });

  describe('createFilter', () => {
    it('should create chain filter from config', () => {
      const filter = FilterBuilder.createFilter({
        type: 'chain',
        params: { chains: ['ethereum', 'solana'] },
      });
      
      expect(filter(createContext({ chainId: 'ethereum' }))).toBe(true);
      expect(filter(createContext({ chainId: 'bsc' }))).toBe(false);
    });

    it('should create liquidity filter from config', () => {
      const filter = FilterBuilder.createFilter({
        type: 'liquidity',
        params: { minUsd: 10000 },
      });
      
      expect(filter(createContext({ liquidity: { usd: 15000 } }))).toBe(true);
      expect(filter(createContext({ liquidity: { usd: 5000 } }))).toBe(false);
    });

    it('should create volume filter from config', () => {
      const filter = FilterBuilder.createFilter({
        type: 'volume',
        params: { period: 'h24', minUsd: 50000 },
      });
      
      expect(filter(createContext({ volume: { h24: 100000 } }))).toBe(true);
      expect(filter(createContext({ volume: { h24: 25000 } }))).toBe(false);
    });

    it('should create price change filter from config', () => {
      const filter = FilterBuilder.createFilter({
        type: 'priceChange',
        params: { period: 'h24', minPercent: 5 },
      });
      
      expect(filter(createContext({ priceChange: { h24: 10 } }))).toBe(true);
      expect(filter(createContext({ priceChange: { h24: 2 } }))).toBe(false);
    });

    it('should create symbol filter from config with string pattern', () => {
      const filter = FilterBuilder.createFilter({
        type: 'symbol',
        params: { pattern: 'USDC' },
      });
      
      expect(filter(createContext({ baseToken: { symbol: 'USDC' } }))).toBe(true);
      expect(filter(createContext({ baseToken: { symbol: 'USDT' } }))).toBe(false);
    });

    it('should create symbol filter from config with regex pattern', () => {
      const filter = FilterBuilder.createFilter({
        type: 'symbol',
        params: { pattern: /^USD/ },
      });
      
      expect(filter(createContext({ baseToken: { symbol: 'USDC' } }))).toBe(true);
      expect(filter(createContext({ baseToken: { symbol: 'ETH' } }))).toBe(false);
    });

    it('should create symbol filter from config with serialized regex', () => {
      const filter = FilterBuilder.createFilter({
        type: 'symbol',
        params: { pattern: { source: '^USD', flags: 'i' } },
      });
      
      expect(filter(createContext({ baseToken: { symbol: 'USDC' } }))).toBe(true);
      expect(filter(createContext({ baseToken: { symbol: 'usdt' } }))).toBe(true);
      expect(filter(createContext({ baseToken: { symbol: 'ETH' } }))).toBe(false);
    });

    it('should throw error for invalid filter type', () => {
      expect(() => {
        FilterBuilder.createFilter({
          type: 'invalid' as any,
          params: {},
        });
      }).toThrow('Unknown filter type');
    });

    it('should throw error for custom filter type', () => {
      expect(() => {
        FilterBuilder.createFilter({
          type: 'custom',
          params: {},
        });
      }).toThrow('Custom filters cannot be created from config objects');
    });

    it('should throw error for invalid chain filter params', () => {
      expect(() => {
        FilterBuilder.createFilter({
          type: 'chain',
          params: { chains: 'not-an-array' },
        });
      }).toThrow('Chain filter requires "chains" parameter as string array');
    });

    it('should throw error for invalid liquidity filter params', () => {
      expect(() => {
        FilterBuilder.createFilter({
          type: 'liquidity',
          params: { minUsd: 'not-a-number' },
        });
      }).toThrow('Liquidity filter requires "minUsd" parameter as number');
    });

    it('should throw error for invalid volume filter params', () => {
      expect(() => {
        FilterBuilder.createFilter({
          type: 'volume',
          params: { period: 'invalid', minUsd: 50000 },
        });
      }).toThrow('Volume filter requires "period" parameter as m5, h1, h6, or h24');
      
      expect(() => {
        FilterBuilder.createFilter({
          type: 'volume',
          params: { period: 'h24', minUsd: 'not-a-number' },
        });
      }).toThrow('Volume filter requires "minUsd" parameter as number');
    });

    it('should throw error for invalid price change filter params', () => {
      expect(() => {
        FilterBuilder.createFilter({
          type: 'priceChange',
          params: { period: 'invalid', minPercent: 5 },
        });
      }).toThrow('Price change filter requires "period" parameter as m5, h1, h6, or h24');
      
      expect(() => {
        FilterBuilder.createFilter({
          type: 'priceChange',
          params: { period: 'h24', minPercent: 'not-a-number' },
        });
      }).toThrow('Price change filter requires "minPercent" parameter as number');
    });

    it('should throw error for invalid symbol filter params', () => {
      expect(() => {
        FilterBuilder.createFilter({
          type: 'symbol',
          params: { pattern: 123 },
        });
      }).toThrow('Symbol filter requires "pattern" parameter as string or RegExp');
    });
  });
});
