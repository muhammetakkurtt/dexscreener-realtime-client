/**
 * Transformation Example
 *
 * This example demonstrates how to use the transformation API to
 * select specific fields from trading pairs and reshape the data
 * structure for your application needs.
 *
 * How to run:
 * 1. Build the project first: npm run build
 * 2. Copy .env.example to .env and fill in your credentials
 * 3. Run this example: npx tsx examples/transformation.ts
 *
 * Press Ctrl+C to stop the stream.
 */

import 'dotenv/config';
import { DexScreenerStream, Transformer, createTransformer } from '../src/index.js';
import type { TransformConfig } from '../src/index.js';

const baseUrl = process.env.DEX_ACTOR_BASE;
const apiToken = process.env.APIFY_TOKEN;

if (!baseUrl || !apiToken) {
  console.error('Error: DEX_ACTOR_BASE and APIFY_TOKEN environment variables are required');
  process.exit(1);
}

const pageUrl = 'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc';

// Example 1: Field selection - extract only essential fields
console.log('=== Example 1: Field Selection ===\n');

const essentialFieldsConfig: TransformConfig = {
  fields: [
    'chainId',
    'dexId',
    'pairAddress',
    'baseToken.symbol',
    'quoteToken.symbol',
    'priceUsd',
    'volume.h24',
    'priceChange.h24',
    'liquidity.usd'
  ]
};

const essentialTransformer = new Transformer(essentialFieldsConfig);

const stream1 = new DexScreenerStream({
  baseUrl,
  apiToken,
  pageUrl,
  streamId: 'essential-fields',
  
  onBatch: (event, { streamId }) => {
    console.log(`[${streamId}] Received ${event.pairs?.length ?? 0} pairs`);
    
    if (event.pairs && event.pairs.length > 0) {
      // Transform first pair as example
      const transformed = essentialTransformer.transform(event.pairs[0]);
      console.log('Transformed pair (essential fields only):');
      console.log(JSON.stringify(transformed, null, 2));
      console.log('');
    }
  },
  
  onError: (error, { streamId }) => {
    console.error(`[${streamId}] Error:`, error);
  },
  
  onStateChange: (state, { streamId }) => {
    console.log(`[${streamId}] State: ${state}`);
  },
});

// Example 2: Field aliasing - rename fields for your application
console.log('\n=== Example 2: Field Aliasing ===\n');

const aliasedConfig: TransformConfig = {
  fields: [
    'chainId',
    'baseToken.symbol',
    'quoteToken.symbol',
    'priceUsd',
    'volume.h24',
    'priceChange.h24'
  ],
  aliases: {
    'chainId': 'chain',
    'baseToken.symbol': 'base',
    'quoteToken.symbol': 'quote',
    'priceUsd': 'price',
    'volume.h24': 'volume24h',
    'priceChange.h24': 'change24h'
  }
};

const aliasedTransformer = new Transformer(aliasedConfig);

const stream2 = new DexScreenerStream({
  baseUrl,
  apiToken,
  pageUrl,
  streamId: 'aliased-fields',
  
  onBatch: (event, { streamId }) => {
    if (event.pairs && event.pairs.length > 0) {
      const transformed = aliasedTransformer.transform(event.pairs[0]);
      console.log(`[${streamId}] Transformed with aliases:`);
      console.log(JSON.stringify(transformed, null, 2));
      console.log('');
    }
  },
  
  onError: (error, { streamId }) => {
    console.error(`[${streamId}] Error:`, error);
  },
});

// Example 3: Batch transformation - transform all pairs efficiently
console.log('\n=== Example 3: Batch Transformation ===\n');

const batchConfig: TransformConfig = {
  fields: [
    'baseToken.symbol',
    'priceUsd',
    'priceChange.h1',
    'volume.h1'
  ],
  aliases: {
    'baseToken.symbol': 'symbol',
    'priceUsd': 'price',
    'priceChange.h1': 'change1h',
    'volume.h1': 'volume1h'
  }
};

const batchTransformer = new Transformer(batchConfig);

const stream3 = new DexScreenerStream({
  baseUrl,
  apiToken,
  pageUrl,
  streamId: 'batch-transform',
  
  onBatch: (event, { streamId }) => {
    if (event.pairs && event.pairs.length > 0) {
      // Transform all pairs at once
      const transformedPairs = batchTransformer.transformBatch(event.pairs);
      
      console.log(`[${streamId}] Transformed ${transformedPairs.length} pairs:`);
      
      // Display first 5 transformed pairs
      transformedPairs.slice(0, 5).forEach((pair, index) => {
        console.log(`  ${index + 1}. ${JSON.stringify(pair)}`);
      });
      
      if (transformedPairs.length > 5) {
        console.log(`  ... and ${transformedPairs.length - 5} more`);
      }
      console.log('');
    }
  },
  
  onError: (error, { streamId }) => {
    console.error(`[${streamId}] Error:`, error);
  },
});

// Example 4: Using createTransformer helper function
console.log('\n=== Example 4: Using createTransformer ===\n');

const simpleTransformer = createTransformer({
  fields: ['baseToken.symbol', 'quoteToken.symbol', 'priceUsd'],
  aliases: {
    'baseToken.symbol': 'base',
    'quoteToken.symbol': 'quote',
    'priceUsd': 'price'
  }
});

const stream4 = new DexScreenerStream({
  baseUrl,
  apiToken,
  pageUrl,
  streamId: 'simple-transform',
  
  onPair: (pair, { streamId }) => {
    const transformed = simpleTransformer.transform(pair);
    console.log(`[${streamId}] ${transformed.base}/${transformed.quote} = $${transformed.price}`);
  },
  
  onError: (error, { streamId }) => {
    console.error(`[${streamId}] Error:`, error);
  },
});

// Example 5: Minimal data for high-frequency trading
console.log('\n=== Example 5: Minimal HFT Data ===\n');

const hftConfig: TransformConfig = {
  fields: [
    'pairAddress',
    'priceUsd',
    'priceNative'
  ]
};

const hftTransformer = new Transformer(hftConfig);

const stream5 = new DexScreenerStream({
  baseUrl,
  apiToken,
  pageUrl,
  streamId: 'hft-minimal',
  
  onBatch: (event, { streamId }) => {
    if (event.pairs && event.pairs.length > 0) {
      const transformedPairs = hftTransformer.transformBatch(event.pairs);
      
      console.log(`[${streamId}] HFT data (${transformedPairs.length} pairs):`);
      console.log(JSON.stringify(transformedPairs.slice(0, 3), null, 2));
      console.log('');
    }
  },
  
  onError: (error, { streamId }) => {
    console.error(`[${streamId}] Error:`, error);
  },
});

// Start the stream you want to test (uncomment one)
console.log('\nStarting transformation stream...');
stream1.start(); // Essential fields
// stream2.start(); // Aliased fields
// stream3.start(); // Batch transformation
// stream4.start(); // Simple transformer
// stream5.start(); // HFT minimal data

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  stream1.stop();
  stream2.stop();
  stream3.stop();
  stream4.stop();
  stream5.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  stream1.stop();
  stream2.stop();
  stream3.stop();
  stream4.stop();
  stream5.stop();
  process.exit(0);
});
