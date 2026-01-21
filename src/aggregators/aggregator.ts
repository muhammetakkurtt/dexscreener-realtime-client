import type { DexEvent, AggregateStats } from '../types.js';

/**
 * Aggregator class for computing statistics from DexScreener events.
 * Provides aggregated metrics without individual pair data.
 */
export class Aggregator {
  /**
   * Aggregate an event into statistics-only output.
   * 
   * @param event - The DexScreener event to aggregate
   * @param streamId - The stream identifier
   * @returns Aggregated statistics including total pairs, unique chains/dexs, and rankings
   */
  aggregate(event: DexEvent, streamId: string): AggregateStats {
    const pairs = event.pairs || [];
    const timestamp = event.timestamp || new Date().toISOString();

    // Calculate total pairs
    const totalPairs = pairs.length;

    // Track unique chains and dexs
    const chainCounts = new Map<string, number>();
    const dexCounts = new Map<string, number>();

    for (const pair of pairs) {
      // Count chains
      if (pair.chainId) {
        chainCounts.set(pair.chainId, (chainCounts.get(pair.chainId) || 0) + 1);
      }

      // Count dexs
      if (pair.dexId) {
        dexCounts.set(pair.dexId, (dexCounts.get(pair.dexId) || 0) + 1);
      }
    }

    // Calculate unique counts
    const uniqueChains = chainCounts.size;
    const uniqueDexs = dexCounts.size;

    // Calculate top chains (sorted by count descending)
    const topChains = Array.from(chainCounts.entries())
      .map(([chain, count]) => ({ chain, count }))
      .sort((a, b) => b.count - a.count);

    // Calculate top dexs (sorted by count descending)
    const topDexs = Array.from(dexCounts.entries())
      .map(([dex, count]) => ({ dex, count }))
      .sort((a, b) => b.count - a.count);

    return {
      timestamp,
      streamId,
      eventStats: event.stats || {},
      totalPairs,
      uniqueChains,
      uniqueDexs,
      topChains,
      topDexs,
    };
  }
}
