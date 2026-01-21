/**
 * FilterBuilder class with built-in filter functions
 */

import type { FilterFunction, FilterContext, FilterConfig } from '../types.js';
import type { FilterLogic } from './types.js';

/**
 * Builder class for creating filter functions.
 * 
 * Provides static methods to create various types of filters for trading pairs,
 * including filters by chain, liquidity, volume, price change, and symbol.
 * Filters can be combined using AND/OR logic.
 * 
 * @example
 * ```typescript
 * // Create individual filters
 * const chainFilter = FilterBuilder.chainFilter(['solana', 'ethereum']);
 * const liquidityFilter = FilterBuilder.liquidityFilter(100000);
 * 
 * // Combine filters with AND logic
 * const combinedFilter = FilterBuilder.combineFilters(
 *   [chainFilter, liquidityFilter],
 *   'AND'
 * );
 * 
 * // Test a pair
 * const matches = combinedFilter({ pair, event, streamId: 'test' });
 * ```
 */
export class FilterBuilder {
  /**
   * Create a filter that matches pairs by chainId.
   * 
   * @param chains - Array of allowed chain IDs (e.g., ['solana', 'ethereum', 'bsc'])
   * @returns Filter function that returns true if pair's chainId is in the list
   * 
   * @example
   * ```typescript
   * const filter = FilterBuilder.chainFilter(['solana', 'ethereum']);
   * const matches = filter({ pair, event, streamId: 'test' });
   * ```
   */
  static chainFilter(chains: string[]): FilterFunction {
    return (ctx: FilterContext): boolean => {
      const { pair } = ctx;
      if (!pair.chainId) {
        return false;
      }
      return chains.includes(pair.chainId);
    };
  }

  /**
   * Create a filter that matches pairs by minimum liquidity.
   * 
   * @param minUsd - Minimum liquidity in USD (e.g., 100000 for $100k)
   * @returns Filter function that returns true if pair's liquidity meets threshold
   * 
   * @example
   * ```typescript
   * const filter = FilterBuilder.liquidityFilter(100000);
   * const matches = filter({ pair, event, streamId: 'test' });
   * ```
   */
  static liquidityFilter(minUsd: number): FilterFunction {
    return (ctx: FilterContext): boolean => {
      const { pair } = ctx;
      if (!pair.liquidity?.usd) {
        return false;
      }
      return pair.liquidity.usd >= minUsd;
    };
  }

  /**
   * Create a filter that matches pairs by minimum volume.
   * 
   * @param period - Time period: 'm5' (5 min), 'h1' (1 hour), 'h6' (6 hours), 'h24' (24 hours)
   * @param minUsd - Minimum volume in USD for the specified period
   * @returns Filter function that returns true if pair's volume meets threshold
   * 
   * @example
   * ```typescript
   * // Filter for pairs with at least $50k volume in last 24 hours
   * const filter = FilterBuilder.volumeFilter('h24', 50000);
   * const matches = filter({ pair, event, streamId: 'test' });
   * ```
   */
  static volumeFilter(
    period: 'm5' | 'h1' | 'h6' | 'h24',
    minUsd: number
  ): FilterFunction {
    return (ctx: FilterContext): boolean => {
      const { pair } = ctx;
      if (!pair.volume) {
        return false;
      }
      const volumeValue = pair.volume[period];
      if (volumeValue === null || volumeValue === undefined) {
        return false;
      }
      return volumeValue >= minUsd;
    };
  }

  /**
   * Create a filter that matches pairs by minimum price change.
   * 
   * @param period - Time period: 'm5' (5 min), 'h1' (1 hour), 'h6' (6 hours), 'h24' (24 hours)
   * @param minPercent - Minimum price change percentage (e.g., 5 for 5% increase)
   * @returns Filter function that returns true if pair's price change meets threshold
   * 
   * @example
   * ```typescript
   * // Filter for pairs with at least 10% price increase in last hour
   * const filter = FilterBuilder.priceChangeFilter('h1', 10);
   * const matches = filter({ pair, event, streamId: 'test' });
   * ```
   */
  static priceChangeFilter(
    period: 'm5' | 'h1' | 'h6' | 'h24',
    minPercent: number
  ): FilterFunction {
    return (ctx: FilterContext): boolean => {
      const { pair } = ctx;
      if (!pair.priceChange) {
        return false;
      }
      const priceChangeValue = pair.priceChange[period];
      if (priceChangeValue === null || priceChangeValue === undefined) {
        return false;
      }
      return priceChangeValue >= minPercent;
    };
  }

