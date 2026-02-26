/**
 * Error sanitization utilities to prevent sensitive data exposure
 * 
 * Ensures API tokens and other sensitive information never appear in error messages,
 * logs, or stack traces. Provides safe error formatting with connection state context.
 */

import type { ConnectionState } from '../types.js';

/**
 * Sanitizes error messages by removing API tokens and sensitive data.
 * 
 * Removes:
 * - API tokens (apify_api_*, Bearer tokens, query parameters)
 * - Authorization headers
 * - Sensitive query parameters
 * 
 * @param message - Error message to sanitize
 * @returns Sanitized error message with tokens replaced by [REDACTED]
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message) return message;

  let sanitized = message;

  // Remove Apify API tokens (apify_api_xxxxx)
  sanitized = sanitized.replace(/apify_api_[a-zA-Z0-9_-]+/gi, '[REDACTED]');

  // Remove Bearer tokens - must come before Authorization header replacement
  sanitized = sanitized.replace(/Bearer\s+[a-zA-Z0-9_-]+/gi, 'Bearer [REDACTED]');

  // Remove tokens from query parameters
  sanitized = sanitized.replace(/([?&]token=)[^&\s]+/gi, '$1[REDACTED]');

  // Remove tokens from Authorization headers (but not if already [REDACTED])
  sanitized = sanitized.replace(/(Authorization:\s*)(?!\[REDACTED\])[^\s,}]+/gi, '$1[REDACTED]');

  // Remove any remaining long alphanumeric strings that look like tokens (40+ chars)
  sanitized = sanitized.replace(/\b[a-zA-Z0-9_-]{40,}\b/g, '[REDACTED]');

  return sanitized;
}

/**
 * Sanitizes an Error object by replacing its message with a sanitized version.
 * 
 * @param error - Error object to sanitize
 * @returns New Error object with sanitized message
 */
export function sanitizeError(error: Error): Error {
  const sanitized = new Error(sanitizeErrorMessage(error.message));
  sanitized.name = error.name;
  sanitized.stack = error.stack ? sanitizeErrorMessage(error.stack) : undefined;
  return sanitized;
}

/**
 * Sanitizes any error value (Error, string, or unknown) and returns a safe error message.
 * 
 * @param error - Error value to sanitize
 * @returns Sanitized error message string
 */
export function sanitizeErrorValue(error: unknown): string {
  if (error instanceof Error) {
    return sanitizeErrorMessage(error.message);
  }
  
  if (typeof error === 'string') {
    return sanitizeErrorMessage(error);
  }

  if (error && typeof error === 'object') {
    try {
      const json = JSON.stringify(error);
      return sanitizeErrorMessage(json);
    } catch {
      return 'Unknown error (could not serialize)';
    }
  }

  return 'Unknown error';
}

/**
 * Creates a descriptive error message with connection state context.
 * 
 * Distinguishes between:
 * - Network errors (connection failures, timeouts)
 * - Authentication errors (invalid tokens, forbidden)
 * - Protocol errors (invalid messages, parse failures)
 * 
 * @param error - Original error
 * @param state - Current connection state
 * @param errorType - Type of error ('network' | 'auth' | 'protocol' | 'unknown')
 * @returns Sanitized error message with context
 */
export function createErrorWithContext(
  error: unknown,
  state: ConnectionState,
  errorType: 'network' | 'auth' | 'protocol' | 'unknown' = 'unknown'
): string {
  const sanitizedMessage = sanitizeErrorValue(error);
  
  let prefix = '';
  switch (errorType) {
    case 'network':
      prefix = 'Network error';
      break;
    case 'auth':
      prefix = 'Authentication error';
      break;
    case 'protocol':
      prefix = 'Protocol error';
      break;
    default:
      prefix = 'Error';
  }

  return `${prefix} (state: ${state}): ${sanitizedMessage}`;
}

/**
 * Sanitizes a WebSocket URL by removing token query parameters.
 * 
 * @param url - WebSocket URL to sanitize
 * @returns Sanitized URL with token parameter removed
 */
export function sanitizeUrl(url: string): string {
  if (!url) return url;

  try {
    const urlObj = new URL(url);
    
    // Remove token parameter if present
    if (urlObj.searchParams.has('token')) {
      urlObj.searchParams.delete('token');
      // Add back as plain text to avoid URL encoding
      const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
      const params = urlObj.searchParams.toString();
      return params ? `${baseUrl}?token=[REDACTED]&${params}` : `${baseUrl}?token=[REDACTED]`;
    }

    return urlObj.toString();
  } catch {
    // If URL parsing fails, use regex fallback
    return url.replace(/([?&]token=)[^&\s]+/gi, '$1[REDACTED]');
  }
}

/**
 * Checks if an error message contains potentially sensitive information.
 * 
 * @param message - Error message to check
 * @returns true if message may contain sensitive data
 */
export function containsSensitiveData(message: string): boolean {
  if (!message) return false;

  // Check for API token patterns
  if (/apify_api_[a-zA-Z0-9_-]+/i.test(message)) return true;
  
  // Check for Bearer tokens
  if (/Bearer\s+[a-zA-Z0-9_-]+/i.test(message)) return true;
  
  // Check for token query parameters
  if (/[?&]token=[^&\s]+/i.test(message)) return true;
  
  // Check for Authorization headers
  if (/Authorization:\s*[^\s,}]+/i.test(message)) return true;

  // Check for long alphanumeric strings that might be tokens
  if (/\b[a-zA-Z0-9_-]{40,}\b/.test(message)) return true;

  return false;
}
