// Data filtering module
// This module contains FilterBuilder and filter functions

import { FilterBuilder } from './builder.js';
import type { FilterConfig, FilterFunction } from '../types.js';

export { FilterBuilder } from './builder.js';
export type {
  ChainFilterParams,
  LiquidityFilterParams,
  VolumeFilterParams,
  PriceChangeFilterParams,
  SymbolFilterParams,
  FilterLogic,
  CustomFilter,
} from './types.js';

/**
 * Creates a filter function from a FilterConfig object.
 * 
 * This is a convenience function that wraps FilterBuilder.createFilter()
 * for easier SDK usage.
 * 
 * @param config - Filter configuration specifying type and parameters
 * @returns A filter function that can be used to test trading pairs
 * 
 * @example
 * ```typescript
 * // Create a liquidity filter
 * const filter = createFilter({
 *   type: 'liquidity',
 *   params: { minUsd: 100000 }
 * });
 * 
 * // Use the filter
 * const matches = filter({ pair, event, streamId });
 * ```
 * 
 * @throws Error if filter type is unknown or params are invalid
 */
export function createFilter(config: FilterConfig): FilterFunction {
  return FilterBuilder.createFilter(config);
}
