/**
 * Custom Retry Logic Example
 *
 * This example demonstrates how to implement custom retry logic
 * with exponential backoff, maximum retry attempts, and custom
 * error handling strategies.
 *
 * How to run:
 * 1. Build the project first: npm run build
 * 2. Copy .env.example to .env and fill in your credentials
 * 3. Run this example: npx tsx examples/custom-retry.ts
 *
 * Press Ctrl+C to stop the stream.
 */

import 'dotenv/config';
import { DexScreenerStream } from '../src/index.js';
import type { ConnectionState } from '../src/index.js';

const baseUrl = process.env.DEX_ACTOR_BASE;
const apiToken = process.env.APIFY_TOKEN;

if (!baseUrl || !apiToken) {
  console.error('Error: DEX_ACTOR_BASE and APIFY_TOKEN environment variables are required');
  process.exit(1);
}

const pageUrl = 'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc';

// Example 1: Exponential backoff with maximum retries
console.log('=== Example 1: Exponential Backoff ===\n');

class ExponentialBackoffStream {
  private stream: DexScreenerStream;
  private retryCount = 0;
  private maxRetries = 5;
  private baseRetryMs = 1000;
  private maxRetryMs = 30000;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.stream = new DexScreenerStream({
      baseUrl: baseUrl!,
      apiToken: apiToken!,
      pageUrl,
      streamId: 'exponential-backoff',
      retryMs: 0, // Disable built-in retry, we'll handle it
      
      onBatch: (event, { streamId }) => {
        // Reset retry count on successful connection
        this.retryCount = 0;
        console.log(`[${streamId}] ✓ Received ${event.pairs?.length ?? 0} pairs`);
      },
      
      onError: (error, { streamId }) => {
        console.error(`[${streamId}] ✗ Error:`, error);
        this.handleRetry();
      },
      
      onStateChange: (state, { streamId }) => {
        console.log(`[${streamId}] State: ${state}`);
        
        if (state === 'connected') {
          console.log(`[${streamId}] ✓ Connected successfully`);
          this.retryCount = 0;
        }
      },
    });
  }

  private handleRetry(): void {
    if (this.retryCount >= this.maxRetries) {
      console.error(`Max retries (${this.maxRetries}) reached. Giving up.`);
      this.stream.stop();
      return;
    }

    this.retryCount++;
    
    // Calculate exponential backoff: baseRetryMs * 2^(retryCount - 1)
    const retryDelay = Math.min(
      this.baseRetryMs * Math.pow(2, this.retryCount - 1),
      this.maxRetryMs
    );

    console.log(
      `Retry attempt ${this.retryCount}/${this.maxRetries} ` +
      `in ${retryDelay}ms...`
    );

    this.reconnectTimer = setTimeout(() => {
      this.stream.start();
    }, retryDelay);
  }

  start(): void {
    this.retryCount = 0;
    this.stream.start();
  }

  stop(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stream.stop();
  }
}

// Example 2: Circuit breaker pattern
console.log('\n=== Example 2: Circuit Breaker Pattern ===\n');

type CircuitState = 'closed' | 'open' | 'half-open';

