import { EventSource } from 'eventsource';
import type {
  ConnectionState,
  DexEvent,
  DexStreamOptions,
  Pair,
  StreamContext,
} from './types.js';
import { buildSseUrl, validateUrls } from './utils/url.js';
import { KeepAliveManager } from './utils/keep-alive.js';

const DEFAULT_RETRY_MS = 3000;
const DEFAULT_KEEP_ALIVE_MS = 120000; // 2 minutes

/**
 * SSE stream client for consuming DexScreener realtime data.
 * Handles connection lifecycle, automatic reconnection, and event callbacks.
 */
export class DexScreenerStream {
  private eventSource: EventSource | null = null;
  private closed: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private keepAliveManager: KeepAliveManager | null = null;
  private keepAliveStreamKey: string | null = null;

  private readonly baseUrl: string;
  private readonly pageUrl: string;
  private readonly apiToken: string;
  private readonly streamId?: string;
  private readonly retryMs: number;
  private readonly keepAliveMs?: number;
  private readonly onBatch?: (event: DexEvent, ctx: StreamContext) => void;
  private readonly onPair?: (pair: Pair, ctx: StreamContext) => void;
  private readonly onError?: (error: unknown, ctx: StreamContext) => void;
  private readonly onStateChange?: (state: ConnectionState, ctx: StreamContext) => void;

  constructor(options: DexStreamOptions) {
    validateUrls(options.baseUrl, options.pageUrl);
    
    if (!options.apiToken || options.apiToken.trim() === '') {
      throw new Error('apiToken is required');
    }

    this.baseUrl = options.baseUrl;
    this.pageUrl = options.pageUrl;
    this.apiToken = options.apiToken;
    this.streamId = options.streamId;
    this.retryMs = options.retryMs ?? DEFAULT_RETRY_MS;
    this.keepAliveMs = options.keepAliveMs ?? DEFAULT_KEEP_ALIVE_MS;
    this.onBatch = options.onBatch;
    this.onPair = options.onPair;
    this.onError = options.onError;
    this.onStateChange = options.onStateChange;
  }

  /** Starts the SSE connection and begins receiving events. */
  start(): void {
    this.closed = false;
    this.cancelReconnect();

    const sseUrl = buildSseUrl(this.baseUrl, this.pageUrl);
    this.setConnectionState('connecting');
    this.startKeepAlive();

    this.eventSource = new EventSource(sseUrl, {
      fetch: (url, init) => {
        return fetch(url, {
          ...init,
          headers: {
            ...init.headers,
            'Authorization': `Bearer ${this.apiToken}`
          }
        });
      }
    });

    this.eventSource.onopen = () => {};

    this.eventSource.addEventListener('connected', () => {
      this.setConnectionState('connected');
    });

    this.eventSource.addEventListener('ping', () => {
      /** Ping received, connection is alive - no action needed */
    });

    this.eventSource.addEventListener('shutdown', (event: MessageEvent) => {
      this.handleShutdown(event);
    });

    this.eventSource.addEventListener('pairs', (event: MessageEvent) => {
      this.handleMessage(event);
    });

    this.eventSource.onmessage = (event: MessageEvent) => {
      this.handleMessage(event);
    };

    this.eventSource.onerror = (error: Event) => {
      this.handleError(error);
    };
  }

  /** Stops the connection and cleans up resources. */
  stop(): void {
    this.closed = true;
    this.cancelReconnect();
    this.stopKeepAlive();
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.setConnectionState('disconnected');
  }

  /** Returns the current connection state. */
  getState(): ConnectionState {
    return this.connectionState;
  }

  private getContext(): StreamContext {
    return { streamId: this.streamId };
  }

  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    this.onStateChange?.(state, this.getContext());
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const raw = JSON.parse(event.data);

      if (raw.event_type === 'connected') {
        this.setConnectionState('connected');
        return;
      }

      if (raw.event_type === 'ping' || raw.ping) {
        return;
      }

      // Actor sends: { data: { stats, pairs }, event_type, timestamp }
      const eventData = raw.data ?? raw;
      
      if (raw.event_type === 'pairs' || eventData.pairs) {
        const dexEvent: DexEvent = {
          stats: eventData.stats,
          pairs: eventData.pairs,
          event_type: raw.event_type,
          timestamp: raw.timestamp,
        };
        this.processEvent(dexEvent);
      }
    } catch (error) {
      this.onError?.(error, this.getContext());
    }
  }

  private processEvent(event: DexEvent): void {
    const ctx = this.getContext();
    this.onBatch?.(event, ctx);

    if (event.pairs && this.onPair) {
      for (const pair of event.pairs) {
        this.onPair(pair, ctx);
      }
    }
  }

  private handleShutdown(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      const message = data.message || 'Server shutting down';
      
      /** Log shutdown message via error callback */
      this.onError?.(new Error(`Server shutdown: ${message}`), this.getContext());
    } catch {
      this.onError?.(new Error('Server shutdown'), this.getContext());
    }

    /** Close current connection */
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    /** Schedule reconnect if not explicitly stopped */
    if (!this.closed) {
      this.scheduleReconnect();
    }
  }

  private handleError(error: Event): void {
    const errorWithCode = error as Event & { code?: number; message?: string };
    
    /** Check for authentication errors (401) - don't retry these */
    if (errorWithCode.code === 401) {
      const authError = new Error('Authentication failed: Invalid or expired API token. Please check your APIFY_TOKEN.');
      this.onError?.(authError, this.getContext());
      
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
      
      this.stopKeepAlive();
      this.setConnectionState('disconnected');
      return;
    }
    
    /** Check for other client errors (4xx) - don't retry these */
    if (errorWithCode.code && errorWithCode.code >= 400 && errorWithCode.code < 500) {
      const clientError = new Error(`Client error (${errorWithCode.code}): ${errorWithCode.message || 'Request failed'}`);
      this.onError?.(clientError, this.getContext());
      
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
      
      this.stopKeepAlive();
      this.setConnectionState('disconnected');
      return;
    }

    this.onError?.(error, this.getContext());

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (!this.closed) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    this.setConnectionState('reconnecting');
    
    this.reconnectTimer = setTimeout(() => {
      if (!this.closed) {
        this.start();
      }
    }, this.retryMs);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startKeepAlive(): void {
    if (this.keepAliveMs === undefined || this.keepAliveMs <= 0) {
      return;
    }

    if (this.keepAliveManager && this.keepAliveStreamKey) {
      return;
    }

    this.keepAliveManager = KeepAliveManager.getOrCreate(this.baseUrl, this.apiToken, this.keepAliveMs);
    this.keepAliveStreamKey = this.streamId ?? `stream-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.keepAliveManager.register(this.keepAliveStreamKey);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveManager && this.keepAliveStreamKey) {
      this.keepAliveManager.unregister(this.keepAliveStreamKey);
      this.keepAliveManager = null;
      this.keepAliveStreamKey = null;
    }
  }
}
