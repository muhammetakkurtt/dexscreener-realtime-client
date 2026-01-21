import { Transformer } from './transformer.js';
import type { TransformConfig } from '../types.js';

export { Transformer } from './transformer.js';
export type {
  FieldPath,
  FieldExtractionResult,
  TransformerOptions,
  TransformOperation
} from './types.js';

/**
 * Creates a Transformer instance from a TransformConfig object.
 * 
 * This is a convenience function that wraps the Transformer constructor
 * for easier SDK usage.
 * 
 * @param config - Transform configuration specifying fields, aliases, and computed fields
 * @returns A Transformer instance that can transform trading pairs
 * 
 * @example
 * ```typescript
 * // Create a transformer with field selection and aliasing
 * const transformer = createTransformer({
 *   fields: ['baseToken.symbol', 'priceUsd', 'liquidity.usd'],
 *   aliases: { 'priceUsd': 'price', 'liquidity.usd': 'liquidityUsd' }
 * });
 * 
 * // Transform a pair
 * const transformed = transformer.transform(pair);
 * // Result: { baseToken: { symbol: 'SOL' }, price: '123.45', liquidityUsd: 50000 }
 * ```
 */
export function createTransformer(config: TransformConfig): Transformer {
  return new Transformer(config);
}
