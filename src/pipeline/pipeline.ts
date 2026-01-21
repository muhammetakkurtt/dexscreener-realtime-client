import type { 
  DexEvent, 
  FilterConfig, 
  TransformConfig, 
  FilterFunction,
  FilterContext,
  Pair
} from '../types.js';
import { FilterBuilder } from '../filters/builder.js';
import { Transformer } from '../transforms/transformer.js';
import { Aggregator } from '../aggregators/aggregator.js';

/**
 * Context for processing pipeline operations
 */
export interface PipelineContext {
  streamId: string;
  event: DexEvent;
  filters: FilterFunction[];
  transformer?: Transformer;
  aggregator?: Aggregator;
}

/**
 * Result of processing an event through the pipeline
 */
export interface PipelineResult {
  filtered: boolean;
  transformed?: Record<string, unknown>[];
  aggregated?: ReturnType<Aggregator['aggregate']>;
  droppedPairs: number;
}

/**
 * Configuration for the processing pipeline
 */
export interface PipelineConfig {
  filters?: FilterConfig[];
  transforms?: TransformConfig;
  aggregate?: boolean;
}

/**
 * ProcessingPipeline integrates filters, transformers, and aggregators
 * to process DexScreener events through a configurable data pipeline.
 * 
 * Pipeline stages:
 * 1. Filtering: Apply filter criteria to select relevant pairs
 * 2. Transformation: Select and transform fields from filtered pairs
 * 3. Aggregation: Compute statistics-only output (optional)
 * 
 * @example
 * ```typescript
 * const pipeline = new ProcessingPipeline({
 *   filters: [
 *     { type: 'chain', params: { chains: ['solana', 'ethereum'] } },
 *     { type: 'liquidity', params: { minUsd: 10000 } }
 *   ],
 *   transforms: {
 *     fields: ['baseToken.symbol', 'priceUsd'],
 *     aliases: { 'priceUsd': 'price' }
 *   },
 *   aggregate: false
 * });
 * 
 * const result = pipeline.process(event, 'stream-1');
 * ```
 */
export class ProcessingPipeline {
  private readonly filters: FilterFunction[];
  private readonly transformer?: Transformer;
  private readonly aggregator?: Aggregator;
  private readonly shouldAggregate: boolean;

  /**
   * Creates a new ProcessingPipeline instance.
   * 
   * @param config - Pipeline configuration
   */
  constructor(config: PipelineConfig) {
    // Build filter functions from config
    this.filters = [];
    if (config.filters && config.filters.length > 0) {
      for (const filterConfig of config.filters) {
        try {
          const filter = FilterBuilder.createFilter(filterConfig);
          this.filters.push(filter);
        } catch (error) {
          // Log error but continue with other filters
          console.error(`Failed to create filter: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    // Create transformer if transform config is provided
    if (config.transforms) {
      this.transformer = new Transformer(config.transforms);
    }

    // Create aggregator if aggregation is enabled
    this.shouldAggregate = config.aggregate || false;
    if (this.shouldAggregate) {
      this.aggregator = new Aggregator();
    }
  }

  /**
   * Process an event through the pipeline stages.
   * 
   * @param event - The DexScreener event to process
   * @param streamId - The stream identifier
   * @returns Pipeline result with filtered/transformed/aggregated data
   */
  process(event: DexEvent, streamId: string): PipelineResult {
    const pairs = event.pairs || [];
    let droppedPairs = 0;

    // Stage 1: Apply filters
    let filteredPairs: Pair[] = pairs;
    
    if (this.filters.length > 0) {
      filteredPairs = [];
      
      for (const pair of pairs) {
        const filterContext: FilterContext = {
          pair,
          event,
          streamId
        };

        // Apply all filters with AND logic
        const passesAllFilters = this.filters.every(filter => {
          try {
            return filter(filterContext);
          } catch (error) {
            // Log error but treat as filter failure
            console.error(`Filter execution error: ${error instanceof Error ? error.message : String(error)}`);
            return false;
          }
        });

        if (passesAllFilters) {
          filteredPairs.push(pair);
        } else {
          droppedPairs++;
        }
      }
    }

    // Check if all pairs were filtered out
    const filtered = filteredPairs.length === 0 && pairs.length > 0;

    // Stage 2: Apply transformations
    let transformedPairs: Record<string, unknown>[] | undefined;
    
    if (filteredPairs.length > 0) {
      if (this.transformer) {
        try {
          transformedPairs = this.transformer.transformBatch(filteredPairs);
        } catch (error) {
          console.error(`Transform execution error: ${error instanceof Error ? error.message : String(error)}`);
          // Fall back to untransformed pairs
          transformedPairs = filteredPairs as Record<string, unknown>[];
        }
      } else {
        // No transformer configured, pass through filtered pairs
        transformedPairs = filteredPairs as Record<string, unknown>[];
      }
    } else {
      // No pairs to transform, return empty array
      transformedPairs = [];
    }

    // Stage 3: Apply aggregation
    let aggregated: ReturnType<Aggregator['aggregate']> | undefined;
    
    if (this.shouldAggregate && this.aggregator) {
      try {
        // Create a modified event with filtered pairs for aggregation
        const eventForAggregation: DexEvent = {
          ...event,
          pairs: filteredPairs
        };
        aggregated = this.aggregator.aggregate(eventForAggregation, streamId);
      } catch (error) {
        console.error(`Aggregation execution error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      filtered,
      transformed: transformedPairs,
      aggregated,
      droppedPairs
    };
  }

  /**
   * Get the number of configured filters.
   * 
   * @returns Number of active filters
   */
  getFilterCount(): number {
    return this.filters.length;
  }

  /**
   * Check if transformation is enabled.
   * 
   * @returns True if transformer is configured
   */
  hasTransformer(): boolean {
    return this.transformer !== undefined;
  }

  /**
   * Check if aggregation is enabled.
   * 
   * @returns True if aggregation is enabled
   */
  hasAggregator(): boolean {
    return this.shouldAggregate;
  }
}
