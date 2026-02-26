import { describe, it, expect } from 'vitest';
import {
  ErrorCode,
  DexScreenerError,
  ConfigurationError,
  ValidationError,
  FilterError,
  TransformError,
  OutputError,
  StreamError,
  sanitizeErrorMessage,
  sanitizeError,
  sanitizeErrorValue,
  createErrorWithContext,
  sanitizeUrl,
  containsSensitiveData,
} from '../src/errors/index.js';
import {
  formatAuthError,
  formatNetworkError,
  formatConfigError,
  formatFileError,
  formatWebhookError,
  formatGenericError,
} from '../src/errors/formatter.js';
import { ConfigValidator } from '../src/config/validator.js';

describe('Error Classes', () => {
  describe('DexScreenerError', () => {
    it('should create error with code and suggestion', () => {
      const error = new DexScreenerError(
        'Test error',
        ErrorCode.CONFIG_NOT_FOUND,
        'Test suggestion'
      );

      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ErrorCode.CONFIG_NOT_FOUND);
      expect(error.suggestion).toBe('Test suggestion');
      expect(error.name).toBe('DexScreenerError');
    });

    it('should format error message with code and suggestion', () => {
      const error = new DexScreenerError(
        'Test error',
        ErrorCode.CONFIG_NOT_FOUND,
        'Test suggestion'
      );

      const formatted = error.toString();
      expect(formatted).toContain('[ERR_1001]');
      expect(formatted).toContain('Test error');
      expect(formatted).toContain('Suggestion: Test suggestion');
    });

    it('should format error message without suggestion', () => {
      const error = new DexScreenerError(
        'Test error',
        ErrorCode.CONFIG_NOT_FOUND
      );

      const formatted = error.toString();
      expect(formatted).toContain('[ERR_1001]');
      expect(formatted).toContain('Test error');
      expect(formatted).not.toContain('Suggestion:');
    });
  });

  describe('ConfigurationError', () => {
    it('should include field in error message', () => {
      const error = new ConfigurationError(
        'Invalid config',
        'baseUrl',
        ErrorCode.CONFIG_INVALID_URL,
        'Use HTTPS'
      );

      const formatted = error.toString();
      expect(formatted).toContain('[ERR_1005]');
      expect(formatted).toContain('Invalid config');
      expect(formatted).toContain("Context: Field 'baseUrl'");
      expect(formatted).toContain('Suggestion: Use HTTPS');
    });
  });

  describe('ValidationError', () => {
    it('should include validation errors in message', () => {
      const error = new ValidationError(
        'Validation failed',
        [
          { path: ['config', 'baseUrl'], message: 'Invalid URL' },
          { path: ['config', 'apiToken'], message: 'Missing token' },
        ],
        ErrorCode.CONFIG_MISSING_REQUIRED,
        'Fix the errors'
      );

      const formatted = error.toString();
      expect(formatted).toContain('[ERR_1004]');
      expect(formatted).toContain('Validation failed');
      expect(formatted).toContain('config.baseUrl: Invalid URL');
      expect(formatted).toContain('config.apiToken: Missing token');
      expect(formatted).toContain('Suggestion: Fix the errors');
    });
  });

  describe('FilterError', () => {
    it('should include filter type in error message', () => {
      const error = new FilterError(
        'Filter failed',
        'chainId',
        ErrorCode.FILTER_INVALID_CONFIG,
        'Check filter config'
      );

      const formatted = error.toString();
      expect(formatted).toContain('[ERR_2001]');
      expect(formatted).toContain('Filter failed');
      expect(formatted).toContain("Context: Filter type 'chainId'");
      expect(formatted).toContain('Suggestion: Check filter config');
    });
  });

  describe('TransformError', () => {
    it('should include field path in error message', () => {
      const error = new TransformError(
        'Transform failed',
        'baseToken.symbol',
        ErrorCode.TRANSFORM_INVALID_FIELD_PATH,
        'Check field path'
      );

      const formatted = error.toString();
      expect(formatted).toContain('[ERR_3002]');
      expect(formatted).toContain('Transform failed');
      expect(formatted).toContain("Context: Field path 'baseToken.symbol'");
      expect(formatted).toContain('Suggestion: Check field path');
    });

    it('should work without field path', () => {
      const error = new TransformError('Transform failed');

      const formatted = error.toString();
      expect(formatted).toContain('[ERR_3003]');
      expect(formatted).toContain('Transform failed');
      expect(formatted).not.toContain('Context:');
    });
  });

  describe('OutputError', () => {
    it('should include output type and details in error message', () => {
      const error = new OutputError(
        'Output failed',
        'webhook',
        ErrorCode.OUTPUT_WEBHOOK_FAILED,
        'Status 500',
        'Retry later'
      );

      const formatted = error.toString();
      expect(formatted).toContain('[ERR_4004]');
      expect(formatted).toContain('Output failed');
      expect(formatted).toContain("Context: Output type 'webhook'");
      expect(formatted).toContain('Status 500');
      expect(formatted).toContain('Suggestion: Retry later');
    });
  });

  describe('StreamError', () => {
    it('should include stream ID and details in error message', () => {
      const error = new StreamError(
        'Stream failed',
        'stream-1',
        ErrorCode.STREAM_CONNECTION_FAILED,
        'Connection timeout',
        'Check network'
      );

      const formatted = error.toString();
      expect(formatted).toContain('[ERR_5002]');
      expect(formatted).toContain('Stream failed');
      expect(formatted).toContain("Context: Stream 'stream-1'");
      expect(formatted).toContain('Connection timeout');
      expect(formatted).toContain('Suggestion: Check network');
    });
  });
});

