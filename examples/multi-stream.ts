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
  console.error('Get your token from: https://console.apify.com/settings/integrations?fpr=muh');
  process.exit(1);
}

const multi = new DexScreenerMultiStream({
  baseUrl,
  apiToken,
  retryMs: 3000,
  
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
  
  onBatch: (event, { streamId }) => {
    console.log(`[${streamId}] Received batch with ${event.pairs?.length ?? 0} pairs`);
  },
  
  onPair: (pair, { streamId }) => {
    const baseSymbol = pair.baseToken?.symbol ?? 'UNKNOWN';
    const quoteSymbol = pair.quoteToken?.symbol ?? 'UNKNOWN';
    const priceUsd = pair.priceUsd ?? 'N/A';
    
    console.log(
      `[${streamId}] ${baseSymbol}/${quoteSymbol} priceUsd=${priceUsd}`
    );
  },
  
  onError: (error, { streamId }) => {
    console.error(`[${streamId}] Stream error:`, error);
  },
  
  onStateChange: (state, { streamId }) => {
    console.log(`[${streamId}] Connection state: ${state}`);
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
