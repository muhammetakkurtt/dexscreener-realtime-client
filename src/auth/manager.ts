import { buildWsUrl } from '../utils/url.js';
import type { AuthMode } from '../types.js';

/**
 * Manages authentication strategy and fallback logic for WebSocket connections.
 * 
 * Supports multiple authentication modes:
 * - 'auto': Try header-based auth first, fallback to query on 4401 error
 * - 'header': Send token in Authorization header only
 * - 'query': Send token as query parameter only
 * - 'both': Send token in both header and query parameter
 * 
 * Tracks fallback attempts to prevent infinite loops (max 1 fallback per connection cycle).
 */
export class AuthManager {
  private token: string;
  private mode: AuthMode;
  private originalMode: AuthMode;
  private baseUrl: string;
  private pageUrl: string;
  private attemptedFallback: boolean = false;

  /**
   * Creates a new AuthManager instance.
   * @param token - API token for authentication
   * @param authMode - Authentication mode (default: 'auto')
   * @param baseUrl - Base URL for the WebSocket connection
   * @param pageUrl - Page URL to monitor
   */
  constructor(
    token: string,
    authMode: AuthMode = 'auto',
    baseUrl: string,
    pageUrl: string
  ) {
    this.token = token;
    this.mode = authMode;
    this.originalMode = authMode;
    this.baseUrl = baseUrl;
    this.pageUrl = pageUrl;
  }

  /**
   * Gets WebSocket connection options for the current authentication strategy.
   * 
   * Returns URL and headers based on the current auth mode:
   * - 'header' or 'auto': Authorization header, no token in URL
   * - 'query': Token in URL, no Authorization header
   * - 'both': Authorization header AND token in URL
   * 
   * @returns Object containing WebSocket URL and headers
   */
  getConnectionOptions(): { url: string; headers: Record<string, string> } {
    const headers: Record<string, string> = {};

    // Add Authorization header for header-based or auto modes
    if (this.mode === 'header' || this.mode === 'auto' || this.mode === 'both') {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // Build URL with or without token query parameter
    const includeTokenInQuery = this.mode === 'query' || this.mode === 'both';
    const url = buildWsUrl(
      this.baseUrl,
      this.pageUrl,
      includeTokenInQuery ? this.token : undefined,
      this.mode
    );

    return { url, headers };
  }

  /**
   * Determines if authentication fallback should be attempted after a close event or error.
   * 
   * Returns true only if:
   * - Close code is 4401 (auth failed) or 4403 (forbidden), OR
   * - Error message contains auth failure indicators (401, 403, unauthorized, forbidden)
   * - Current mode is 'auto'
   * - Fallback has not been attempted yet in this connection cycle
   * 
   * This ensures fallback is attempted at most once per connection cycle.
   * 
   * @param closeCode - Optional WebSocket close code
   * @param errorMessage - Optional error message from upgrade failure
   * @returns true if fallback should be attempted, false otherwise
   */
  shouldAttemptFallback(closeCode?: number, errorMessage?: string): boolean {
    const isAuthCloseCode = closeCode === 4401 || closeCode === 4403;
    const isAuthErrorMessage = !!errorMessage && (
      errorMessage.includes('401') ||
      errorMessage.includes('403') ||
      errorMessage.toLowerCase().includes('unauthorized') ||
      errorMessage.toLowerCase().includes('forbidden')
    );
    
    const isAuthError = isAuthCloseCode || isAuthErrorMessage;
    const isAutoMode = this.mode === 'auto';
    const notAttempted = !this.attemptedFallback;

    return isAuthError && isAutoMode && notAttempted;
  }

  /**
   * Switches authentication mode to query-based and marks fallback as attempted.
   * 
   * This is called when header-based authentication fails in 'auto' mode.
   * After calling this, subsequent getConnectionOptions() calls will include
   * the token in the query parameter instead of the Authorization header.
   */
  fallbackToQuery(): void {
    this.mode = 'query';
    this.attemptedFallback = true;
  }

  /**
   * Resets the fallback state for a new connection cycle.
   * 
   * This should be called when starting a new connection attempt to allow
   * fallback to be attempted again if needed.
   */
  reset(): void {
    this.attemptedFallback = false;
    // Reset mode to original if it was changed during fallback
    this.mode = this.originalMode;
  }

  /**
   * Gets the current authentication mode.
   * @returns Current AuthMode
   */
  getMode(): AuthMode {
    return this.mode;
  }

  /**
   * Checks if fallback has been attempted in the current connection cycle.
   * @returns true if fallback was attempted, false otherwise
   */
  hasAttemptedFallback(): boolean {
    return this.attemptedFallback;
  }
}