describe('Error Formatters', () => {
  describe('formatAuthError', () => {
    it('should format auth error with token', () => {
      const error = formatAuthError('invalid_token');

      expect(error.message).toContain('Authentication failed');
      expect(error.code).toBe(ErrorCode.STREAM_AUTH_FAILED);
      expect(error.details).toContain('rejected by the server');
      expect(error.suggestion).toContain('APIFY_TOKEN');
      expect(error.suggestion).toContain('apify_api_');
    });

    it('should format auth error without token', () => {
      const error = formatAuthError();

      expect(error.message).toContain('Authentication failed');
      expect(error.details).toContain('No API token provided');
      expect(error.suggestion).toContain('APIFY_TOKEN');
    });
  });

  describe('formatNetworkError', () => {
    it('should format network error with Error object', () => {
      const error = formatNetworkError(
        'https://example.com',
        new Error('Connection refused')
      );

      expect(error.message).toContain('Network connection failed');
      expect(error.code).toBe(ErrorCode.STREAM_CONNECTION_FAILED);
      expect(error.details).toContain('https://example.com');
      expect(error.details).toContain('Connection refused');
      expect(error.suggestion).toContain('network connectivity');
      expect(error.suggestion).toContain('curl');
    });

    it('should format network error with string', () => {
      const error = formatNetworkError(
        'https://example.com',
        'Timeout'
      );

      expect(error.details).toContain('Timeout');
    });
  });

  describe('formatConfigError', () => {
    it('should format URL config error', () => {
      const error = formatConfigError(
        'baseUrl',
        'Must use HTTPS'
      );

      expect(error.message).toContain('Invalid configuration value');
      expect(error.field).toBe('baseUrl');
      expect(error.code).toBe(ErrorCode.CONFIG_INVALID_URL);
      expect(error.suggestion).toContain('Apify Actor');
      expect(error.suggestion).toContain('apify.actor');
    });

    it('should format token config error', () => {
      const error = formatConfigError(
        'apiToken',
        'Invalid format'
      );

      expect(error.code).toBe(ErrorCode.CONFIG_INVALID_TOKEN);
      expect(error.suggestion).toContain('apify_api_');
      expect(error.suggestion).toContain('console.apify.com');
    });

    it('should format path config error', () => {
      const error = formatConfigError(
        'outputPath',
        'Not writable'
      );

      expect(error.code).toBe(ErrorCode.CONFIG_INVALID_PATH);
      expect(error.suggestion).toContain('directory exists');
      expect(error.suggestion).toContain('writable');
    });

    it('should format profile config error', () => {
      const error = formatConfigError(
        'profile',
        'Profile not found'
      );

      expect(error.code).toBe(ErrorCode.CONFIG_PROFILE_NOT_FOUND);
      expect(error.suggestion).toContain('available profiles');
    });

    it('should format generic config error', () => {
      const error = formatConfigError(
        'someField',
        'Invalid value'
      );

      expect(error.code).toBe(ErrorCode.CONFIG_MISSING_REQUIRED);
      expect(error.suggestion).toContain('someField');
    });
  });

  describe('formatFileError', () => {
    it('should format permission error', () => {
      const error = formatFileError(
        '/var/log/data.jsonl',
        'write',
        new Error('EACCES: permission denied')
      );

      expect(error.message).toContain('File write operation failed');
      expect(error.code).toBe(ErrorCode.OUTPUT_FILE_NOT_WRITABLE);
      expect(error.details).toContain('/var/log/data.jsonl');
      expect(error.details).toContain('EACCES');
      expect(error.suggestion).toContain('chmod');
      expect(error.suggestion).toContain('permissions');
    });

    it('should format file not found error', () => {
      const error = formatFileError(
        '/path/to/file.jsonl',
        'read',
        new Error('ENOENT: no such file or directory')
      );

      expect(error.suggestion).toContain('does not exist');
      expect(error.suggestion).toContain('mkdir');
    });

    it('should format disk full error', () => {
      const error = formatFileError(
        '/data/file.jsonl',
        'write',
        new Error('ENOSPC: no space left on device')
      );

      expect(error.suggestion).toContain('No space left');
      expect(error.suggestion).toContain('df -h');
    });

    it('should format generic file error', () => {
      const error = formatFileError(
        '/data/file.jsonl',
        'create',
        'Unknown error'
      );

      expect(error.suggestion).toContain('file path is correct');
    });
  });

  describe('formatWebhookError', () => {
    it('should format webhook error with status code', () => {
      const error = formatWebhookError(
        'https://webhook.example.com',
        404,
        'Not found'
      );

      expect(error.message).toContain('Webhook request failed');
      expect(error.code).toBe(ErrorCode.OUTPUT_WEBHOOK_FAILED);
      expect(error.details).toContain('https://webhook.example.com');
      expect(error.details).toContain('Status: 404');
      expect(error.details).toContain('Not found');
      expect(error.suggestion).toContain('404');
      expect(error.suggestion).toContain('Not Found');
    });

    it('should format webhook error without status code', () => {
      const error = formatWebhookError('https://webhook.example.com');

      expect(error.suggestion).toContain('could not be reached');
      expect(error.suggestion).toContain('network connectivity');
    });

    it('should format 4xx client error', () => {
      const error = formatWebhookError(
        'https://webhook.example.com',
        401
      );

      expect(error.suggestion).toContain('client error');
      expect(error.suggestion).toContain('authentication');
      expect(error.suggestion).toContain('Unauthorized');
    });

    it('should format 5xx server error', () => {
      const error = formatWebhookError(
        'https://webhook.example.com',
        500
      );

      expect(error.suggestion).toContain('server error');
      expect(error.suggestion).toContain('retried automatically');
      expect(error.suggestion).toContain('Internal Server Error');
    });

    it('should truncate long response bodies', () => {
      const longBody = 'x'.repeat(300);
      const error = formatWebhookError(
        'https://webhook.example.com',
        400,
        longBody
      );

      expect(error.details).toContain('...');
      expect(error.details!.length).toBeLessThan(longBody.length + 100);
    });
  });

  describe('formatGenericError', () => {
    it('should format error with context and suggestion', () => {
      const formatted = formatGenericError(
        'Something went wrong',
        { field: 'value', count: 42 },
        'Try again'
      );

      expect(formatted).toContain('Something went wrong');
      expect(formatted).toContain('Context:');
      expect(formatted).toContain('field: "value"');
      expect(formatted).toContain('count: 42');
      expect(formatted).toContain('Suggestion: Try again');
    });

    it('should format error without context', () => {
      const formatted = formatGenericError(
        'Something went wrong',
        undefined,
        'Try again'
      );

      expect(formatted).toContain('Something went wrong');
      expect(formatted).not.toContain('Context:');
      expect(formatted).toContain('Suggestion: Try again');
    });

    it('should format error without suggestion', () => {
      const formatted = formatGenericError(
        'Something went wrong',
        { field: 'value' }
      );

      expect(formatted).toContain('Something went wrong');
      expect(formatted).toContain('Context:');
      expect(formatted).not.toContain('Suggestion:');
    });
  });
});

