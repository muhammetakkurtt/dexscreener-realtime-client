/**
 * Filter-specific types and interfaces
 */

import type { FilterFunction } from '../types.js';

/** Chain filter parameters. */
export type ChainFilterParams = {
  chains: string[];
};

/** Liquidity filter parameters. */
export type LiquidityFilterParams = {
  minUsd: number;
};

/** Volume filter parameters. */
export type VolumeFilterParams = {
  period: 'm5' | 'h1' | 'h6' | 'h24';
  minUsd: number;
};

/** Price change filter parameters. */
export type PriceChangeFilterParams = {
  period: 'm5' | 'h1' | 'h6' | 'h24';
  minPercent: number;
};

/** Symbol filter parameters. */
export type SymbolFilterParams = {
  pattern: string | RegExp;
  exact?: boolean;
};

/** Filter combination logic. */
export type FilterLogic = 'AND' | 'OR';

/** Custom filter function with metadata. */
export type CustomFilter = {
  name: string;
  description?: string;
  filter: FilterFunction;
};
