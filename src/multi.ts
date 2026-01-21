import { DexScreenerStream } from './client.js';
import type {
  ConnectionState,
  DexEvent,
  MultiStreamConfig,
  Pair,
  StreamContext,
} from './types.js';

/**
 * Manages multiple DexScreener streams simultaneously.
 * 
 * Useful for monitoring different pages or chains at once. Each stream
 * operates independently with its own connection lifecycle and callbacks.
 * All streams share the same base URL and API token but can monitor
 * different page URLs.
 * 
 * @example
 * ```typescript
 * const multiStream = new DexScreenerMultiStream({
 *   baseUrl: 'https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor',
 *   apiToken: process.env.APIFY_TOKEN!,
 *   streams: [
 *     { id: 'solana', pageUrl: 'https://dexscreener.com/solana' },
 *     { id: 'ethereum', pageUrl: 'https://dexscreener.com/ethereum' },
 *     { id: 'bsc', pageUrl: 'https://dexscreener.com/bsc' }
 *   ],
 *   onBatch: (event, ctx) => {
 *     console.log(`[${ctx.streamId}] Received ${event.pairs.length} pairs`);
 *   },
 *   onError: (error, ctx) => {
 *     console.error(`[${ctx.streamId}] Error:`, error);
 *   }
 * });
 * 
 * multiStream.startAll();
 * 
 * // Later, stop all streams
 * multiStream.stopAll();
 * ```
 */
export class DexScreenerMultiStream {
  private streams: Map<string, DexScreenerStream> = new Map();

  /**
   * Creates a new DexScreenerMultiStream instance.
   * 
   * @param config - Multi-stream configuration
   * @param config.baseUrl - Apify Actor base URL
   * @param config.apiToken - Apify API token for authentication
   * @param config.streams - Array of stream configurations, each with id and pageUrl
   * @param config.retryMs - Optional milliseconds to wait before reconnecting after error
   * @param config.keepAliveMs - Optional milliseconds between keep-alive pings
   * @param config.onBatch - Optional callback invoked when a batch is received from any stream
   * @param config.onPair - Optional callback invoked for each pair from any stream
   * @param config.onError - Optional callback invoked when an error occurs on any stream
   * @param config.onStateChange - Optional callback invoked when any stream's state changes
   */
  constructor(config: MultiStreamConfig) {
    for (const streamConfig of config.streams) {
      const stream = new DexScreenerStream({
        baseUrl: config.baseUrl,
        apiToken: config.apiToken,
        pageUrl: streamConfig.pageUrl,
        streamId: streamConfig.id,
        retryMs: config.retryMs,
        keepAliveMs: config.keepAliveMs,
        onBatch: config.onBatch
          ? (event: DexEvent, _ctx: StreamContext) => {
              config.onBatch!(event, { streamId: streamConfig.id });
            }
          : undefined,
        onPair: config.onPair
          ? (pair: Pair, _ctx: StreamContext) => {
              config.onPair!(pair, { streamId: streamConfig.id });
            }
          : undefined,
        onError: config.onError
          ? (error: unknown, _ctx: StreamContext) => {
              config.onError!(error, { streamId: streamConfig.id });
            }
          : undefined,
        onStateChange: config.onStateChange
          ? (state: ConnectionState, _ctx: StreamContext) => {
              config.onStateChange!(state, { streamId: streamConfig.id });
            }
          : undefined,
      });

      this.streams.set(streamConfig.id, stream);
    }
  }

  /**
   * Starts all configured streams.
   * 
   * Initiates connections for all streams simultaneously. Each stream
   * will independently manage its connection lifecycle.
   * 
   * @example
   * ```typescript
   * multiStream.startAll();
   * ```
   */
  startAll(): void {
    for (const stream of this.streams.values()) {
      stream.start();
    }
  }

  /**
   * Stops all streams and cleans up resources.
   * 
   * Closes all active connections and prevents automatic reconnection.
   * 
   * @example
   * ```typescript
   * multiStream.stopAll();
   * ```
   */
  stopAll(): void {
    for (const stream of this.streams.values()) {
      stream.stop();
    }
  }

  /**
   * Returns a specific stream by its ID.
   * 
   * @param id - The stream ID to retrieve
   * @returns The DexScreenerStream instance, or undefined if not found
   * 
   * @example
   * ```typescript
   * const solanaStream = multiStream.getStream('solana');
   * if (solanaStream) {
   *   console.log('Solana stream state:', solanaStream.getState());
   * }
   * ```
   */
  getStream(id: string): DexScreenerStream | undefined {
    return this.streams.get(id);
  }

  /**
   * Returns all stream IDs.
   * 
   * @returns Array of stream IDs in the order they were configured
   * 
   * @example
   * ```typescript
   * const ids = multiStream.getStreamIds();
   * console.log('Monitoring streams:', ids.join(', '));
   * ```
   */
  getStreamIds(): string[] {
    return Array.from(this.streams.keys());
  }

  /**
   * Returns the number of configured streams.
   * 
   * @returns Total count of streams being managed
   * 
   * @example
   * ```typescript
   * console.log(`Managing ${multiStream.getStreamCount()} streams`);
   * ```
   */
  getStreamCount(): number {
    return this.streams.size;
  }
}
