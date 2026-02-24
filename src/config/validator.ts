import { existsSync, accessSync, constants } from 'fs';
import { dirname } from 'path';
import { ZodError } from 'zod';
import { dexConfigSchema, configProfileSchema } from './schemas.js';
import type { DexConfig, ConfigProfile, DexStreamOptions, MultiStreamConfig } from '../types.js';

/** Validation error details. */
export interface ValidationError {
  path: string[];
  message: string;
  suggestion?: string;
}

/** Validation result. */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/** ConfigValidator class for validating configuration. */
export class ConfigValidator {
  /**
   * Validate a full configuration object.
   * @param config Configuration to validate
   * @returns Validation result
   */
  static validateConfig(config: unknown): ValidationResult {
    try {
      dexConfigSchema.parse(config);
      
      // Additional custom validations
      const customErrors = this.performCustomValidations(config as DexConfig);
      
      if (customErrors.length > 0) {
        return { valid: false, errors: customErrors };
      }
      
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof ZodError) {
        return {
          valid: false,
          errors: this.formatZodErrors(error),
        };
      }
      throw error;
    }
  }

  /**
   * Validate DexStreamOptions configuration.
   * @param options Stream options to validate
   * @returns Validation result
   */
  static validateStreamOptions(options: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    const opts = options as DexStreamOptions;

    // Validate baseUrl
    if (!opts.baseUrl || !this.validateBaseUrl(opts.baseUrl)) {
      errors.push({
        path: ['baseUrl'],
        message: 'baseUrl is empty or invalid. Must be a valid URL with http://, https://, ws://, or wss:// protocol.',
        suggestion: 'Provide a valid baseUrl before attempting connection. Example: "https://example.com" or "wss://example.com"',
      });
    }

    // Validate pageUrl
    if (!opts.pageUrl || !this.validatePageUrl(opts.pageUrl)) {
      errors.push({
        path: ['pageUrl'],
        message: 'pageUrl is empty or invalid. Must be a valid URL.',
        suggestion: 'Provide a valid pageUrl before attempting connection. Example: "https://dexscreener.com/solana"',
      });
    }

    // Validate apiToken
    if (!opts.apiToken || !this.validateApiToken(opts.apiToken)) {
      errors.push({
        path: ['apiToken'],
        message: 'apiToken is empty. Must be a non-empty string.',
        suggestion: 'Provide a valid API token before attempting connection. Set the APIFY_TOKEN environment variable.',
      });
    }

    // Validate authMode
    if (opts.authMode !== undefined && !this.validateAuthMode(opts.authMode)) {
      errors.push({
        path: ['authMode'],
        message: `authMode is invalid: "${opts.authMode}". Must be one of: 'auto', 'header', 'query', 'both', or undefined.`,
        suggestion: 'Use a valid authMode value. Default is "auto" which tries header authentication first, then falls back to query.',
      });
    }

    // Validate retryMs
    if (opts.retryMs !== undefined && !this.validateRetryMs(opts.retryMs)) {
      errors.push({
        path: ['retryMs'],
        message: `retryMs is invalid: ${opts.retryMs}. Must be a positive integer.`,
        suggestion: 'Provide a positive integer for retryMs. Example: 3000 (3 seconds)',
      });
    }

    // Validate keepAliveMs
    if (opts.keepAliveMs !== undefined && !this.validateKeepAliveMs(opts.keepAliveMs)) {
      errors.push({
        path: ['keepAliveMs'],
        message: `keepAliveMs is invalid: ${opts.keepAliveMs}. Must be an integer.`,
        suggestion: 'Provide an integer for keepAliveMs. Use 0 or negative to disable keep-alive. Example: 120000 (2 minutes)',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate MultiStreamConfig configuration.
   * @param config Multi-stream configuration to validate
   * @returns Validation result
   */
  static validateMultiStreamConfig(config: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    const cfg = config as MultiStreamConfig;

    // Validate baseUrl
    if (!cfg.baseUrl || !this.validateBaseUrl(cfg.baseUrl)) {
      errors.push({
        path: ['baseUrl'],
        message: 'baseUrl is empty or invalid. Must be a valid URL with http://, https://, ws://, or wss:// protocol.',
        suggestion: 'Provide a valid baseUrl before attempting connection. Example: "https://example.com" or "wss://example.com"',
      });
    }

    // Validate apiToken
    if (!cfg.apiToken || !this.validateApiToken(cfg.apiToken)) {
      errors.push({
        path: ['apiToken'],
        message: 'apiToken is empty. Must be a non-empty string.',
        suggestion: 'Provide a valid API token before attempting connection. Set the APIFY_TOKEN environment variable.',
      });
    }

    // Validate authMode
    if (cfg.authMode !== undefined && !this.validateAuthMode(cfg.authMode)) {
      errors.push({
        path: ['authMode'],
        message: `authMode is invalid: "${cfg.authMode}". Must be one of: 'auto', 'header', 'query', 'both', or undefined.`,
        suggestion: 'Use a valid authMode value. Default is "auto" which tries header authentication first, then falls back to query.',
      });
    }

    // Validate streams array
    if (!cfg.streams || !Array.isArray(cfg.streams) || cfg.streams.length === 0) {
      errors.push({
        path: ['streams'],
        message: 'streams is empty or invalid. Must be a non-empty array.',
        suggestion: 'Provide at least one stream configuration. Example: [{ id: "stream1", pageUrl: "https://dexscreener.com/solana" }]',
      });
    } else {
      cfg.streams.forEach((stream, index) => {
        if (!stream.id || stream.id.trim() === '') {
          errors.push({
            path: ['streams', String(index), 'id'],
            message: `Stream ${index} has empty or invalid id.`,
            suggestion: 'Provide a unique id for each stream.',
          });
        }
        if (!stream.pageUrl || !this.validatePageUrl(stream.pageUrl)) {
          errors.push({
            path: ['streams', String(index), 'pageUrl'],
            message: `Stream ${index} has empty or invalid pageUrl.`,
            suggestion: 'Provide a valid pageUrl for each stream. Example: "https://dexscreener.com/solana"',
          });
        }
      });
    }

    // Validate retryMs
    if (cfg.retryMs !== undefined && !this.validateRetryMs(cfg.retryMs)) {
      errors.push({
        path: ['retryMs'],
        message: `retryMs is invalid: ${cfg.retryMs}. Must be a positive integer.`,
        suggestion: 'Provide a positive integer for retryMs. Example: 3000 (3 seconds)',
      });
    }

    // Validate keepAliveMs
    if (cfg.keepAliveMs !== undefined && !this.validateKeepAliveMs(cfg.keepAliveMs)) {
      errors.push({
        path: ['keepAliveMs'],
        message: `keepAliveMs is invalid: ${cfg.keepAliveMs}. Must be an integer.`,
        suggestion: 'Provide an integer for keepAliveMs. Use 0 or negative to disable keep-alive. Example: 120000 (2 minutes)',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate a configuration profile.
   * @param profile Profile to validate
   * @returns Validation result
   */
  static validateProfile(profile: unknown): ValidationResult {
    try {
      configProfileSchema.parse(profile);
      
      // Additional custom validations
      const customErrors = this.performProfileValidations(profile as ConfigProfile);
      
      if (customErrors.length > 0) {
        return { valid: false, errors: customErrors };
      }
      
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof ZodError) {
        return {
          valid: false,
          errors: this.formatZodErrors(error),
        };
      }
      throw error;
    }
  }

  /**
   * Validate URL format.
   * @param url URL to validate
   * @returns True if valid HTTP/HTTPS/WS/WSS URL
   */
  static validateUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Validate baseUrl is non-empty and valid URL format.
   * @param baseUrl Base URL to validate
   * @returns True if valid
   */
  static validateBaseUrl(baseUrl: string): boolean {
    if (!baseUrl || baseUrl.trim() === '') {
      return false;
    }
    return this.validateUrl(baseUrl);
  }

  /**
   * Validate pageUrl is non-empty and valid URL format.
   * @param pageUrl Page URL to validate
   * @returns True if valid
   */
  static validatePageUrl(pageUrl: string): boolean {
    if (!pageUrl || pageUrl.trim() === '') {
      return false;
    }
    return this.validateUrl(pageUrl);
  }

  /**
   * Validate apiToken is non-empty string.
   * @param apiToken API token to validate
   * @returns True if valid
   */
  static validateApiToken(apiToken: string): boolean {
    return apiToken !== undefined && apiToken !== null && apiToken.trim() !== '';
  }

  /**
   * Validate authMode is one of the allowed values.
   * @param authMode Authentication mode to validate
   * @returns True if valid
   */
  static validateAuthMode(authMode: string | undefined): boolean {
    if (authMode === undefined) {
      return true;
    }
    return ['auto', 'header', 'query', 'both'].includes(authMode);
  }

  /**
   * Validate retryMs is a positive integer.
   * @param retryMs Retry milliseconds to validate
   * @returns True if valid
   */
  static validateRetryMs(retryMs: number | undefined): boolean {
    if (retryMs === undefined) {
      return true;
    }
    return Number.isInteger(retryMs) && retryMs > 0;
  }

  /**
   * Validate keepAliveMs is an integer.
   * @param keepAliveMs Keep-alive milliseconds to validate
   * @returns True if valid
   */
  static validateKeepAliveMs(keepAliveMs: number | undefined): boolean {
    if (keepAliveMs === undefined) {
      return true;
    }
    return Number.isInteger(keepAliveMs);
  }

  /**
   * Validate API token format.
   * @param token Token to validate
   * @returns True if valid Apify token format
   */
  static validateToken(token: string): boolean {
    return token.startsWith('apify_api_');
  }

  /**
   * Validate file path is writable.
   * @param filePath File path to validate
   * @returns True if directory exists and is writable
   */
  static validateFilePath(filePath: string): boolean {
    try {
      const dir = dirname(filePath);
      if (!existsSync(dir)) {
        return false;
      }
      accessSync(dir, constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Perform custom validations beyond schema validation.
   * @param config Configuration to validate
   * @returns Array of validation errors
   */
  private static performCustomValidations(config: DexConfig): ValidationError[] {
    const errors: ValidationError[] = [];

    // Validate URLs accept HTTP/HTTPS/WS/WSS protocols
    if (config.baseUrl && !this.validateBaseUrl(config.baseUrl)) {
      errors.push({
        path: ['baseUrl'],
        message: `Invalid or empty baseUrl: ${config.baseUrl}. Must be a valid URL with http://, https://, ws://, or wss:// protocol.`,
        suggestion: 'Use HTTP, HTTPS, WS, or WSS URLs. Example: https://example.com or wss://example.com',
      });
    }

    if (config.pageUrls) {
      config.pageUrls.forEach((url, index) => {
        if (!this.validatePageUrl(url)) {
          errors.push({
            path: ['pageUrls', String(index)],
            message: `Invalid or empty pageUrl: ${url}. Must be a valid URL.`,
            suggestion: 'Use valid URLs. Example: https://example.com/page',
          });
        }
      });
    }

    // Validate API token is non-empty
    if (config.apiToken !== undefined && !this.validateApiToken(config.apiToken)) {
      errors.push({
        path: ['apiToken'],
        message: 'Invalid or empty apiToken. Must be a non-empty string.',
        suggestion: 'Provide a valid API token. Check your APIFY_TOKEN environment variable.',
      });
    }

    // Validate required fields for base config (if not using profiles)
    if (!config.profiles || Object.keys(config.profiles).length === 0) {
      if (!config.baseUrl) {
        errors.push({
          path: ['baseUrl'],
          message: 'Missing required field: baseUrl',
          suggestion: 'Provide a baseUrl in the configuration. Example: "https://api.example.com"',
        });
      }
      if (!config.pageUrls || config.pageUrls.length === 0) {
        errors.push({
          path: ['pageUrls'],
          message: 'Missing required field: pageUrls',
          suggestion: 'Provide at least one pageUrl. Example: ["https://api.example.com/page1"]',
        });
      }
    }

    return errors;
  }

  /**
   * Perform custom validations for a profile.
   * @param profile Profile to validate
   * @returns Array of validation errors
   */
  private static performProfileValidations(profile: ConfigProfile): ValidationError[] {
    const errors: ValidationError[] = [];

    // Validate URLs accept HTTP/HTTPS/WS/WSS protocols
    if (!this.validateBaseUrl(profile.baseUrl)) {
      errors.push({
        path: ['baseUrl'],
        message: `Invalid or empty baseUrl: ${profile.baseUrl}. Must be a valid URL with http://, https://, ws://, or wss:// protocol.`,
        suggestion: 'Use HTTP, HTTPS, WS, or WSS URLs. Example: https://example.com or wss://example.com',
      });
    }

    profile.pageUrls.forEach((url, index) => {
      if (!this.validatePageUrl(url)) {
        errors.push({
          path: ['pageUrls', String(index)],
          message: `Invalid or empty pageUrl: ${url}. Must be a valid URL.`,
          suggestion: 'Use valid URLs. Example: https://example.com/page',
        });
      }
    });

    // Validate API token is non-empty if present
    if (profile.apiToken !== undefined && !this.validateApiToken(profile.apiToken)) {
      errors.push({
        path: ['apiToken'],
        message: 'Invalid or empty apiToken. Must be a non-empty string.',
        suggestion: 'Provide a valid API token. Check your APIFY_TOKEN environment variable.',
      });
    }

    return errors;
  }

  /**
   * Format Zod validation errors into ValidationError format.
   * @param error Zod error
   * @returns Array of formatted validation errors
   */
  private static formatZodErrors(error: ZodError): ValidationError[] {
    return error.errors.map((err) => ({
      path: err.path.map(String),
      message: err.message,
      suggestion: this.getSuggestionForZodError(err),
    }));
  }

  /**
   * Get suggestion for a Zod error.
   * @param error Zod error issue
   * @returns Suggestion string
   */
  private static getSuggestionForZodError(error: any): string | undefined {
    const fieldName = error.path[error.path.length - 1];
    
    switch (error.code) {
      case 'invalid_type':
        return `Field "${fieldName}" should be of type ${error.expected}`;
      case 'too_small':
        return `Field "${fieldName}" should be at least ${error.minimum}`;
      case 'too_big':
        return `Field "${fieldName}" should be at most ${error.maximum}`;
      case 'invalid_enum_value':
        return `Field "${fieldName}" should be one of: ${error.options.join(', ')}`;
      default:
        return undefined;
    }
  }
}
