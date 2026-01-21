import type { Pair, TransformConfig } from '../types.js';
import type { FieldPath, FieldExtractionResult, TransformerOptions } from './types.js';

/**
 * Transformer class for selecting, aliasing, and computing fields from trading pairs.
 * 
 * Supports:
 * - Field selection with dot notation (e.g., "baseToken.symbol")
 * - Nested field extraction preserving structure
 * - Field aliasing (renaming fields)
 * - Graceful handling of missing fields
 * 
 * @example
 * ```typescript
 * const transformer = new Transformer({
 *   fields: ['baseToken.symbol', 'priceUsd'],
 *   aliases: { 'priceUsd': 'price' }
 * });
 * 
 * const result = transformer.transform(pair);
 * // { baseToken: { symbol: 'SOL' }, price: '123.45' }
 * ```
 */
export class Transformer {
  private readonly fields?: string[];
  private readonly aliases: Record<string, string>;
  private readonly computed?: Array<{
    name: string;
    expression: string | ((pair: Pair) => unknown);
  }>;

  /**
   * Creates a new Transformer instance.
   * 
   * @param config - Transformation configuration
   */
  constructor(config: TransformConfig | TransformerOptions) {
    this.fields = config.fields;
    this.aliases = config.aliases || {};
    this.computed = config.computed;
  }

  /**
   * Transforms a single pair according to the configuration.
   * 
   * @param pair - The trading pair to transform
   * @returns Transformed object with selected/aliased fields
   */
  transform(pair: Pair): Record<string, unknown> {
    // If no field selection is configured, return the pair unchanged
    if (!this.fields || this.fields.length === 0) {
      return this.applyAliases(pair as Record<string, unknown>);
    }

    const result: Record<string, unknown> = {};

    // Process each selected field
    for (const fieldPath of this.fields) {
      const parsed = this.parseFieldPath(fieldPath);
      const extraction = this.extractField(pair, parsed);

      if (extraction.found) {
        this.setNestedValue(result, parsed.segments, extraction.value);
      }
    }

    // Apply aliases to the result
    const aliased = this.applyAliases(result);

    // Add computed fields if configured
    if (this.computed && this.computed.length > 0) {
      for (const computed of this.computed) {
        if (typeof computed.expression === 'function') {
          aliased[computed.name] = computed.expression(pair);
        }
      }
    }

    return aliased;
  }

  /**
   * Transforms multiple pairs in batch.
   * 
   * @param pairs - Array of trading pairs to transform
   * @returns Array of transformed objects
   */
  transformBatch(pairs: Pair[]): Record<string, unknown>[] {
    return pairs.map(pair => this.transform(pair));
  }

  /**
   * Parses a field path string into segments.
   * 
   * @param path - Field path with dot notation (e.g., "baseToken.symbol")
   * @returns Parsed field path object
   */
  private parseFieldPath(path: string): FieldPath {
    return {
      original: path,
      segments: path.split('.').filter(segment => segment.length > 0)
    };
  }

  /**
   * Extracts a field value from an object using a parsed field path.
   * 
   * @param obj - Source object
   * @param path - Parsed field path
   * @returns Extraction result with found flag and value
   */
  private extractField(obj: Record<string, unknown>, path: FieldPath): FieldExtractionResult {
    let current: unknown = obj;

    for (const segment of path.segments) {
      if (current === null || current === undefined) {
        return { found: false, value: undefined };
      }

      if (typeof current !== 'object') {
        return { found: false, value: undefined };
      }

      const currentObj = current as Record<string, unknown>;
      
      if (!(segment in currentObj)) {
        return { found: false, value: undefined };
      }

      current = currentObj[segment];
    }

    return { found: true, value: current };
  }

  /**
   * Sets a nested value in an object, creating intermediate objects as needed.
   * 
   * @param obj - Target object
   * @param segments - Array of path segments
   * @param value - Value to set
   */
  private setNestedValue(obj: Record<string, unknown>, segments: string[], value: unknown): void {
    if (segments.length === 0) {
      return;
    }

    const firstSegment = segments[0];
    if (!firstSegment) {
      return;
    }

    if (segments.length === 1) {
      obj[firstSegment] = value;
      return;
    }

    const [first, ...rest] = segments;
    if (!first) {
      return;
    }

    // Create intermediate object if it doesn't exist
    if (!(first in obj) || typeof obj[first] !== 'object' || obj[first] === null) {
      obj[first] = {};
    }

    this.setNestedValue(obj[first] as Record<string, unknown>, rest, value);
  }

  /**
   * Applies field aliases to an object.
   * 
   * @param obj - Object to apply aliases to
   * @returns New object with aliased field names
   */
  private applyAliases(obj: Record<string, unknown>): Record<string, unknown> {
    if (Object.keys(this.aliases).length === 0) {
      return obj;
    }

    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = this.aliases[key] || key;
      
      // Recursively apply aliases to nested objects
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        result[newKey] = this.applyAliases(value as Record<string, unknown>);
      } else {
        result[newKey] = value;
      }
    }

    return result;
  }
}
