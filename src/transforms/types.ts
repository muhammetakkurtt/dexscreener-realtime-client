import type { Pair } from '../types.js';

/**
 * Result of parsing a field path with dot notation.
 */
export type FieldPath = {
  /** Original field path string (e.g., "baseToken.symbol") */
  original: string;
  /** Array of path segments (e.g., ["baseToken", "symbol"]) */
  segments: string[];
};

/**
 * Result of a field extraction operation.
 */
export type FieldExtractionResult = {
  /** Whether the field was found in the source object */
  found: boolean;
  /** The extracted value (undefined if not found) */
  value: unknown;
};

/**
 * Options for the Transformer class.
 */
export type TransformerOptions = {
  /** Array of field paths to select (dot notation supported) */
  fields?: string[];
  /** Map of field aliases (original -> new name) */
  aliases?: Record<string, string>;
  /** Array of computed fields to add */
  computed?: Array<{
    name: string;
    expression: string | ((pair: Pair) => unknown);
  }>;
};

/**
 * Internal representation of a transformation operation.
 */
export type TransformOperation = {
  /** Type of transformation */
  type: 'select' | 'alias' | 'compute';
  /** Source field path (for select and alias) */
  source?: FieldPath;
  /** Target field name (for alias and compute) */
  target?: string;
  /** Computation function (for compute) */
  compute?: (pair: Pair) => unknown;
};
