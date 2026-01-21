import { existsSync, accessSync, constants } from 'fs';
import { dirname } from 'path';
import { ZodError } from 'zod';
import { dexConfigSchema, configProfileSchema } from './schemas.js';
import type { DexConfig, ConfigProfile } from '../types.js';

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
   * @returns True if valid HTTPS URL
   */
  static validateUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:';
    } catch {
      return false;
    }
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

    // Validate URLs are HTTPS
    if (config.baseUrl && !this.validateUrl(config.baseUrl)) {
      errors.push({
        path: ['baseUrl'],
        message: `Invalid URL: ${config.baseUrl}. Must be a valid HTTPS URL.`,
        suggestion: 'Use HTTPS URLs only. Example: https://example.com',
      });
    }

    if (config.pageUrls) {
      config.pageUrls.forEach((url, index) => {
        if (!this.validateUrl(url)) {
          errors.push({
            path: ['pageUrls', String(index)],
            message: `Invalid URL: ${url}. Must be a valid HTTPS URL.`,
            suggestion: 'Use HTTPS URLs only. Example: https://example.com/page',
          });
        }
      });
    }

    // Validate API token format
    if (config.apiToken && !this.validateToken(config.apiToken)) {
      errors.push({
        path: ['apiToken'],
        message: `Invalid API token format: ${config.apiToken}`,
        suggestion: 'API token must start with "apify_api_". Check your APIFY_TOKEN environment variable.',
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

    // Validate URLs are HTTPS
    if (!this.validateUrl(profile.baseUrl)) {
      errors.push({
        path: ['baseUrl'],
        message: `Invalid URL: ${profile.baseUrl}. Must be a valid HTTPS URL.`,
        suggestion: 'Use HTTPS URLs only. Example: https://example.com',
      });
    }

    profile.pageUrls.forEach((url, index) => {
      if (!this.validateUrl(url)) {
        errors.push({
          path: ['pageUrls', String(index)],
          message: `Invalid URL: ${url}. Must be a valid HTTPS URL.`,
          suggestion: 'Use HTTPS URLs only. Example: https://example.com/page',
        });
      }
    });

    // Validate API token format if present
    if (profile.apiToken && !this.validateToken(profile.apiToken)) {
      errors.push({
        path: ['apiToken'],
        message: `Invalid API token format: ${profile.apiToken}`,
        suggestion: 'API token must start with "apify_api_". Check your APIFY_TOKEN environment variable.',
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
