/**
 * Basic SDK Usage Example
 *
 * This example demonstrates how to use the DexScreenerStream class
 * to connect to a single DexScreener page and receive real-time updates.
 *
 * How to run:
 * 1. Build the project first: npm run build
 * 2. Copy .env.example to .env and fill in your credentials:
 *    - APIFY_TOKEN: Your Apify API token from https://apify.com?fpr=muh
 *    - DEX_ACTOR_BASE: Apify Standby Actor URL (e.g., https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor)
 * 3. Run this example: npx tsx examples/basic-sdk.ts
 *
 * Press Ctrl+C to stop the stream.
 */

import 'dotenv/config';
import { DexScreenerStream } from '../src/index.js';

const baseUrl = process.env.DEX_ACTOR_BASE;
const apiToken = process.env.APIFY_TOKEN;

if (!baseUrl) {
  console.error('Error: DEX_ACTOR_BASE environment variable is required');
  console.error('Example: DEX_ACTOR_BASE=https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor');
  process.exit(1);
}

if (!apiToken) {
  console.error('Error: APIFY_TOKEN environment variable is required');
  console.error('Get your token from: https://apify.com?fpr=muh');
  process.exit(1);
}

const pageUrl = 'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc';

const stream = new DexScreenerStream({
  baseUrl,
  apiToken,
  pageUrl,
  streamId: 'solana-trending',
  retryMs: 3000,
  
  onBatch: (event, { streamId }) => {
    console.log(`[${streamId}] Received batch with ${event.pairs?.length ?? 0} pairs`);
    if (event.stats) {
      console.log(`[${streamId}] Stats:`, JSON.stringify(event.stats, null, 2));
    }
  },
  
  onPair: (pair, { streamId }) => {
    const baseSymbol = pair.baseToken?.symbol ?? 'UNKNOWN';
    const quoteSymbol = pair.quoteToken?.symbol ?? 'UNKNOWN';
    const priceUsd = pair.priceUsd ?? 'N/A';
    const volume1h = pair.volume?.h1 ?? 'N/A';
    const change1h = pair.priceChange?.h1 ?? 'N/A';
    
    console.log(
      `[${streamId}] ${pair.chainId}/${pair.dexId} ` +
      `${baseSymbol}/${quoteSymbol} ` +
      `priceUsd=${priceUsd} ` +
      `vol.h1=${volume1h} ` +
      `ch.h1=${change1h}%`
    );
  },
  
  onError: (error, { streamId }) => {
    console.error(`[${streamId}] Stream error:`, error);
  },
  
  onStateChange: (state, { streamId }) => {
    console.log(`[${streamId}] Connection state: ${state}`);
  },
});

console.log('Starting DexScreener stream...');
console.log(`Base URL: ${baseUrl}`);
console.log(`Page URL: ${pageUrl}`);
stream.start();

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  stream.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  stream.stop();
  process.exit(0);
});
