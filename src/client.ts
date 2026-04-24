import WebSocket from 'ws';
import type {
  ConnectionState,
  DexEvent,
  DexStreamOptions,
  Pair,
  StreamContext,
} from './types.js';
import { validateUrls } from './utils/url.js';
import { KeepAliveManager } from './utils/keep-alive.js';
import { AuthManager } from './auth/manager.js';
import { sanitizeErrorValue, createErrorWithContext } from './errors/sanitizer.js';
import { normalizeDexEvent } from './normalize.js';

const DEFAULT_RETRY_MS = 3000;
const DEFAULT_KEEP_ALIVE_MS = 120000; // 2 minutes

/**
 * WebSocket stream client for consuming DexScreener realtime data.
 * 
 * Handles connection lifecycle, automatic reconnection, and event callbacks.
 * Supports keep-alive functionality to maintain long-running connections.
 * 
 * @example
 * ```typescript
 * const stream = new DexScreenerStream({
 *   baseUrl: 'https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor',
 *   pageUrl: 'https://dexscreener.com/solana',
 *   apiToken: process.env.APIFY_TOKEN!,
 *   streamId: 'solana-stream',
 *   onBatch: (event, ctx) => {
 *     console.log(`Received ${event.pairs.length} pairs`);
 *   },
 *   onPair: (pair, ctx) => {
 *     console.log(`${pair.baseToken.symbol}: $${pair.priceUsd}`);
 *   },
 *   onError: (error, ctx) => {
 *     console.error('Stream error:', error);
 *   },
 *   onStateChange: (state, ctx) => {
 *     console.log('Connection state:', state);
 *   }
 * });
 * 
 * stream.start();
 * 
 * // Later, stop the stream
 * stream.stop();
 * ```
 */
export class DexScreenerStream {
  private ws: WebSocket | null = null;
  private closed: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private keepAliveManager: KeepAliveManager | null = null;
  private keepAliveStreamKey: string | null = null;
  private authManager: AuthManager;
  private authFailedNoFallback: boolean = false;

  private readonly baseUrl: string;
  private readonly pageUrl: string;
  private readonly apiToken: string;
  private readonly streamId: string;
  private readonly retryMs: number;
  private readonly keepAliveMs?: number;
  private readonly onBatch?: (event: DexEvent, ctx: StreamContext) => void;
  private readonly onPair?: (pair: Pair, ctx: StreamContext) => void;
  private readonly onError?: (error: unknown, ctx: StreamContext) => void;
  private readonly onStateChange?: (state: ConnectionState, ctx: StreamContext) => void;

  /**
   * Creates a new DexScreenerStream instance.
   * 
   * @param options - Stream configuration options
   * @param options.baseUrl - Apify Actor base URL (e.g., 'https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor')
   * @param options.pageUrl - Page URL to monitor (e.g., 'https://dexscreener.com/solana')
   * @param options.apiToken - Apify API token for authentication
   * @param options.streamId - Optional unique identifier for this stream
   * @param options.authMode - Authentication mode: 'auto' (default), 'header', 'query', or 'both'
   * @param options.retryMs - Milliseconds to wait before reconnecting after error (default: 3000)
   * @param options.keepAliveMs - Milliseconds between keep-alive pings (default: 120000)
   * @param options.onBatch - Callback invoked when a batch of pairs is received
   * @param options.onPair - Callback invoked for each individual pair in a batch
   * @param options.onError - Callback invoked when an error occurs
   * @param options.onStateChange - Callback invoked when connection state changes
   * 
   * @throws Error if baseUrl or pageUrl are invalid URLs
   * @throws Error if apiToken is empty or missing
   */
  constructor(options: DexStreamOptions) {
    validateUrls(options.baseUrl, options.pageUrl);
    
    if (!options.apiToken || options.apiToken.trim() === '') {
      throw new Error('apiToken is required');
    }

    this.baseUrl = options.baseUrl;
    this.pageUrl = options.pageUrl;
    this.apiToken = options.apiToken;
    this.streamId = options.streamId ?? crypto.randomUUID();
    this.retryMs = options.retryMs ?? DEFAULT_RETRY_MS;
    this.keepAliveMs = options.keepAliveMs ?? DEFAULT_KEEP_ALIVE_MS;
    this.onBatch = options.onBatch;
    this.onPair = options.onPair;
    this.onError = options.onError;
    this.onStateChange = options.onStateChange;

    // Initialize AuthManager with token and authMode
    this.authManager = new AuthManager(
      this.apiToken,
      options.authMode ?? 'auto',
      this.baseUrl,
      this.pageUrl
    );
  }

