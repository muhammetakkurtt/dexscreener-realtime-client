/**
 * Multi-Stream Usage Example
 *
 * This example demonstrates how to use the DexScreenerMultiStream class
 * to monitor multiple DexScreener pages simultaneously (e.g., Solana trending,
 * Base latest, BSC boosted) with a single client instance.
 *
 * How to run:
 * 1. Build the project first: npm run build
 * 2. Copy .env.example to .env and fill in your credentials:
 *    - APIFY_TOKEN: Your Apify API token from https://console.apify.com/settings/integrations?fpr=muh
 *    - DEX_ACTOR_BASE: Apify Standby Actor URL (e.g., https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor)
 * 3. Run this example: npx tsx examples/multi-stream.ts
 *
 * Press Ctrl+C to stop all streams.
 */

import 'dotenv/config';
import { DexScreenerMultiStream } from '../src/index.js';

const baseUrl = process.env.DEX_ACTOR_BASE;
const apiToken = process.env.APIFY_TOKEN;

if (!baseUrl) {
  console.error('Error: DEX_ACTOR_BASE environment variable is required');
  console.error('Example: DEX_ACTOR_BASE=https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor');
  process.exit(1);
}

if (!apiToken) {
  console.error('Error: APIFY_TOKEN environment variable is required');
  console.error('Get your token from: https://console.apify.com/settings/integrations?fpr=muh?fpr=muh');
  process.exit(1);
}

const multi = new DexScreenerMultiStream({
  baseUrl,
  apiToken,
  retryMs: 3000,
  keepAliveMs: 120000, // Keep connections alive
  
  streams: [
    {
      id: 'solana-trending',
      pageUrl: 'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc',
    },
    {
      id: 'base-latest',
      pageUrl: 'https://dexscreener.com/base?rankBy=trendingScoreH6&order=desc&minLiq=30000',
    },
    {
      id: 'ethereum-volume',
      pageUrl: 'https://dexscreener.com/ethereum?rankBy=volume&order=desc',
    },
  ],
  
  // Called when any stream receives a batch
  onBatch: (event, { streamId }) => {
    console.log(`[${streamId}] Received batch with ${event.pairs?.length ?? 0} pairs`);
    
    // You can handle different streams differently
    if (streamId === 'solana-trending' && event.stats) {
      console.log(`[${streamId}] Solana stats:`, event.stats);
    }
  },
  
  // Called for each pair from any stream
  onPair: (pair, { streamId }) => {
    const baseSymbol = pair.baseToken?.symbol ?? 'UNKNOWN';
    const quoteSymbol = pair.quoteToken?.symbol ?? 'UNKNOWN';
    const priceUsd = pair.priceUsd ?? 'N/A';
    const volume24h = pair.volume?.h24 ?? 'N/A';
    
    console.log(
      `[${streamId}] ${baseSymbol}/${quoteSymbol} ` +
      `price=$${priceUsd} vol24h=$${volume24h}`
    );
  },
  
  // Called when any stream encounters an error
  onError: (error, { streamId }) => {
    console.error(`[${streamId}] Stream error:`, error);
    
    // Handle errors per stream
    if (error instanceof Error) {
      if (error.message.includes('Authentication')) {
        console.error(`[${streamId}] ⚠️  Authentication failed - check APIFY_TOKEN`);
        // Could stop just this stream: multi.getStream(streamId)?.stop();
      } else if (error.message.includes('Network')) {
        console.error(`[${streamId}] ⚠️  Network error - will retry automatically`);
      } else {
        console.error(`[${streamId}] ⚠️  Unexpected error:`, error.message);
      }
    }
  },
  
  // Called when any stream's connection state changes
  onStateChange: (state, { streamId }) => {
    const stateEmoji = {
      disconnected: '⚫',
      connecting: '🟡',
      connected: '🟢',
      reconnecting: '🟠',
    };
    
    console.log(`[${streamId}] ${stateEmoji[state]} State: ${state}`);
    
    // Track overall health
    const allStreams = multi.getStreamIds();
    const connectedCount = allStreams.filter(id => {
      const stream = multi.getStream(id);
      return stream?.getState() === 'connected';
    }).length;
    
    console.log(`Overall: ${connectedCount}/${allStreams.length} streams connected`);
  },
});

console.log('Starting multi-stream DexScreener client...');
console.log(`Base URL: ${baseUrl}`);
console.log(`Streams: ${multi.getStreamIds().join(', ')}`);
multi.startAll();

process.on('SIGINT', () => {
  console.log('\nShutting down all streams...');
  multi.stopAll();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down all streams...');
  multi.stopAll();
  process.exit(0);
});
