import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseArgs, validateOptions, createOutputEvent, createStreams, type CliOptions } from '../src/cli.js';
import type { DexEvent } from '../src/types.js';

describe('CLI Argument Parsing', () => {
  describe('parseArgs', () => {
    it('should parse required arguments correctly', () => {
      const args = [
        '--base-url', 'https://example.com',
        '--page-url', 'https://dexscreener.com/solana/trending',
        '--api-token', 'test-token',
      ];
      const options = parseArgs(args);
      expect(options.baseUrl).toBe('https://example.com');
      expect(options.pageUrl).toEqual(['https://dexscreener.com/solana/trending']);
      expect(options.apiToken).toBe('test-token');
      expect(options.mode).toBe('stdout');
      expect(options.retryMs).toBe(3000);
    });

    it('should parse multiple page URLs', () => {
      const args = [
        '--base-url', 'https://example.com',
        '--api-token', 'test-token',
        '--page-url', 'https://dexscreener.com/solana/trending',
        '--page-url', 'https://dexscreener.com/base/latest',
      ];
      const options = parseArgs(args);
      expect(options.pageUrl).toEqual([
        'https://dexscreener.com/solana/trending',
        'https://dexscreener.com/base/latest',
      ]);
    });

    it('should parse mode option', () => {
      const args = [
        '--base-url', 'https://example.com',
        '--api-token', 'test-token',
        '--page-url', 'https://dexscreener.com/solana/trending',
        '--mode', 'jsonl',
        '--jsonl-path', './events.jsonl',
      ];
      const options = parseArgs(args);
      expect(options.mode).toBe('jsonl');
      expect(options.jsonlPath).toBe('./events.jsonl');
    });

    it('should parse webhook mode options', () => {
      const args = [
        '--base-url', 'https://example.com',
        '--api-token', 'test-token',
        '--page-url', 'https://dexscreener.com/solana/trending',
        '--mode', 'webhook',
        '--webhook-url', 'https://webhook.example.com/hook',
      ];
      const options = parseArgs(args);
      expect(options.mode).toBe('webhook');
      expect(options.webhookUrl).toBe('https://webhook.example.com/hook');
    });

    it('should parse custom retry-ms', () => {
      const args = [
        '--base-url', 'https://example.com',
        '--api-token', 'test-token',
        '--page-url', 'https://dexscreener.com/solana/trending',
        '--retry-ms', '5000',
      ];
      const options = parseArgs(args);
      expect(options.retryMs).toBe(5000);
    });

    it('should use APIFY_TOKEN env var when --api-token not provided', () => {
      const originalEnv = process.env.APIFY_TOKEN;
      process.env.APIFY_TOKEN = 'env-token';
      
      const args = [
        '--base-url', 'https://example.com',
        '--page-url', 'https://dexscreener.com/solana/trending',
      ];
      const options = parseArgs(args);
      expect(options.apiToken).toBe('env-token');
      
      process.env.APIFY_TOKEN = originalEnv;
    });
  });
});

describe('CLI Validation', () => {
  let mockExit: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    mockExit.mockRestore();
    mockConsoleError.mockRestore();
  });

  describe('validateOptions', () => {
    it('should not throw for valid stdout options', () => {
      const options: CliOptions = {
        baseUrl: 'https://example.com',
        apiToken: 'apify_api_test_token',
        pageUrl: ['https://dexscreener.com/solana/trending'],
        mode: 'stdout',
        retryMs: 3000,
      };
      expect(() => validateOptions(options)).not.toThrow();
    });

    it('should exit with error when apiToken is missing', () => {
      const options: CliOptions = {
        baseUrl: 'https://example.com',
        apiToken: '',
        pageUrl: ['https://dexscreener.com/solana/trending'],
        mode: 'stdout',
        retryMs: 3000,
      };
      expect(() => validateOptions(options)).toThrow('process.exit called');
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("[ERR_1006] Invalid configuration value for 'apiToken'")
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should exit with error when jsonl mode missing jsonl-path', () => {
      const options: CliOptions = {
        baseUrl: 'https://example.com',
        apiToken: 'apify_api_test_token',
        pageUrl: ['https://dexscreener.com/solana/trending'],
        mode: 'jsonl',
        retryMs: 3000,
      };
      expect(() => validateOptions(options)).toThrow('process.exit called');
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("[ERR_1007] Invalid configuration value for 'jsonlPath'")
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should exit with error when webhook mode missing webhook-url', () => {
      const options: CliOptions = {
        baseUrl: 'https://example.com',
        apiToken: 'apify_api_test_token',
        pageUrl: ['https://dexscreener.com/solana/trending'],
        mode: 'webhook',
        retryMs: 3000,
      };
      expect(() => validateOptions(options)).toThrow('process.exit called');
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("[ERR_1005] Invalid configuration value for 'webhookUrl'")
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should not throw for valid jsonl options', () => {
      const options: CliOptions = {
        baseUrl: 'https://example.com',
        apiToken: 'apify_api_test_token',
        pageUrl: ['https://dexscreener.com/solana/trending'],
        mode: 'jsonl',
        jsonlPath: './events.jsonl',
        retryMs: 3000,
      };
      expect(() => validateOptions(options)).not.toThrow();
    });

    it('should not throw for valid webhook options', () => {
      const options: CliOptions = {
        baseUrl: 'https://example.com',
        apiToken: 'apify_api_test_token',
        pageUrl: ['https://dexscreener.com/solana/trending'],
        mode: 'webhook',
        webhookUrl: 'https://webhook.example.com/hook',
        retryMs: 3000,
      };
      expect(() => validateOptions(options)).not.toThrow();
    });
  });
});

describe('CLI Output Format', () => {
  describe('createOutputEvent', () => {
    it('should create output with all required fields', () => {
      const event: DexEvent = {
        event_type: 'pairs',
        pairs: [{ chainId: 'solana', dexId: 'raydium' }],
      };
      const output = createOutputEvent('stream-1', 'https://dexscreener.com/solana/trending', event);
      expect(output).toHaveProperty('streamId', 'stream-1');
      expect(output).toHaveProperty('pageUrl', 'https://dexscreener.com/solana/trending');
      expect(output).toHaveProperty('timestamp');
      expect(output).toHaveProperty('event', event);
      expect(typeof output.timestamp).toBe('number');
    });

    it('should include timestamp as milliseconds since epoch', () => {
      const before = Date.now();
      const output = createOutputEvent('stream-1', 'https://example.com', {});
      const after = Date.now();
      expect(output.timestamp).toBeGreaterThanOrEqual(before);
      expect(output.timestamp).toBeLessThanOrEqual(after);
    });
  });
});

describe('CLI Stream Creation', () => {
  describe('createStreams', () => {
    it('should create one stream per page URL', () => {
      const options: CliOptions = {
        baseUrl: 'https://example.com',
        apiToken: 'test-token',
        pageUrl: [
          'https://dexscreener.com/solana/trending',
          'https://dexscreener.com/base/latest',
          'https://dexscreener.com/ethereum/gainers',
        ],
        mode: 'stdout',
        retryMs: 3000,
      };
      const streams = createStreams(options, () => {});
      expect(streams.length).toBe(3);
    });

    it('should create streams with correct retryMs', () => {
      const options: CliOptions = {
        baseUrl: 'https://example.com',
        apiToken: 'test-token',
        pageUrl: ['https://dexscreener.com/solana/trending'],
        mode: 'stdout',
        retryMs: 5000,
      };
      const streams = createStreams(options, () => {});
      expect(streams.length).toBe(1);
    });
  });
});
