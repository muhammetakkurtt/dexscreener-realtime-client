/**
 * Error message formatting utilities
 * Provides actionable error messages with context and suggestions
 */

import {
  ErrorCode,
  ConfigurationError,
  StreamError,
  OutputError,
} from './index.js';

/**
 * Format authentication error with token validation suggestions
 */
export function formatAuthError(token?: string): StreamError {
  const message = 'Authentication failed. Invalid or missing API token.';
  const details = token
    ? 'The provided token was rejected by the server'
    : 'No API token provided';
  const suggestion =
    'Check that your APIFY_TOKEN environment variable is set correctly. ' +
    'The token should start with "apify_api_" and be obtained from your Apify account settings. ' +
    'Example: export APIFY_TOKEN=apify_api_xxxxxxxxxxxxx';

  return new StreamError(
    message,
    'auth',
    ErrorCode.STREAM_AUTH_FAILED,
    details,
    suggestion
  );
}

/**
 * Format network error with connectivity suggestions
 */
export function formatNetworkError(
  url: string,
  error: Error | string
): StreamError {
  const message = 'Network connection failed.';
  const errorMsg = typeof error === 'string' ? error : error.message;
  const details = `Failed to connect to ${url}: ${errorMsg}`;
  const suggestion =
    'Check your network connectivity and firewall settings. ' +
    'Verify the URL is correct and the server is accessible. ' +
    'Try: curl -I ' +
    url +
    ' to test connectivity. ' +
    'If behind a proxy, ensure proxy settings are configured correctly.';

  return new StreamError(
    message,
    url,
    ErrorCode.STREAM_CONNECTION_FAILED,
    details,
    suggestion
  );
}

/**
 * Format configuration error with field-specific examples
 */
export function formatConfigError(
  field: string,
  reason: string
): ConfigurationError {
  const message = `Invalid configuration value for '${field}'.`;
  let code: ErrorCode;
  let suggestion: string;

  // Determine error code and suggestion based on field
  // Check profile first before path since "profile" doesn't contain "path"
  if (field.toLowerCase().includes('profile')) {
    code = ErrorCode.CONFIG_PROFILE_NOT_FOUND;
    suggestion =
      'Check available profiles in your config file. ' +
      'Use --profile <name> to specify a profile, or set a default profile in the config.';
  } else if (field.toLowerCase().includes('baseurl') || field === 'baseUrl') {
    code = ErrorCode.CONFIG_INVALID_URL;
    suggestion =
      'Must be a valid HTTPS URL pointing to your Apify Actor. ' +
      'Example: https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor';
  } else if (field.toLowerCase().includes('pageurl') || field === 'pageUrl') {
    code = ErrorCode.CONFIG_INVALID_URL;
    suggestion =
      'Must be a valid HTTPS URL from DexScreener. ' +
      'Example: https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc';
  } else if (field.toLowerCase().includes('url')) {
    code = ErrorCode.CONFIG_INVALID_URL;
    suggestion =
      'Must be a valid HTTPS URL.';
  } else if (field.toLowerCase().includes('token')) {
    code = ErrorCode.CONFIG_INVALID_TOKEN;
    suggestion =
      'API token must start with "apify_api_" followed by alphanumeric characters. ' +
      'Get your token from: https://console.apify.com/settings/integrations?fpr=muh';
  } else if (field.toLowerCase().includes('path') || field.toLowerCase().includes('file')) {
    code = ErrorCode.CONFIG_INVALID_PATH;
    suggestion =
      'Ensure the directory exists and is writable. ' +
      'Use absolute paths or paths relative to the current directory. ' +
      'Example: ./output/data.jsonl';
  } else {
    code = ErrorCode.CONFIG_MISSING_REQUIRED;
    suggestion = `Provide a valid value for '${field}'. ${reason}`;
  }

  return new ConfigurationError(message, field, code, suggestion);
}

/**
 * Format file error with permission suggestions
 */