  /**
   * Starts the WebSocket connection and begins receiving events.
   * 
   * Establishes connection to the DexScreener API, sets up event handlers,
   * and begins processing realtime trading pair updates. Automatically
   * reconnects on connection loss unless explicitly stopped.
   * 
   * Security:
   * - Uses Bearer token format for Authorization header
   * - Excludes token from URL for auto/header modes
   * - Validates server certificates for WSS connections (default behavior)
   * 
   * @example
   * ```typescript
   * stream.start();
   * ```
   */
  start(): void {
    this.closed = false;
    this.authFailedNoFallback = false;
    this.cancelReconnect();
    this.authManager.reset();

    const { url, headers } = this.authManager.getConnectionOptions();
    this.setConnectionState('connecting');
    this.startKeepAlive();

    // WebSocket with certificate validation enabled (default for wss://)
    this.ws = new WebSocket(url, { headers });

    this.ws.on('open', () => this.handleOpen());
    this.ws.on('message', (data: WebSocket.Data) => this.handleMessage(data));
    this.ws.on('error', (error: Error) => this.handleError(error));
    this.ws.on('close', (code: number, reason: Buffer) => this.handleClose(code, reason.toString()));
  }

  /**
   * Stops the connection and cleans up resources.
   * 
   * Closes the WebSocket connection, cancels any pending reconnection attempts,
   * stops keep-alive pings, and sets connection state to disconnected.
   * After calling stop(), the stream will not automatically reconnect.
   * 
   * @example
   * ```typescript
   * stream.stop();
   * ```
   */
  stop(): void {
    this.closed = true;
    this.cancelReconnect();
    this.stopKeepAlive();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setConnectionState('disconnected');
  }

  /**
   * Returns the current connection state.
   * 
   * @returns Current connection state: 'disconnected', 'connecting', 'connected', or 'reconnecting'
   * 
   * @example
   * ```typescript
   * const state = stream.getState();
   * console.log('Current state:', state);
   * ```
   */
  getState(): ConnectionState {
    return this.connectionState;
  }

