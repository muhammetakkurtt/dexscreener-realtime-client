/**
 * Graceful Shutdown Example
 *
 * This example demonstrates how to implement graceful shutdown
 * handling for DexScreener streams, including cleanup of resources,
 * flushing pending data, and proper signal handling.
 *
 * How to run:
 * 1. Build the project first: npm run build
 * 2. Copy .env.example to .env and fill in your credentials
 * 3. Run this example: npx tsx examples/graceful-shutdown.ts
 *
 * Press Ctrl+C to trigger graceful shutdown.
 */

import 'dotenv/config';
import { DexScreenerStream, DexScreenerMultiStream } from '../src/index.js';
import { writeFileSync, appendFileSync, existsSync } from 'fs';
import { join } from 'path';

const baseUrl = process.env.DEX_ACTOR_BASE;
const apiToken = process.env.APIFY_TOKEN;

if (!baseUrl || !apiToken) {
  console.error('Error: DEX_ACTOR_BASE and APIFY_TOKEN environment variables are required');
  process.exit(1);
}

// Example 1: Basic graceful shutdown with cleanup
console.log('=== Example 1: Basic Graceful Shutdown ===\n');

class GracefulStream {
  private stream: DexScreenerStream;
  private isShuttingDown = false;
  private pendingWrites: Promise<void>[] = [];
  private outputFile = join(process.cwd(), 'stream-output.jsonl');

  constructor() {
    this.stream = new DexScreenerStream({
      baseUrl: baseUrl!,
      apiToken: apiToken!,
      pageUrl: 'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc',
      streamId: 'graceful-stream',
      
      onBatch: (event, { streamId }) => {
        if (this.isShuttingDown) {
          console.log(`[${streamId}] Shutdown in progress, skipping batch`);
          return;
        }

        console.log(`[${streamId}] Processing ${event.pairs?.length ?? 0} pairs`);
        
        // Simulate async write operation
        const writePromise = this.writeToFile(event);
        this.pendingWrites.push(writePromise);
      },
      
      onError: (error, { streamId }) => {
        console.error(`[${streamId}] Error:`, error);
      },
      
      onStateChange: (state, { streamId }) => {
        console.log(`[${streamId}] State: ${state}`);
      },
    });

    // Initialize output file
    if (!existsSync(this.outputFile)) {
      writeFileSync(this.outputFile, '');
    }
  }

  private async writeToFile(event: any): Promise<void> {
    return new Promise((resolve) => {
      // Simulate async write
      setTimeout(() => {
        try {
          appendFileSync(this.outputFile, JSON.stringify(event) + '\n');
          resolve();
        } catch (error) {
          console.error('Write error:', error);
          resolve();
        }
      }, 100);
    });
  }

  start(): void {
    console.log('Starting stream...');
    console.log(`Output file: ${this.outputFile}`);
    this.stream.start();
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      console.log('Shutdown already in progress');
      return;
    }

    console.log('\n🛑 Initiating graceful shutdown...');
    this.isShuttingDown = true;

    // Step 1: Stop accepting new data
    console.log('1. Stopping stream...');
    this.stream.stop();

    // Step 2: Wait for pending writes to complete
    console.log(`2. Waiting for ${this.pendingWrites.length} pending writes...`);
    await Promise.all(this.pendingWrites);
    console.log('   ✓ All writes completed');

    // Step 3: Final cleanup
    console.log('3. Cleanup complete');
    console.log(`   Output saved to: ${this.outputFile}`);
    console.log('✓ Graceful shutdown complete');
  }
}

// Example 2: Multi-stream graceful shutdown
console.log('\n=== Example 2: Multi-Stream Graceful Shutdown ===\n');

class GracefulMultiStream {
  private multiStream: DexScreenerMultiStream;
  private isShuttingDown = false;
  private eventCounts: Map<string, number> = new Map();
  private shutdownTimeout = 5000; // 5 seconds max wait

  constructor() {
    this.multiStream = new DexScreenerMultiStream({
      baseUrl: baseUrl!,
      apiToken: apiToken!,
      streams: [
        { id: 'solana', pageUrl: 'https://dexscreener.com/solana' },
        { id: 'ethereum', pageUrl: 'https://dexscreener.com/ethereum' },
        { id: 'bsc', pageUrl: 'https://dexscreener.com/bsc' },
      ],
      
      onBatch: (event, { streamId }) => {
        if (this.isShuttingDown) return;

        const id = streamId ?? 'unknown';
        const count = this.eventCounts.get(id) || 0;
        this.eventCounts.set(id, count + 1);
        
        console.log(
          `[${id}] Event #${count + 1} | ` +
          `${event.pairs?.length ?? 0} pairs`
        );
      },
      
      onError: (error, { streamId }) => {
        console.error(`[${streamId ?? 'unknown'}] Error:`, error);
      },
      
      onStateChange: (state, { streamId }) => {
        console.log(`[${streamId ?? 'unknown'}] State: ${state}`);
      },
    });
  }

