import { sanitizeBaseUrl } from './url.js';

const DEFAULT_KEEP_ALIVE_MS = 120000;

const managerRegistry: Map<string, KeepAliveManager> = new Map();

/**
 * Manages periodic health checks to keep Apify Standby containers warm.
 * Shared across streams with the same base URL.
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

  /** Gets an existing manager or creates a new one for the given base URL. */
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

  /** Registers a stream to be kept alive. Starts health checks if this is the first stream. */
  register(streamId: string): void {
    const wasEmpty = this.activeStreams.size === 0;
    this.activeStreams.add(streamId);
    
    if (wasEmpty && this.activeStreams.size > 0) {
      this.startHealthChecks();
    }
  }

  /** Unregisters a stream. Stops health checks if no streams remain. */
  unregister(streamId: string): void {
    this.activeStreams.delete(streamId);
    
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
    const healthUrl = `${this.sanitizedBaseUrl}/health`;
    
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
