/**
 * Error codes for categorizing and handling errors programmatically
 */
export enum ErrorCode {
  // Configuration Errors (1xxx)
  CONFIG_NOT_FOUND = 'ERR_1001',
  CONFIG_INVALID_JSON = 'ERR_1002',
  CONFIG_INVALID_YAML = 'ERR_1003',
  CONFIG_MISSING_REQUIRED = 'ERR_1004',
  CONFIG_INVALID_URL = 'ERR_1005',
  CONFIG_INVALID_TOKEN = 'ERR_1006',
  CONFIG_INVALID_PATH = 'ERR_1007',
  CONFIG_PROFILE_NOT_FOUND = 'ERR_1008',

  // Filter Errors (2xxx)
  FILTER_INVALID_CONFIG = 'ERR_2001',
  FILTER_INVALID_REGEX = 'ERR_2002',
  FILTER_EXECUTION_FAILED = 'ERR_2003',

  // Transform Errors (3xxx)
  TRANSFORM_INVALID_CONFIG = 'ERR_3001',
  TRANSFORM_INVALID_FIELD_PATH = 'ERR_3002',
  TRANSFORM_EXECUTION_FAILED = 'ERR_3003',

  // Output Errors (4xxx)
  OUTPUT_FILE_NOT_WRITABLE = 'ERR_4001',
  OUTPUT_COMPRESSION_FAILED = 'ERR_4002',
  OUTPUT_ROTATION_FAILED = 'ERR_4003',
  OUTPUT_WEBHOOK_FAILED = 'ERR_4004',

  // Stream Errors (5xxx)
  STREAM_AUTH_FAILED = 'ERR_5001',
  STREAM_CONNECTION_FAILED = 'ERR_5002',
  STREAM_PARSE_FAILED = 'ERR_5003',
}

/**
 * Base error class with error code support
 */
export class DexScreenerError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public suggestion?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Format error message with code and suggestion
   */
  toString(): string {
    let result = `[${this.code}] ${this.message}`;
    if (this.suggestion) {
      result += `\nSuggestion: ${this.suggestion}`;
    }
    return result;
  }
}

/**
 * Configuration-related errors
 */
export class ConfigurationError extends DexScreenerError {
  constructor(
    message: string,
    public field: string,
    code: ErrorCode,
    suggestion?: string
  ) {
    super(message, code, suggestion);
  }

  toString(): string {
    let result = `[${this.code}] ${this.message}`;
    result += `\nContext: Field '${this.field}'`;
    if (this.suggestion) {
      result += `\nSuggestion: ${this.suggestion}`;
    }
    return result;
  }
}

/**
 * Validation errors with detailed field information
 */
export class ValidationError extends DexScreenerError {
  constructor(
    message: string,
    public errors: Array<{ path: string[]; message: string }>,
    code: ErrorCode,
    suggestion?: string
  ) {
    super(message, code, suggestion);
  }

  toString(): string {
    let result = `[${this.code}] ${this.message}`;
    if (this.errors.length > 0) {
      result += '\nValidation errors:';
      for (const error of this.errors) {
        const path = error.path.join('.');
        result += `\n  - ${path}: ${error.message}`;
      }
    }
    if (this.suggestion) {
      result += `\nSuggestion: ${this.suggestion}`;
    }
    return result;
  }
}

/**
 * Filter-related errors
 */
export class FilterError extends DexScreenerError {
  constructor(
    message: string,
    public filterType: string,
    code: ErrorCode,
    suggestion?: string
  ) {
    super(message, code, suggestion);
  }

  toString(): string {
    let result = `[${this.code}] ${this.message}`;
    result += `\nContext: Filter type '${this.filterType}'`;
    if (this.suggestion) {
      result += `\nSuggestion: ${this.suggestion}`;
    }
    return result;
  }
}

/**
 * Transform-related errors
 */
export class TransformError extends DexScreenerError {
  constructor(
    message: string,
    public fieldPath?: string,
    code?: ErrorCode,
    suggestion?: string
  ) {
    super(message, code || ErrorCode.TRANSFORM_EXECUTION_FAILED, suggestion);
  }

  toString(): string {
    let result = `[${this.code}] ${this.message}`;
    if (this.fieldPath) {
      result += `\nContext: Field path '${this.fieldPath}'`;
    }
    if (this.suggestion) {
      result += `\nSuggestion: ${this.suggestion}`;
    }
    return result;
  }
}

/**
 * Output-related errors
 */
export class OutputError extends DexScreenerError {
  constructor(
    message: string,
    public outputType: string,
    code: ErrorCode,
    public details?: string,
    suggestion?: string
  ) {
    super(message, code, suggestion);
  }

  toString(): string {
    let result = `[${this.code}] ${this.message}`;
    result += `\nContext: Output type '${this.outputType}'`;
    if (this.details) {
      result += `, ${this.details}`;
    }
    if (this.suggestion) {
      result += `\nSuggestion: ${this.suggestion}`;
    }
    return result;
  }
}

/**
 * Stream-related errors
 */
export class StreamError extends DexScreenerError {
  constructor(
    message: string,
    public streamId: string,
    code: ErrorCode,
    public details?: string,
    suggestion?: string
  ) {
    super(message, code, suggestion);
  }

  toString(): string {
    let result = `[${this.code}] ${this.message}`;
    result += `\nContext: Stream '${this.streamId}'`;
    if (this.details) {
      result += `, ${this.details}`;
    }
    if (this.suggestion) {
      result += `\nSuggestion: ${this.suggestion}`;
    }
    return result;
  }
}