  start(): void {
    console.log('Starting multi-stream...');
    console.log(`Monitoring: ${this.multiStream.getStreamIds().join(', ')}`);
    this.multiStream.startAll();
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;

    console.log('\n🛑 Initiating multi-stream shutdown...');
    this.isShuttingDown = true;

    // Create shutdown timeout
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        console.log(`⚠️  Shutdown timeout (${this.shutdownTimeout}ms) reached`);
        resolve();
      }, this.shutdownTimeout);
    });

    // Stop all streams
    const shutdownPromise = new Promise<void>((resolve) => {
      console.log('Stopping all streams...');
      this.multiStream.stopAll();
      
      // Give streams a moment to close cleanly
      setTimeout(() => {
        resolve();
      }, 1000);
    });

    // Wait for shutdown or timeout
    await Promise.race([shutdownPromise, timeoutPromise]);

    // Print statistics
    console.log('\n📊 Final Statistics:');
    for (const [streamId, count] of this.eventCounts.entries()) {
      console.log(`   ${streamId}: ${count} events processed`);
    }

    console.log('✓ Multi-stream shutdown complete');
  }
}

// Example 3: Shutdown with state persistence
console.log('\n=== Example 3: Shutdown with State Persistence ===\n');

interface StreamState {
  streamId: string;
  lastEventTime: number;
  totalEvents: number;
  totalPairs: number;
}

class StatefulStream {
  private stream: DexScreenerStream;
  private state: StreamState;
  private stateFile = join(process.cwd(), 'stream-state.json');
  private saveInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Load previous state if exists
    this.state = this.loadState();

    this.stream = new DexScreenerStream({
      baseUrl: baseUrl!,
      apiToken: apiToken!,
      pageUrl: 'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc',
      streamId: 'stateful-stream',
      
      onBatch: (event, { streamId }) => {
        this.state.lastEventTime = Date.now();
        this.state.totalEvents++;
        this.state.totalPairs += event.pairs?.length ?? 0;
        
        console.log(
          `[${streamId}] Total: ${this.state.totalEvents} events, ` +
          `${this.state.totalPairs} pairs`
        );
      },
      
      onError: (error, { streamId }) => {
        console.error(`[${streamId}] Error:`, error);
      },
      
      onStateChange: (state, { streamId }) => {
        console.log(`[${streamId}] State: ${state}`);
      },
    });

    // Periodically save state
    this.saveInterval = setInterval(() => {
      this.saveState();
    }, 10000); // Save every 10 seconds
  }

  private loadState(): StreamState {
    try {
      if (existsSync(this.stateFile)) {
        const fs = require('fs');
        const data = JSON.parse(fs.readFileSync(this.stateFile, 'utf-8'));
        console.log('📂 Loaded previous state:', data);
        return data;
      }
    } catch (error) {
      console.log('No previous state found, starting fresh');
    }

    return {
      streamId: 'stateful-stream',
      lastEventTime: 0,
      totalEvents: 0,
      totalPairs: 0,
    };
  }

  private saveState(): void {
    try {
      writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2));
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  }

  start(): void {
    console.log('Starting stateful stream...');
    console.log(`State file: ${this.stateFile}`);
    this.stream.start();
  }

  async shutdown(): Promise<void> {
    console.log('\n🛑 Shutting down with state persistence...');

    // Stop periodic saves
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }

    // Stop stream
    this.stream.stop();

    // Save final state
    console.log('💾 Saving final state...');
    this.saveState();
    console.log('   State saved:', this.state);

    console.log('✓ Stateful shutdown complete');
  }
}

// Choose which example to run
const example = process.argv[2] || '1';

let streamWrapper: GracefulStream | GracefulMultiStream | StatefulStream;

switch (example) {
  case '1':
    console.log('Running Example 1: Basic Graceful Shutdown\n');
    streamWrapper = new GracefulStream();
    break;
  case '2':
    console.log('Running Example 2: Multi-Stream Graceful Shutdown\n');
    streamWrapper = new GracefulMultiStream();
    break;
  case '3':
    console.log('Running Example 3: Shutdown with State Persistence\n');
    streamWrapper = new StatefulStream();
    break;
  default:
    console.error('Invalid example. Use: 1, 2, or 3');
    process.exit(1);
}

streamWrapper.start();

// Handle shutdown signals
const handleShutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}`);
  await streamWrapper.shutdown();
  process.exit(0);
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', async (error) => {
  console.error('Uncaught exception:', error);
  await streamWrapper.shutdown();
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  console.error('Unhandled rejection:', reason);
  await streamWrapper.shutdown();
  process.exit(1);
});
