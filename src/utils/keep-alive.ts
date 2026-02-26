import { sanitizeBaseUrl, buildHealthUrl } from './url.js';

const DEFAULT_KEEP_ALIVE_MS = 120000;

const managerRegistry: Map<string, KeepAliveManager> = new Map();

/**
 * Manages periodic health checks to keep Apify Standby containers warm.
 * 
 * Lifecycle:
 * 1. Manager is created when first stream registers (via getOrCreate)
 * 2. Health checks start when first stream registers
 * 3. Health checks continue while any stream is active
 * 4. Health checks stop when last stream unregisters
 * 5. Manager remains in registry for reuse by future streams
 * 
 * Sharing:
 * - One manager instance per unique baseUrl+apiToken combination
 * - Multiple streams can share the same manager
 * - Reduces redundant health check requests
 * 
 * Protocol Mapping:
 * - Uses buildHealthUrl() to map ws:// → http:// and wss:// → https://
 * - Health checks always use HTTP/HTTPS regardless of WebSocket protocol
 */
export class KeepAliveManager {
  private intervalId: NodeJS.Timeout | null = null;
  private activeStreams: Set<string> = new Set();
  private readonly sanitizedBaseUrl: string;
  private readonly apiToken: string;
  private readonly intervalMs: number;

  constructor(baseUrl: string, apiToken: string, intervalMs: number = DEFAULT_KEEP_ALIVE_MS) {
    this.sanitizedBaseUrl = sanitizeBaseUrl(baseUrl);
    this.apiToken = apiToken;
    this.intervalMs = intervalMs;
  }

  /**
   * Gets an existing manager or creates a new one for the given base URL.
   * 
   * Managers are cached in a global registry by baseUrl+apiToken key.
   * This ensures multiple streams to the same Actor share a single manager,
   * reducing redundant health check requests.
   * 
   * @param baseUrl - Base URL (any protocol, will be normalized)
   * @param apiToken - API token for authentication
   * @param intervalMs - Health check interval (default: 120000ms = 2 minutes)
   * @returns Existing or new KeepAliveManager instance
   */
  static getOrCreate(baseUrl: string, apiToken: string, intervalMs?: number): KeepAliveManager {
    const sanitized = sanitizeBaseUrl(baseUrl);
    const key = `${sanitized}:${apiToken}`;
    
    let manager = managerRegistry.get(key);
    if (!manager) {
      manager = new KeepAliveManager(baseUrl, apiToken, intervalMs);
      managerRegistry.set(key, manager);
    }
    return manager;
  }

  /**
   * Registers a stream to be kept alive.
   * 
   * Lifecycle:
   * - Adds stream to active set
   * - If this is the first stream, starts health check interval
   * - Subsequent registrations don't restart the interval
   * 
   * @param streamId - Unique identifier for the stream
   */
  register(streamId: string): void {
    const wasEmpty = this.activeStreams.size === 0;
    this.activeStreams.add(streamId);
    
    // Start health checks when first stream registers
    if (wasEmpty && this.activeStreams.size > 0) {
      this.startHealthChecks();
    }
  }

  /**
   * Unregisters a stream.
   * 
   * Lifecycle:
   * - Removes stream from active set
   * - If this was the last stream, stops health check interval
   * - Manager remains in registry for future reuse
   * 
   * @param streamId - Unique identifier for the stream
   */
  unregister(streamId: string): void {
    this.activeStreams.delete(streamId);
    
    // Stop health checks when last stream unregisters
    if (this.activeStreams.size === 0) {
      this.stop();
    }
  }

  /** Stops all health checks. */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /** Returns the number of active streams. */
  getActiveStreamCount(): number {
    return this.activeStreams.size;
  }

  /** Checks if a stream is registered. */
  hasStream(streamId: string): boolean {
    return this.activeStreams.has(streamId);
  }

  private startHealthChecks(): void {
    if (this.intervalId) {
      return;
    }

    this.performHealthCheck();

    this.intervalId = setInterval(() => {
      this.performHealthCheck();
    }, this.intervalMs);
  }

  private async performHealthCheck(): Promise<void> {
    const healthUrl = buildHealthUrl(this.sanitizedBaseUrl);
    
    try {
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        },
        signal: AbortSignal.timeout(10000),
      });
      
      if (!response.ok) {
        console.warn(`[KeepAlive] Health check warning: ${healthUrl} returned status ${response.status}`);
      }
    } catch (error) {
      console.warn(
        `[KeepAlive] Health check failed for ${healthUrl}:`,
        error instanceof Error ? error.message : error
      );
    }
  }
}

/** Clears all managers from the registry. Useful for testing. */
export function clearManagerRegistry(): void {
  for (const manager of managerRegistry.values()) {
    manager.stop();
  }
  managerRegistry.clear();
}
