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
} from '../src/errors/index.js';
import {
  formatAuthError,
  formatNetworkError,
  formatConfigError,
  formatFileError,
  formatWebhookError,
  formatGenericError,
} from '../src/errors/formatter.js';

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