describe('Configuration Validation', () => {
  describe('ConfigValidator.validateStreamOptions', () => {
    it('should validate valid stream options', () => {
      
      
      const options = {
        baseUrl: 'https://example.com',
        pageUrl: 'https://dexscreener.com/solana',
        apiToken: 'test-token',
      };

      const result = ConfigValidator.validateStreamOptions(options);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty baseUrl', () => {
      
      
      const options = {
        baseUrl: '',
        pageUrl: 'https://dexscreener.com/solana',
        apiToken: 'test-token',
      };

      const result = ConfigValidator.validateStreamOptions(options);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toEqual(['baseUrl']);
      expect(result.errors[0].message).toContain('empty or invalid');
    });

    it('should reject invalid baseUrl', () => {
      
      
      const options = {
        baseUrl: 'not-a-url',
        pageUrl: 'https://dexscreener.com/solana',
        apiToken: 'test-token',
      };

      const result = ConfigValidator.validateStreamOptions(options);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toEqual(['baseUrl']);
    });

    it('should accept ws:// and wss:// protocols in baseUrl', () => {
      
      
      const wsOptions = {
        baseUrl: 'ws://example.com',
        pageUrl: 'https://dexscreener.com/solana',
        apiToken: 'test-token',
      };

      const wssOptions = {
        baseUrl: 'wss://example.com',
        pageUrl: 'https://dexscreener.com/solana',
        apiToken: 'test-token',
      };

      expect(ConfigValidator.validateStreamOptions(wsOptions).valid).toBe(true);
      expect(ConfigValidator.validateStreamOptions(wssOptions).valid).toBe(true);
    });

    it('should reject empty pageUrl', () => {
      
      
      const options = {
        baseUrl: 'https://example.com',
        pageUrl: '',
        apiToken: 'test-token',
      };

      const result = ConfigValidator.validateStreamOptions(options);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toEqual(['pageUrl']);
      expect(result.errors[0].message).toContain('empty or invalid');
    });

    it('should reject invalid pageUrl', () => {
      
      
      const options = {
        baseUrl: 'https://example.com',
        pageUrl: 'not-a-url',
        apiToken: 'test-token',
      };

      const result = ConfigValidator.validateStreamOptions(options);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toEqual(['pageUrl']);
    });

    it('should reject empty apiToken', () => {
      
      
      const options = {
        baseUrl: 'https://example.com',
        pageUrl: 'https://dexscreener.com/solana',
        apiToken: '',
      };

      const result = ConfigValidator.validateStreamOptions(options);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toEqual(['apiToken']);
      expect(result.errors[0].message).toContain('empty');
    });

    it('should reject invalid authMode', () => {
      
      
      const options = {
        baseUrl: 'https://example.com',
        pageUrl: 'https://dexscreener.com/solana',
        apiToken: 'test-token',
        authMode: 'invalid',
      };

      const result = ConfigValidator.validateStreamOptions(options);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toEqual(['authMode']);
      expect(result.errors[0].message).toContain("'auto', 'header', 'query', 'both'");
    });

    it('should accept valid authMode values', () => {
      
      
      const modes = ['auto', 'header', 'query', 'both'];
      
      modes.forEach(mode => {
        const options = {
          baseUrl: 'https://example.com',
          pageUrl: 'https://dexscreener.com/solana',
          apiToken: 'test-token',
          authMode: mode,
        };

        const result = ConfigValidator.validateStreamOptions(options);
        expect(result.valid).toBe(true);
      });
    });

    it('should accept undefined authMode', () => {
      
      
      const options = {
        baseUrl: 'https://example.com',
        pageUrl: 'https://dexscreener.com/solana',
        apiToken: 'test-token',
        authMode: undefined,
      };

      const result = ConfigValidator.validateStreamOptions(options);
      expect(result.valid).toBe(true);
    });

    it('should reject non-positive retryMs', () => {
      
      
      const options = {
        baseUrl: 'https://example.com',
        pageUrl: 'https://dexscreener.com/solana',
        apiToken: 'test-token',
        retryMs: 0,
      };

      const result = ConfigValidator.validateStreamOptions(options);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toEqual(['retryMs']);
      expect(result.errors[0].message).toContain('positive integer');
    });

    it('should reject non-integer retryMs', () => {
      
      
      const options = {
        baseUrl: 'https://example.com',
        pageUrl: 'https://dexscreener.com/solana',
        apiToken: 'test-token',
        retryMs: 3.5,
      };

      const result = ConfigValidator.validateStreamOptions(options);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toEqual(['retryMs']);
    });

    it('should accept valid retryMs', () => {
      
      
      const options = {
        baseUrl: 'https://example.com',
        pageUrl: 'https://dexscreener.com/solana',
        apiToken: 'test-token',
        retryMs: 3000,
      };

      const result = ConfigValidator.validateStreamOptions(options);
      expect(result.valid).toBe(true);
    });

    it('should reject non-integer keepAliveMs', () => {
      
      
      const options = {
        baseUrl: 'https://example.com',
        pageUrl: 'https://dexscreener.com/solana',
        apiToken: 'test-token',
        keepAliveMs: 120.5,
      };

      const result = ConfigValidator.validateStreamOptions(options);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toEqual(['keepAliveMs']);
      expect(result.errors[0].message).toContain('integer');
    });

    it('should accept valid keepAliveMs including zero and negative', () => {
      
      
      const values = [0, -1, 120000];
      
      values.forEach(value => {
        const options = {
          baseUrl: 'https://example.com',
          pageUrl: 'https://dexscreener.com/solana',
          apiToken: 'test-token',
          keepAliveMs: value,
        };

        const result = ConfigValidator.validateStreamOptions(options);
        expect(result.valid).toBe(true);
      });
    });

    it('should report multiple validation errors', () => {
      
      
      const options = {
        baseUrl: '',
        pageUrl: '',
        apiToken: '',
        authMode: 'invalid',
        retryMs: -1,
      };

      const result = ConfigValidator.validateStreamOptions(options);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('ConfigValidator.validateMultiStreamConfig', () => {
    it('should validate valid multi-stream config', () => {
      
      
      const config = {
        baseUrl: 'https://example.com',
        apiToken: 'test-token',
        streams: [
          { id: 'stream1', pageUrl: 'https://dexscreener.com/solana' },
          { id: 'stream2', pageUrl: 'https://dexscreener.com/ethereum' },
        ],
      };

      const result = ConfigValidator.validateMultiStreamConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty baseUrl', () => {
      
      
      const config = {
        baseUrl: '',
        apiToken: 'test-token',
        streams: [
          { id: 'stream1', pageUrl: 'https://dexscreener.com/solana' },
        ],
      };

      const result = ConfigValidator.validateMultiStreamConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toEqual(['baseUrl']);
    });

    it('should reject empty apiToken', () => {
      
      
      const config = {
        baseUrl: 'https://example.com',
        apiToken: '',
        streams: [
          { id: 'stream1', pageUrl: 'https://dexscreener.com/solana' },
        ],
      };

      const result = ConfigValidator.validateMultiStreamConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toEqual(['apiToken']);
    });

    it('should reject invalid authMode', () => {
      
      
      const config = {
        baseUrl: 'https://example.com',
        apiToken: 'test-token',
        authMode: 'invalid',
        streams: [
          { id: 'stream1', pageUrl: 'https://dexscreener.com/solana' },
        ],
      };

      const result = ConfigValidator.validateMultiStreamConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toEqual(['authMode']);
    });

    it('should accept valid authMode values', () => {
      
      
      const modes = ['auto', 'header', 'query', 'both'];
      
      modes.forEach(mode => {
        const config = {
          baseUrl: 'https://example.com',
          apiToken: 'test-token',
          authMode: mode,
          streams: [
            { id: 'stream1', pageUrl: 'https://dexscreener.com/solana' },
          ],
        };

        const result = ConfigValidator.validateMultiStreamConfig(config);
        expect(result.valid).toBe(true);
      });
    });

    it('should reject empty streams array', () => {
      
      
      const config = {
        baseUrl: 'https://example.com',
        apiToken: 'test-token',
        streams: [],
      };

      const result = ConfigValidator.validateMultiStreamConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toEqual(['streams']);
      expect(result.errors[0].message).toContain('empty');
    });

    it('should reject stream with empty id', () => {
      
      
      const config = {
        baseUrl: 'https://example.com',
        apiToken: 'test-token',
        streams: [
          { id: '', pageUrl: 'https://dexscreener.com/solana' },
        ],
      };

      const result = ConfigValidator.validateMultiStreamConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toEqual(['streams', '0', 'id']);
    });

    it('should reject stream with empty pageUrl', () => {
      
      
      const config = {
        baseUrl: 'https://example.com',
        apiToken: 'test-token',
        streams: [
          { id: 'stream1', pageUrl: '' },
        ],
      };

      const result = ConfigValidator.validateMultiStreamConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toEqual(['streams', '0', 'pageUrl']);
    });

    it('should reject stream with invalid pageUrl', () => {
      
      
      const config = {
        baseUrl: 'https://example.com',
        apiToken: 'test-token',
        streams: [
          { id: 'stream1', pageUrl: 'not-a-url' },
        ],
      };

      const result = ConfigValidator.validateMultiStreamConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toEqual(['streams', '0', 'pageUrl']);
    });

    it('should validate multiple streams correctly', () => {
      
      
      const config = {
        baseUrl: 'https://example.com',
        apiToken: 'test-token',
        streams: [
          { id: 'stream1', pageUrl: 'https://dexscreener.com/solana' },
          { id: '', pageUrl: 'not-a-url' },
          { id: 'stream3', pageUrl: 'https://dexscreener.com/ethereum' },
        ],
      };

      const result = ConfigValidator.validateMultiStreamConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(2);
      expect(result.errors.some(e => e.path.includes('1'))).toBe(true);
    });

    it('should reject non-positive retryMs', () => {
      
      
      const config = {
        baseUrl: 'https://example.com',
        apiToken: 'test-token',
        streams: [
          { id: 'stream1', pageUrl: 'https://dexscreener.com/solana' },
        ],
        retryMs: 0,
      };

      const result = ConfigValidator.validateMultiStreamConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toEqual(['retryMs']);
    });

    it('should reject non-integer keepAliveMs', () => {
      
      
      const config = {
        baseUrl: 'https://example.com',
        apiToken: 'test-token',
        streams: [
          { id: 'stream1', pageUrl: 'https://dexscreener.com/solana' },
        ],
        keepAliveMs: 120.5,
      };

      const result = ConfigValidator.validateMultiStreamConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toEqual(['keepAliveMs']);
    });
  });
});

describe('Error Sanitization', () => {
  describe('sanitizeErrorMessage', () => {
    it('should remove Apify API tokens', () => {
      const message = 'Auth failed with token apify_api_1234567890abcdef';
      const sanitized = sanitizeErrorMessage(message);
      
      expect(sanitized).not.toContain('apify_api_1234567890abcdef');
      expect(sanitized).toContain('[REDACTED]');
    });

    it('should remove Bearer tokens', () => {
      const message = 'Authorization: Bearer abc123xyz789';
      const sanitized = sanitizeErrorMessage(message);
      
      expect(sanitized).not.toContain('abc123xyz789');
      expect(sanitized).toContain('[REDACTED]');
    });

    it('should remove tokens from query parameters', () => {
      const message = 'Failed to connect to wss://example.com?token=secret123&page_url=test';
      const sanitized = sanitizeErrorMessage(message);
      
      expect(sanitized).not.toContain('secret123');
      expect(sanitized).toContain('token=[REDACTED]');
      expect(sanitized).toContain('page_url=test');
    });

    it('should remove tokens from Authorization headers', () => {
      const message = 'Request failed with Authorization: apify_api_secret123';
      const sanitized = sanitizeErrorMessage(message);
      
      expect(sanitized).not.toContain('apify_api_secret123');
      expect(sanitized).toContain('Authorization: [REDACTED]');
    });

    it('should remove long alphanumeric strings that look like tokens', () => {
      const longToken = 'a'.repeat(50);
      const message = `Connection failed with token ${longToken}`;
      const sanitized = sanitizeErrorMessage(message);
      
      expect(sanitized).not.toContain(longToken);
      expect(sanitized).toContain('[REDACTED]');
    });

    it('should handle empty or null messages', () => {
      expect(sanitizeErrorMessage('')).toBe('');
      expect(sanitizeErrorMessage(null as any)).toBe(null);
    });

    it('should not modify messages without sensitive data', () => {
      const message = 'Connection failed: network timeout';
      const sanitized = sanitizeErrorMessage(message);
      
      expect(sanitized).toBe(message);
    });
  });

  describe('sanitizeError', () => {
    it('should sanitize Error object message', () => {
      const error = new Error('Auth failed with token apify_api_secret123');
      const sanitized = sanitizeError(error);
      
      expect(sanitized.message).not.toContain('apify_api_secret123');
      expect(sanitized.message).toContain('[REDACTED]');
      expect(sanitized.name).toBe('Error');
    });

    it('should sanitize Error stack trace', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test with token apify_api_secret123\n  at test.js:1:1';
      const sanitized = sanitizeError(error);
      
      expect(sanitized.stack).not.toContain('apify_api_secret123');
      expect(sanitized.stack).toContain('[REDACTED]');
    });
  });

  describe('sanitizeErrorValue', () => {
    it('should sanitize Error objects', () => {
      const error = new Error('Token: apify_api_secret123');
      const sanitized = sanitizeErrorValue(error);
      
      expect(sanitized).not.toContain('apify_api_secret123');
      expect(sanitized).toContain('[REDACTED]');
    });

    it('should sanitize string errors', () => {
      const error = 'Auth failed with token apify_api_secret123';
      const sanitized = sanitizeErrorValue(error);
      
      expect(sanitized).not.toContain('apify_api_secret123');
      expect(sanitized).toContain('[REDACTED]');
    });

    it('should sanitize object errors', () => {
      const error = { message: 'Token: apify_api_secret123', code: 401 };
      const sanitized = sanitizeErrorValue(error);
      
      expect(sanitized).not.toContain('apify_api_secret123');
      expect(sanitized).toContain('[REDACTED]');
    });

    it('should handle unknown error types', () => {
      const sanitized = sanitizeErrorValue(undefined);
      
      expect(sanitized).toBe('Unknown error');
    });
  });

  describe('createErrorWithContext', () => {
    it('should create error with network context', () => {
      const error = 'Connection timeout';
      const result = createErrorWithContext(error, 'connecting', 'network');
      
      expect(result).toContain('Network error');
      expect(result).toContain('state: connecting');
      expect(result).toContain('Connection timeout');
    });

    it('should create error with auth context', () => {
      const error = 'Invalid token';
      const result = createErrorWithContext(error, 'disconnected', 'auth');
      
      expect(result).toContain('Authentication error');
      expect(result).toContain('state: disconnected');
      expect(result).toContain('Invalid token');
    });

    it('should create error with protocol context', () => {
      const error = 'Invalid JSON';
      const result = createErrorWithContext(error, 'connected', 'protocol');
      
      expect(result).toContain('Protocol error');
      expect(result).toContain('state: connected');
      expect(result).toContain('Invalid JSON');
    });

    it('should sanitize tokens in error context', () => {
      const error = 'Auth failed with token apify_api_secret123';
      const result = createErrorWithContext(error, 'connecting', 'auth');
      
      expect(result).not.toContain('apify_api_secret123');
      expect(result).toContain('[REDACTED]');
    });

    it('should handle unknown error type', () => {
      const error = 'Something went wrong';
      const result = createErrorWithContext(error, 'connected', 'unknown');
      
      expect(result).toContain('Error');
      expect(result).toContain('state: connected');
      expect(result).toContain('Something went wrong');
    });
  });

  describe('sanitizeUrl', () => {
    it('should remove token from query parameters', () => {
      const url = 'wss://example.com/events?token=secret123&page_url=test';
      const sanitized = sanitizeUrl(url);
      
      expect(sanitized).not.toContain('secret123');
      expect(sanitized).toContain('token=[REDACTED]');
      expect(sanitized).toContain('page_url=test');
    });

    it('should handle URLs without tokens', () => {
      const url = 'wss://example.com/events?page_url=test';
      const sanitized = sanitizeUrl(url);
      
      expect(sanitized).toBe(url);
    });

    it('should handle invalid URLs with regex fallback', () => {
      const url = 'not-a-valid-url?token=secret123';
      const sanitized = sanitizeUrl(url);
      
      expect(sanitized).not.toContain('secret123');
      expect(sanitized).toContain('token=[REDACTED]');
    });

    it('should handle empty URLs', () => {
      expect(sanitizeUrl('')).toBe('');
      expect(sanitizeUrl(null as any)).toBe(null);
    });
  });

  describe('containsSensitiveData', () => {
    it('should detect Apify API tokens', () => {
      expect(containsSensitiveData('Token: apify_api_secret123')).toBe(true);
    });

    it('should detect Bearer tokens', () => {
      expect(containsSensitiveData('Authorization: Bearer abc123')).toBe(true);
    });

    it('should detect token query parameters', () => {
      expect(containsSensitiveData('URL: ?token=secret123')).toBe(true);
    });

    it('should detect Authorization headers', () => {
      expect(containsSensitiveData('Authorization: secret123')).toBe(true);
    });

    it('should detect long alphanumeric strings', () => {
      const longToken = 'a'.repeat(50);
      expect(containsSensitiveData(`Token: ${longToken}`)).toBe(true);
    });

    it('should return false for safe messages', () => {
      expect(containsSensitiveData('Connection timeout')).toBe(false);
      expect(containsSensitiveData('Network error')).toBe(false);
      expect(containsSensitiveData('')).toBe(false);
    });
  });
});