class CircuitBreakerStream {
  private stream: DexScreenerStream;
  private circuitState: CircuitState = 'closed';
  private failureCount = 0;
  private failureThreshold = 3;
  private resetTimeout = 60000; // 1 minute
  private resetTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.stream = new DexScreenerStream({
      baseUrl: baseUrl!,
      apiToken: apiToken!,
      pageUrl,
      streamId: 'circuit-breaker',
      retryMs: 5000,
      
      onBatch: (event, { streamId }) => {
        // Reset on successful data
        this.onSuccess();
        console.log(`[${streamId}] ✓ Received ${event.pairs?.length ?? 0} pairs`);
      },
      
      onError: (error, { streamId }) => {
        console.error(`[${streamId}] ✗ Error:`, error);
        this.onFailure();
      },
      
      onStateChange: (state, { streamId }) => {
        console.log(`[${streamId}] State: ${state} | Circuit: ${this.circuitState}`);
      },
    });
  }

  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.circuitState === 'half-open') {
      console.log('Circuit breaker: half-open → closed (recovered)');
      this.circuitState = 'closed';
    }
  }

  private onFailure(): void {
    this.failureCount++;

    if (this.circuitState === 'closed' && this.failureCount >= this.failureThreshold) {
      console.log(`Circuit breaker: closed → open (${this.failureCount} failures)`);
      this.circuitState = 'open';
      this.stream.stop();
      this.scheduleReset();
    } else if (this.circuitState === 'half-open') {
      console.log('Circuit breaker: half-open → open (still failing)');
      this.circuitState = 'open';
      this.stream.stop();
      this.scheduleReset();
    }
  }

  private scheduleReset(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }

    console.log(`Circuit breaker: will attempt reset in ${this.resetTimeout}ms`);
    
    this.resetTimer = setTimeout(() => {
      console.log('Circuit breaker: open → half-open (testing)');
      this.circuitState = 'half-open';
      this.failureCount = 0;
      this.stream.start();
    }, this.resetTimeout);
  }

  start(): void {
    if (this.circuitState === 'open') {
      console.log('Circuit breaker is OPEN - not starting stream');
      return;
    }
    
    this.stream.start();
  }

  stop(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
    this.stream.stop();
  }
}

// Example 3: Jittered retry to avoid thundering herd
console.log('\n=== Example 3: Jittered Retry ===\n');

class JitteredRetryStream {
  private stream: DexScreenerStream;
  private retryCount = 0;
  private maxRetries = 10;
  private baseRetryMs = 2000;

  constructor() {
    this.stream = new DexScreenerStream({
      baseUrl: baseUrl!,
      apiToken: apiToken!,
      pageUrl,
      streamId: 'jittered-retry',
      retryMs: 0, // We'll handle retry
      
      onBatch: (event, { streamId }) => {
        this.retryCount = 0;
        console.log(`[${streamId}] ✓ Received ${event.pairs?.length ?? 0} pairs`);
      },
      
      onError: (error, { streamId }) => {
        console.error(`[${streamId}] ✗ Error:`, error);
        this.handleJitteredRetry();
      },
      
      onStateChange: (state, { streamId }) => {
        console.log(`[${streamId}] State: ${state}`);
      },
    });
  }

  private handleJitteredRetry(): void {
    if (this.retryCount >= this.maxRetries) {
      console.error(`Max retries reached. Stopping.`);
      this.stream.stop();
      return;
    }

    this.retryCount++;
    
    // Add random jitter: baseRetryMs ± 50%
    const jitter = this.baseRetryMs * (0.5 + Math.random());
    const retryDelay = this.baseRetryMs + jitter;

    console.log(
      `Retry ${this.retryCount}/${this.maxRetries} ` +
      `in ${retryDelay.toFixed(0)}ms (with jitter)`
    );

    setTimeout(() => {
      this.stream.start();
    }, retryDelay);
  }

  start(): void {
    this.retryCount = 0;
    this.stream.start();
  }

  stop(): void {
    this.stream.stop();
  }
}

// Choose which example to run
const example = process.argv[2] || '1';

let streamWrapper: ExponentialBackoffStream | CircuitBreakerStream | JitteredRetryStream;

switch (example) {
  case '1':
    console.log('Running Example 1: Exponential Backoff\n');
    streamWrapper = new ExponentialBackoffStream();
    break;
  case '2':
    console.log('Running Example 2: Circuit Breaker\n');
    streamWrapper = new CircuitBreakerStream();
    break;
  case '3':
    console.log('Running Example 3: Jittered Retry\n');
    streamWrapper = new JitteredRetryStream();
    break;
  default:
    console.error('Invalid example. Use: 1, 2, or 3');
    process.exit(1);
}

streamWrapper.start();

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  streamWrapper.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  streamWrapper.stop();
  process.exit(0);
});
