/**
 * Filtering Example
 *
 * This example demonstrates how to use the filtering API to select
 * specific trading pairs based on criteria like chain, liquidity,
 * volume, price change, and token symbol.
 *
 * How to run:
 * 1. Build the project first: npm run build
 * 2. Copy .env.example to .env and fill in your credentials
 * 3. Run this example: npx tsx examples/filtering.ts
 *
 * Press Ctrl+C to stop the stream.
 */

import 'dotenv/config';
import { DexScreenerStream, FilterBuilder, createFilter } from '../src/index.js';
import type { FilterConfig } from '../src/index.js';

const baseUrl = process.env.DEX_ACTOR_BASE;
const apiToken = process.env.APIFY_TOKEN;

if (!baseUrl || !apiToken) {
  console.error('Error: DEX_ACTOR_BASE and APIFY_TOKEN environment variables are required');
  process.exit(1);
}

const pageUrl = 'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc';

// Example 1: Using FilterBuilder for programmatic filtering
console.log('=== Example 1: Using FilterBuilder ===\n');

const liquidityFilter = FilterBuilder.liquidityFilter(50000); // Min $50k liquidity
const volumeFilter = FilterBuilder.volumeFilter('h1', 10000); // Min $10k volume in last hour
const priceChangeFilter = FilterBuilder.priceChangeFilter('h1', 5); // Min 5% price change in last hour

const combinedFilter = FilterBuilder.combineFilters(
  [liquidityFilter, volumeFilter, priceChangeFilter],
  'AND'
);

const stream1 = new DexScreenerStream({
  baseUrl,
  apiToken,
  pageUrl,
  streamId: 'filtered-stream',
  
  onBatch: (event, { streamId }) => {
    // Filter pairs before processing
    const filteredPairs = event.pairs?.filter(pair => 
      combinedFilter({ pair, event, streamId: streamId ?? 'unknown' })
    ) ?? [];
    
    console.log(`[${streamId}] Received ${event.pairs?.length ?? 0} pairs, ${filteredPairs.length} passed filters`);
    
    // Process only filtered pairs
    for (const pair of filteredPairs) {
      const symbol = `${pair.baseToken?.symbol}/${pair.quoteToken?.symbol}`;
      const liquidity = pair.liquidity?.usd?.toFixed(0) ?? 'N/A';
      const volume = pair.volume?.h1?.toFixed(0) ?? 'N/A';
      const change = pair.priceChange?.h1?.toFixed(2) ?? 'N/A';
      
      console.log(
        `  ✓ ${symbol} | ` +
        `Liq: $${liquidity} | ` +
        `Vol(1h): $${volume} | ` +
        `Change(1h): ${change}%`
      );
    }
  },
  
  onError: (error, { streamId }) => {
    console.error(`[${streamId}] Error:`, error);
  },
  
  onStateChange: (state, { streamId }) => {
    console.log(`[${streamId}] State: ${state}`);
  },
});

// Example 2: Using createFilter with configuration objects
console.log('\n=== Example 2: Using createFilter with config ===\n');

const filterConfigs: FilterConfig[] = [
  {
    type: 'chain',
    params: { chains: ['solana', 'ethereum'] }
  },
  {
    type: 'liquidity',
    params: { minUsd: 100000 } // Min $100k liquidity
  },
  {
    type: 'symbol',
    params: { pattern: '^(SOL|ETH|USDC|USDT)$' } // Only major tokens
  }
];

// Create individual filters and combine them
const configFilter = FilterBuilder.combineFilters(
  filterConfigs.map(config => FilterBuilder.createFilter(config)),
  'AND'
);

const stream2 = new DexScreenerStream({
  baseUrl,
  apiToken,
  pageUrl: 'https://dexscreener.com/?rankBy=volume&order=desc',
  streamId: 'config-filtered-stream',
  
  onBatch: (event, { streamId }) => {
    const filteredPairs = event.pairs?.filter(pair => 
      configFilter({ pair, event, streamId: streamId ?? 'unknown' })
    ) ?? [];
    
    if (filteredPairs.length > 0) {
      console.log(`[${streamId}] Found ${filteredPairs.length} high-liquidity major token pairs`);
      
      for (const pair of filteredPairs) {
        const symbol = `${pair.baseToken?.symbol}/${pair.quoteToken?.symbol}`;
        const chain = pair.chainId ?? 'unknown';
        const liquidity = pair.liquidity?.usd?.toFixed(0) ?? 'N/A';
        
        console.log(`  ✓ ${chain.toUpperCase()}: ${symbol} | Liq: $${liquidity}`);
      }
    }
  },
  
  onError: (error, { streamId }) => {
    console.error(`[${streamId}] Error:`, error);
  },
});

// Example 3: Chain-specific filtering
console.log('\n=== Example 3: Chain-specific filtering ===\n');

const solanaOnlyFilter = FilterBuilder.chainFilter(['solana']);

const stream3 = new DexScreenerStream({
  baseUrl,
  apiToken,
  pageUrl: 'https://dexscreener.com/?rankBy=trendingScoreH6&order=desc',
  streamId: 'solana-only',
  
  onBatch: (event, { streamId }) => {
    const solanaPairs = event.pairs?.filter(pair => 
      solanaOnlyFilter({ pair, event, streamId: streamId ?? 'unknown' })
    ) ?? [];
    
    console.log(`[${streamId}] Solana pairs: ${solanaPairs.length}/${event.pairs?.length ?? 0}`);
  },
  
  onError: (error, { streamId }) => {
    console.error(`[${streamId}] Error:`, error);
  },
});

// Example 4: Symbol pattern matching with regex
console.log('\n=== Example 4: Symbol pattern matching ===\n');

const memeTokenFilter = FilterBuilder.symbolFilter(/^(PEPE|DOGE|SHIB|BONK)/i);

const stream4 = new DexScreenerStream({
  baseUrl,
  apiToken,
  pageUrl,
  streamId: 'meme-tokens',
  
  onBatch: (event, { streamId }) => {
    const memeTokens = event.pairs?.filter(pair => 
      memeTokenFilter({ pair, event, streamId: streamId ?? 'unknown' })
    ) ?? [];
    
    if (memeTokens.length > 0) {
      console.log(`[${streamId}] Found ${memeTokens.length} meme tokens`);
      
      for (const pair of memeTokens) {
        const symbol = pair.baseToken?.symbol ?? 'UNKNOWN';
        const priceUsd = pair.priceUsd ?? 'N/A';
        const change24h = pair.priceChange?.h24?.toFixed(2) ?? 'N/A';
        
        console.log(`  🐕 ${symbol} | Price: $${priceUsd} | 24h: ${change24h}%`);
      }
    }
  },
  
  onError: (error, { streamId }) => {
    console.error(`[${streamId}] Error:`, error);
  },
});

// Start the stream you want to test (uncomment one)
console.log('\nStarting filtered stream...');
stream1.start(); // High liquidity + volume + price change
// stream2.start(); // Major tokens on Solana/Ethereum
// stream3.start(); // Solana only
// stream4.start(); // Meme tokens

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  stream1.stop();
  stream2.stop();
  stream3.stop();
  stream4.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  stream1.stop();
  stream2.stop();
  stream3.stop();
  stream4.stop();
  process.exit(0);
});