  private getContext(): StreamContext {
    return { 
      streamId: this.streamId,
      state: this.connectionState
    };
  }

  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    this.onStateChange?.(state, this.getContext());
  }

  private handleOpen(): void {
    // WebSocket connection opened, waiting for 'connected' event from server
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const raw = JSON.parse(data.toString());

      if (raw.event_type === 'connected') {
        this.setConnectionState('connected');
        return;
      }

      if (raw.event_type === 'ping' || raw.ping) {
        return;
      }

      // Handle error messages from server
      if (raw.event_type === 'error') {
        const errorData = raw.data && typeof raw.data === 'object' ? raw.data : {};
        const rawMessage = raw.message ?? errorData.message ?? 'Server error';
        const rawCode = raw.code ?? errorData.code;
        const message = rawCode ? `${rawCode}: ${rawMessage}` : rawMessage;
        const sanitizedMessage = sanitizeErrorValue(message);
        this.onError?.(new Error(sanitizedMessage), this.getContext());
        return;
      }

      // Actor sends: { data: { stats, pairs }, event_type, timestamp }
      const eventData = raw.data ?? raw;

      if (raw.event_type === 'pairs' || eventData.pairs) {
        const dexEvent = normalizeDexEvent({
          ...eventData,
          event_type: raw.event_type ?? eventData.event_type,
          timestamp: raw.timestamp ?? eventData.timestamp,
        } as DexEvent);
        this.processEvent(dexEvent);
      }
    } catch (error) {
      // JSON parse error - invoke onError but keep connection open
      const sanitizedError = createErrorWithContext(error, this.connectionState, 'protocol');
      this.onError?.(new Error(sanitizedError), this.getContext());
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

  private handleError(error: Error): void {
    // Check for HTTP 401/403 errors during WebSocket upgrade
    const errorMessage = error.message || '';
    const isUpgradeAuthError = (
      /\b401\b/.test(errorMessage) ||
      /\b403\b/.test(errorMessage) ||
      errorMessage.toLowerCase().includes('unauthorized') ||
      errorMessage.toLowerCase().includes('forbidden')
    );

    // Attempt authentication fallback if this is an upgrade auth error
    if (isUpgradeAuthError && this.authManager.shouldAttemptFallback(undefined, errorMessage)) {
      const sanitizedMessage = `Auth failed during upgrade with ${this.authManager.getMode()}, retrying with query token`;
      this.onError?.(
        new Error(sanitizedMessage),
        this.getContext()
      );
      
      // Close current WebSocket and switch to query-based auth
      if (this.ws) {
        this.ws.removeAllListeners();
        this.ws.close();
        this.ws = null;
      }
      
      this.authManager.fallbackToQuery();
      this.retryWithCurrentAuth();
      return;
    }

    // Auth error but no fallback possible - treat as fatal
    if (isUpgradeAuthError) {
      const sanitizedReason = sanitizeErrorValue(errorMessage);
      const errorMsg = createErrorWithContext(
        `Authentication failed: ${sanitizedReason}`,
        this.connectionState,
        'auth'
      );
      this.onError?.(new Error(errorMsg), this.getContext());
      
      // Mark as auth failure to prevent reconnect
      this.authFailedNoFallback = true;
      
      // Clean up
      if (this.ws) {
        this.ws.removeAllListeners();
        this.ws.close();
        this.ws = null;
      }
      this.stopKeepAlive();
      this.setConnectionState('disconnected');
      return;
    }

    // WebSocket error event - log error and let handleClose deal with reconnection
    const sanitizedError = createErrorWithContext(error, this.connectionState, 'network');
    this.onError?.(new Error(sanitizedError), this.getContext());
  }

  /**
   * Handles WebSocket close events with authentication fallback logic.
   * 
   * State Transition Rules:
   * 1. Auth error (4401/4403) + auto mode + no fallback yet → Retry with query auth
   * 2. Auth error + fallback already attempted → Transition to 'disconnected' (no retry)
   * 3. Auth error + non-auto mode → Transition to 'disconnected' (no retry)
   * 4. Network error + not stopped → Transition to 'reconnecting' and schedule retry
   * 5. Explicitly stopped → Transition to 'disconnected' (no retry)
   * 
   * Authentication Fallback:
   * - Only happens in 'auto' mode
   * - Triggered by 4401 (auth failed) or 4403 (forbidden) close codes
   * - Attempts fallback at most once per connection cycle
   * - Switches from header auth to query auth
   * - Immediate retry without delay
   * 
   * @param code - WebSocket close code
   * @param reason - Close reason string
   */
  private handleClose(code: number, reason: string): void {
    // Check if this close is from a fatal auth error
    if (this.authFailedNoFallback) {
      this.authFailedNoFallback = false;
      return; // Don't reconnect
    }

    const isAuthError = (code === 4401 || code === 4403);
    
    // Attempt authentication fallback if applicable
    // This is the ONLY place where auth fallback happens
    if (isAuthError && this.authManager.shouldAttemptFallback(code)) {
      const sanitizedMessage = `Auth failed with ${this.authManager.getMode()}, retrying with query token`;
      this.onError?.(
        new Error(sanitizedMessage),
        this.getContext()
      );
      // Switch to query-based auth and mark fallback as attempted
      this.authManager.fallbackToQuery();
      // Immediate retry with new auth method - don't call start() which would reset auth
      this.retryWithCurrentAuth();
      return;
    }
    
    // Auth failed after fallback or no fallback available
    // No reconnection for auth errors - user must fix token and restart manually
    if (isAuthError) {
      const sanitizedReason = sanitizeErrorValue(reason || 'Invalid or expired API token');
      const errorMessage = createErrorWithContext(
        `Authentication failed: ${sanitizedReason}`,
        this.connectionState,
        'auth'
      );
      this.onError?.(
        new Error(errorMessage),
        this.getContext()
      );
      this.stopKeepAlive();
      this.setConnectionState('disconnected');
      return;
    }
    
    // Network error or server shutdown - schedule reconnect
    // Automatic reconnection for recoverable errors
    if (!this.closed) {
      this.scheduleReconnect();
    } else {
      this.setConnectionState('disconnected');
    }
  }

  private retryWithCurrentAuth(): void {
    // Retry connection without resetting auth manager
    this.closed = false;
    this.authFailedNoFallback = false;
    this.cancelReconnect();

    const { url, headers } = this.authManager.getConnectionOptions();
    this.setConnectionState('connecting');

    // WebSocket with certificate validation enabled (default for wss://)
    this.ws = new WebSocket(url, { headers });

    this.ws.on('open', () => this.handleOpen());
    this.ws.on('message', (data: WebSocket.Data) => this.handleMessage(data));
    this.ws.on('error', (error: Error) => this.handleError(error));
    this.ws.on('close', (code: number, reason: Buffer) => this.handleClose(code, reason.toString()));
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
    this.keepAliveStreamKey = this.streamId;
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
