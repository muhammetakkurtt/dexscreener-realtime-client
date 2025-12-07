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
 * Useful for monitoring different pages or chains at once.
 */
export class DexScreenerMultiStream {
  private streams: Map<string, DexScreenerStream> = new Map();

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

  /** Starts all configured streams. */
  startAll(): void {
    for (const stream of this.streams.values()) {
      stream.start();
    }
  }

  /** Stops all streams and cleans up resources. */
  stopAll(): void {
    for (const stream of this.streams.values()) {
      stream.stop();
    }
  }

  /** Returns a specific stream by its ID. */
  getStream(id: string): DexScreenerStream | undefined {
    return this.streams.get(id);
  }

  /** Returns all stream IDs. */
  getStreamIds(): string[] {
    return Array.from(this.streams.keys());
  }

  /** Returns the number of configured streams. */
  getStreamCount(): number {
    return this.streams.size;
  }
}