  /**
   * Create a filter that matches pairs by token symbol.
   * 
   * @param pattern - Symbol pattern: string for exact match, RegExp for pattern match
   * @returns Filter function that returns true if pair's base token symbol matches
   * 
   * @example
   * ```typescript
   * // Exact match
   * const exactFilter = FilterBuilder.symbolFilter('SOL');
   * 
   * // Regex pattern match
   * const regexFilter = FilterBuilder.symbolFilter(/^USDT?$/);
   * 
   * const matches = exactFilter({ pair, event, streamId: 'test' });
   * ```
   */
  static symbolFilter(pattern: string | RegExp): FilterFunction {
    return (ctx: FilterContext): boolean => {
      const { pair } = ctx;
      if (!pair.baseToken?.symbol) {
        return false;
      }
      
      const symbol = pair.baseToken.symbol;
      
      if (typeof pattern === 'string') {
        // Exact match
        return symbol === pattern;
      } else {
        // Regex match
        return pattern.test(symbol);
      }
    };
  }

  /**
   * Combine multiple filters with AND or OR logic.
   * 
   * @param filters - Array of filter functions to combine
   * @param logic - Combination logic: 'AND' (all must pass) or 'OR' (at least one must pass)
   * @returns Combined filter function
   * 
   * @example
   * ```typescript
   * const chainFilter = FilterBuilder.chainFilter(['solana']);
   * const liquidityFilter = FilterBuilder.liquidityFilter(100000);
   * 
   * // Both filters must pass
   * const andFilter = FilterBuilder.combineFilters(
   *   [chainFilter, liquidityFilter],
   *   'AND'
   * );
   * 
   * // At least one filter must pass
   * const orFilter = FilterBuilder.combineFilters(
   *   [chainFilter, liquidityFilter],
   *   'OR'
   * );
   * ```
   */
  static combineFilters(
    filters: FilterFunction[],
    logic: FilterLogic = 'AND'
  ): FilterFunction {
    return (ctx: FilterContext): boolean => {
      if (filters.length === 0) {
        return true;
      }

      if (logic === 'AND') {
        // All filters must pass
        return filters.every((filter) => filter(ctx));
      } else {
        // At least one filter must pass
        return filters.some((filter) => filter(ctx));
      }
    };
  }

  /**
   * Create a filter function from a FilterConfig object.
   * 
   * @param config - Filter configuration specifying type and parameters
   * @returns Filter function based on the configuration
   * @throws Error if filter type is unknown or params are invalid
   * 
   * @example
   * ```typescript
   * // Create from config object
   * const filter = FilterBuilder.createFilter({
   *   type: 'liquidity',
   *   params: { minUsd: 100000 }
   * });
   * 
   * // Volume filter
   * const volumeFilter = FilterBuilder.createFilter({
   *   type: 'volume',
   *   params: { period: 'h24', minUsd: 50000 }
   * });
   * ```
   */
  static createFilter(config: FilterConfig): FilterFunction {
    switch (config.type) {
      case 'chain': {
        const chains = config.params.chains as string[];
        if (!Array.isArray(chains)) {
          throw new Error('Chain filter requires "chains" parameter as string array');
        }
        return FilterBuilder.chainFilter(chains);
      }

      case 'liquidity': {
        const minUsd = config.params.minUsd as number;
        if (typeof minUsd !== 'number') {
          throw new Error('Liquidity filter requires "minUsd" parameter as number');
        }
        return FilterBuilder.liquidityFilter(minUsd);
      }

      case 'volume': {
        const period = config.params.period as 'm5' | 'h1' | 'h6' | 'h24';
        const minUsd = config.params.minUsd as number;
        if (!['m5', 'h1', 'h6', 'h24'].includes(period)) {
          throw new Error('Volume filter requires "period" parameter as m5, h1, h6, or h24');
        }
        if (typeof minUsd !== 'number') {
          throw new Error('Volume filter requires "minUsd" parameter as number');
        }
        return FilterBuilder.volumeFilter(period, minUsd);
      }

      case 'priceChange': {
        const period = config.params.period as 'm5' | 'h1' | 'h6' | 'h24';
        const minPercent = config.params.minPercent as number;
        if (!['m5', 'h1', 'h6', 'h24'].includes(period)) {
          throw new Error('Price change filter requires "period" parameter as m5, h1, h6, or h24');
        }
        if (typeof minPercent !== 'number') {
          throw new Error('Price change filter requires "minPercent" parameter as number');
        }
        return FilterBuilder.priceChangeFilter(period, minPercent);
      }

      case 'symbol': {
        const pattern = config.params.pattern;
        if (typeof pattern === 'string') {
          return FilterBuilder.symbolFilter(pattern);
        } else if (pattern instanceof RegExp) {
          return FilterBuilder.symbolFilter(pattern);
        } else if (typeof pattern === 'object' && pattern !== null && 'source' in pattern) {
          // Handle serialized RegExp from config files
          const regexPattern = pattern as { source: string; flags?: string };
          const regex = new RegExp(regexPattern.source, regexPattern.flags || '');
          return FilterBuilder.symbolFilter(regex);
        } else {
          throw new Error('Symbol filter requires "pattern" parameter as string or RegExp');
        }
      }

      case 'custom': {
        // Custom filters should be provided as functions, not in config
        throw new Error('Custom filters cannot be created from config objects');
      }

      default:
        throw new Error(`Unknown filter type: ${config.type}`);
    }
  }
}