export function formatFileError(
  filePath: string,
  operation: 'read' | 'write' | 'create' | 'delete',
  error: Error | string
): OutputError {
  const message = `File ${operation} operation failed.`;
  const errorMsg = typeof error === 'string' ? error : error.message;
  const details = `Path: ${filePath}, Error: ${errorMsg}`;

  let suggestion: string;
  if (errorMsg.includes('EACCES') || errorMsg.includes('permission')) {
    suggestion =
      'Check file permissions. ' +
      `Try: chmod 644 ${filePath} (for files) or chmod 755 ${filePath} (for directories). ` +
      'Ensure the user running the process has appropriate permissions.';
  } else if (errorMsg.includes('ENOENT')) {
    suggestion =
      'The file or directory does not exist. ' +
      'Ensure the parent directory exists and the path is correct. ' +
      `Try: mkdir -p $(dirname ${filePath})`;
  } else if (errorMsg.includes('ENOSPC')) {
    suggestion =
      'No space left on device. ' +
      'Free up disk space or use a different output location. ' +
      'Check disk usage with: df -h';
  } else {
    suggestion =
      'Verify the file path is correct and accessible. ' +
      'Check that the disk is not full and the filesystem is mounted correctly.';
  }

  return new OutputError(
    message,
    'file',
    ErrorCode.OUTPUT_FILE_NOT_WRITABLE,
    details,
    suggestion
  );
}

/**
 * Format webhook error with status code details
 */
export function formatWebhookError(
  url: string,
  statusCode?: number,
  responseBody?: string
): OutputError {
  const message = 'Webhook request failed.';
  let details = `URL: ${url}`;

  if (statusCode !== undefined) {
    details += `, Status: ${statusCode}`;
    if (responseBody) {
      // Truncate long response bodies
      const truncated =
        responseBody.length > 200
          ? responseBody.substring(0, 200) + '...'
          : responseBody;
      details += `, Response: ${truncated}`;
    }
  }

  let suggestion: string;
  if (statusCode === undefined) {
    suggestion =
      'The webhook endpoint could not be reached. ' +
      'Check that the URL is correct and the server is running. ' +
      'Verify network connectivity and firewall rules.';
  } else if (statusCode >= 400 && statusCode < 500) {
    suggestion =
      'The webhook endpoint rejected the request (client error). ' +
      'Check the webhook URL and authentication credentials. ' +
      'Verify the request format matches what the endpoint expects. ' +
      `Status ${statusCode}: ${getStatusCodeDescription(statusCode)}`;
  } else if (statusCode >= 500) {
    suggestion =
      'The webhook endpoint encountered a server error. ' +
      'The request will be retried automatically. ' +
      'If the problem persists, contact the webhook service provider. ' +
      `Status ${statusCode}: ${getStatusCodeDescription(statusCode)}`;
  } else {
    suggestion =
      'An unexpected error occurred. ' +
      'Check the webhook endpoint logs for more details.';
  }

  return new OutputError(
    message,
    'webhook',
    ErrorCode.OUTPUT_WEBHOOK_FAILED,
    details,
    suggestion
  );
}

/**
 * Get human-readable description for HTTP status codes
 */
function getStatusCodeDescription(statusCode: number): string {
  const descriptions: Record<number, string> = {
    400: 'Bad Request - The request was malformed',
    401: 'Unauthorized - Authentication required or failed',
    403: 'Forbidden - Access denied',
    404: 'Not Found - The endpoint does not exist',
    405: 'Method Not Allowed - POST method may not be supported',
    408: 'Request Timeout - The server timed out waiting for the request',
    413: 'Payload Too Large - The request body is too large',
    429: 'Too Many Requests - Rate limit exceeded',
    500: 'Internal Server Error - The server encountered an error',
    502: 'Bad Gateway - Invalid response from upstream server',
    503: 'Service Unavailable - The server is temporarily unavailable',
    504: 'Gateway Timeout - The server timed out waiting for upstream',
  };

  return descriptions[statusCode] || 'Unknown status code';
}

/**
 * Format a generic error with context
 */
export function formatGenericError(
  message: string,
  context?: Record<string, unknown>,
  suggestion?: string
): string {
  let result = message;

  if (context && Object.keys(context).length > 0) {
    result += '\nContext:';
    for (const [key, value] of Object.entries(context)) {
      result += `\n  ${key}: ${JSON.stringify(value)}`;
    }
  }

  if (suggestion) {
    result += `\nSuggestion: ${suggestion}`;
  }

  return result;
}
