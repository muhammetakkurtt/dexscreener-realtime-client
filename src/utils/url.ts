/** Removes trailing slashes from a URL. */
export function sanitizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

/**
 * Converts HTTP/HTTPS protocols to WS/WSS equivalents for WebSocket connections.
 * 
 * Protocol Normalization Rules:
 * - http://  → ws://   (insecure WebSocket)
 * - https:// → wss://  (secure WebSocket)
 * - ws://    → ws://   (unchanged)
 * - wss://   → wss://  (unchanged)
 * 
 * This allows users to provide base URLs in any common format without
 * worrying about the specific protocol required for WebSocket connections.
 * 
 * @param baseUrl - Base URL with any protocol
 * @returns URL with WebSocket protocol (ws:// or wss://)
 */
export function normalizeProtocol(baseUrl: string): string {
  if (baseUrl.startsWith('http://')) {
    return baseUrl.replace('http://', 'ws://');
  }
  if (baseUrl.startsWith('https://')) {
    return baseUrl.replace('https://', 'wss://');
  }
  return baseUrl; // ws:// or wss:// unchanged
}

/**
 * Builds WebSocket URL with protocol normalization and authentication strategy.
 * 
 * Process:
 * 1. Normalizes protocol (http/https → ws/wss)
 * 2. Ensures path ends with /events/dex/pairs
 * 3. Adds query parameters based on authMode
 * 
 * Authentication Modes:
 * - 'auto' or 'header': Token NOT in URL (sent via Authorization header)
 * - 'query': Token in URL as query parameter
 * - 'both': Token in URL AND sent via Authorization header
 * 
 * @param baseUrl - Base URL (http/https/ws/wss) - will be normalized
 * @param pageUrl - DexScreener page URL to monitor
 * @param token - Optional API token
 * @param authMode - Authentication mode (default: 'auto')
 * @returns Complete WebSocket URL with query parameters
 * 
 * @example
 * // Header auth (token not in URL)
 * buildWsUrl('https://example.com', 'https://dexscreener.com/solana', 'token', 'header')
 * // Returns: wss://example.com/events/dex/pairs?page_url=https%3A%2F%2Fdexscreener.com%2Fsolana
 * 
 * @example
 * // Query auth (token in URL)
 * buildWsUrl('https://example.com', 'https://dexscreener.com/solana', 'token', 'query')
 * // Returns: wss://example.com/events/dex/pairs?page_url=...&token=token
 */
export function buildWsUrl(
  baseUrl: string,
  pageUrl: string,
  token?: string,
  authMode: 'auto' | 'header' | 'query' | 'both' = 'auto'
): string {
  // Step 1: Normalize protocol (http/https → ws/wss)
  let normalized = sanitizeBaseUrl(baseUrl);
  normalized = normalizeProtocol(normalized);

  // Step 2: Parse URL and ensure path ends with /events/dex/pairs
  const url = new URL(normalized);
  const endpoint = '/events/dex/pairs';
  
  // Append endpoint if not already present in the path
  if (!url.pathname.endsWith(endpoint)) {
    // Remove trailing slash if present, then append endpoint
    url.pathname = url.pathname.replace(/\/$/, '') + endpoint;
  }

  // Step 3: Build query parameters using URLSearchParams
  const params = new URLSearchParams(url.search);
  params.set('page_url', pageUrl);

  // Add token to query if authMode requires it
  // For 'auto' and 'header' modes, token is sent via Authorization header instead
  if (token && (authMode === 'query' || authMode === 'both')) {
    params.set('token', token);
  }

  url.search = params.toString();
  return url.toString();
}

/**
 * Builds health check URL with protocol mapping for keep-alive requests.
 * 
 * Protocol Mapping Rules:
 * - ws://  → http://   (WebSocket to HTTP)
 * - wss:// → https://  (Secure WebSocket to HTTPS)
 * - http:// and https:// pass through unchanged
 * 
 * This ensures health checks use HTTP/HTTPS protocol regardless of
 * whether the WebSocket connection uses ws:// or wss://.
 * 
 * @param baseUrl - Base URL (ws/wss/http/https)
 * @returns Health endpoint URL (http/https) ending with /health
 * 
 * @example
 * buildHealthUrl('wss://example.com')
 * // Returns: https://example.com/health
 */
export function buildHealthUrl(baseUrl: string): string {
  let normalized = sanitizeBaseUrl(baseUrl);

  // Map WebSocket protocols to HTTP protocols for health checks
  if (normalized.startsWith('ws://')) {
    normalized = normalized.replace('ws://', 'http://');
  } else if (normalized.startsWith('wss://')) {
    normalized = normalized.replace('wss://', 'https://');
  }
  // http:// and https:// pass through unchanged

  // Remove any existing path and append /health
  const url = new URL(normalized);
  url.pathname = '/health';
  url.search = '';

  return url.toString();
}

/**
 * Validates that required URLs are provided and non-empty.
 * Accepts http, https, ws, and wss protocols.
 */
export function validateUrls(baseUrl: string, pageUrl: string): void {
  if (!baseUrl || baseUrl.trim() === '') {
    throw new Error('baseUrl is required and cannot be empty');
  }

  if (!pageUrl || pageUrl.trim() === '') {
    throw new Error('pageUrl is required and cannot be empty');
  }

  // Validate baseUrl protocol
  const validProtocols = ['http://', 'https://', 'ws://', 'wss://'];
  const hasValidProtocol = validProtocols.some(protocol => 
    baseUrl.trim().startsWith(protocol)
  );

  if (!hasValidProtocol) {
    throw new Error(
      'baseUrl must start with http://, https://, ws://, or wss://'
    );
  }
}
