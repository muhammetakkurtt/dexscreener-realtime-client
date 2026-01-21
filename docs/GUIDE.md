# DexScreener Realtime Client - User Guide

This guide provides practical instructions for installing, configuring, and using the DexScreener Realtime Client SDK and CLI.

---

## Getting Started

### Prerequisites

Before you begin, ensure you have the following:

- **Node.js 18.0.0 or higher** - Download from [nodejs.org](https://nodejs.org/)
- **Apify API Token** - Required for authentication
  - Sign up or log in at [Apify Console](https://console.apify.com/settings/integrations?fpr=muh)
  - Navigate to Settings → Integrations
  - Copy your API token (starts with `apify_api_`)
- **Git** (optional) - For cloning the repository

### Installation

#### 1. Clone the Repository

```bash
git clone https://github.com/muhammetakkurtt/dexscreener-realtime-client.git
cd dexscreener-realtime-client
```

Alternatively, download and extract the source code from the repository.

#### 2. Install Dependencies

```bash
npm install
```

This will install all required packages including:
- `eventsource` - SSE client for real-time streaming
- `dotenv` - Environment variable management
- `yargs` - CLI argument parsing
- `chalk` - Terminal output formatting
- And other dependencies

#### 3. Build the Project

```bash
npm run build
```

This compiles the TypeScript source code into JavaScript and generates:
- `dist/index.js` - ES module for SDK usage
- `dist/index.cjs` - CommonJS module for compatibility
- `dist/cli.cjs` - CLI executable
- `dist/*.d.ts` - TypeScript type definitions

The build process typically takes 5-10 seconds.

### Environment Setup

#### 1. Create Environment File

Copy the example environment file:

```bash
cp .env.example .env
```

#### 2. Configure Environment Variables

Open `.env` in your text editor and configure the following variables:

```bash
# Apify API Token
# Get your token from https://console.apify.com/settings/integrations?fpr=muh
APIFY_TOKEN=apify_api_xxxxxxxxxxxxx

# DexScreener Realtime Monitor Actor Base URL
# This is the Apify Standby Actor URL
DEX_ACTOR_BASE=https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor
```

**Environment Variable Details:**

| Variable | Description | Example |
|----------|-------------|---------|
| `APIFY_TOKEN` | Your Apify API authentication token. Required for all API requests. | `apify_api_xxxxxxxxxxxxx` |
| `DEX_ACTOR_BASE` | Base URL of the DexScreener Realtime Monitor Apify Actor. This is the Standby Actor endpoint. | `https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor` |

### Quick Start - SDK

Here's a minimal example to get you started with the SDK:

```typescript
import 'dotenv/config';
import { DexScreenerStream } from './dist/index.js';

// Create a stream for Solana trending pairs
const stream = new DexScreenerStream({
  baseUrl: process.env.DEX_ACTOR_BASE!,
  apiToken: process.env.APIFY_TOKEN!,
  pageUrl: 'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc',
  streamId: 'solana-trending',
  
  // Receive batches of pairs
  onBatch: (event, { streamId }) => {
    console.log(`[${streamId}] Received ${event.pairs?.length ?? 0} pairs`);
  },
  
  // Process individual pairs
  onPair: (pair, { streamId }) => {
    const symbol = pair.baseToken?.symbol ?? 'UNKNOWN';
    const price = pair.priceUsd ?? 'N/A';
    console.log(`[${streamId}] ${symbol}: $${price}`);
  },
  
  // Handle errors
  onError: (error, { streamId }) => {
    console.error(`[${streamId}] Error:`, error);
  },
  
  // Track connection state
  onStateChange: (state, { streamId }) => {
    console.log(`[${streamId}] State: ${state}`);
  },
});

// Start streaming
stream.start();

// Graceful shutdown
process.on('SIGINT', () => {
  stream.stop();
  process.exit(0);
});
```

**Save this as `my-stream.ts` and run:**

```bash
npx tsx my-stream.ts
```

**What this does:**
- Connects to the DexScreener Realtime Monitor Actor
- Streams real-time data from the Solana trending pairs page
- Logs each pair's symbol and price as updates arrive
- Automatically reconnects if the connection drops
- Handles graceful shutdown on Ctrl+C

### Quick Start - CLI

The CLI provides a zero-code way to consume streams and output data.

#### Basic Usage (stdout mode)

Print JSON events to your terminal:

```bash
node dist/cli.cjs \
  --base-url https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor \
  --api-token apify_api_xxxxxxxxxxxxx \
  --page-url "https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc"
```

**Using environment variables:**

```bash
export APIFY_TOKEN=apify_api_xxxxxxxxxxxxx
node dist/cli.cjs \
  --base-url https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor \
  --page-url "https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc"
```

**What this does:**
- Connects to the specified DexScreener page
- Streams real-time pair updates
- Outputs each event as formatted JSON to stdout
- Continues running until you press Ctrl+C

#### Save to File (jsonl mode)

Append events to a JSON Lines file for later processing:

```bash
node dist/cli.cjs \
  --base-url https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor \
  --page-url "https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc" \
  --mode jsonl \
  --jsonl-path ./solana-events.jsonl
```

**What this does:**
- Streams data to a file instead of stdout
- Each line is a complete JSON event
- File grows as new events arrive
- Perfect for data collection and analysis

#### Forward to Webhook (webhook mode)

Send events to your HTTP endpoint:

```bash
node dist/cli.cjs \
  --base-url https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor \
  --page-url "https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc" \
  --mode webhook \
  --webhook-url https://api.example.com/webhooks/dexscreener
```

**What this does:**
- POSTs each event to your webhook URL
- Includes retry logic for failed requests
- Useful for integrating with existing systems

### Setup Troubleshooting

#### Problem: "APIFY_TOKEN environment variable is required"

**Cause:** The `.env` file is missing or `APIFY_TOKEN` is not set.

**Solution:**
1. Ensure `.env` file exists in the project root
2. Open `.env` and verify `APIFY_TOKEN` is set correctly
3. Check that the token starts with `apify_api_`
4. Ensure there are no extra spaces or quotes around the token

```bash
# Correct
APIFY_TOKEN=apify_api_xxxxxxxxxxxxx

# Incorrect (has quotes)
APIFY_TOKEN="apify_api_xxxxxxxxxxxxx"
```

#### Problem: "Authentication failed" or 401 errors

**Cause:** Invalid or expired API token.

**Solution:**
1. Log in to [Apify Console](https://console.apify.com/settings/integrations?fpr=muh)
2. Navigate to Settings → Integrations
3. Generate a new API token if needed
4. Update your `.env` file with the new token
5. Restart your stream

#### Problem: "DEX_ACTOR_BASE environment variable is required"

**Cause:** The `DEX_ACTOR_BASE` variable is not set in `.env`.

**Solution:**
1. Open `.env` file
2. Add or verify the line:
   ```bash
   DEX_ACTOR_BASE=https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor
   ```
3. Ensure the URL is correct and has no trailing slash

#### Problem: "Cannot find module './dist/index.js'"

**Cause:** The project hasn't been built yet.

**Solution:**
```bash
npm run build
```

Wait for the build to complete, then try running your code again.

#### Problem: "Node.js version too old"

**Cause:** Your Node.js version is below 18.0.0.

**Solution:**
1. Check your Node.js version:
   ```bash
   node --version
   ```
2. If below v18.0.0, upgrade Node.js:
   - Download from [nodejs.org](https://nodejs.org/)
   - Or use a version manager like [nvm](https://github.com/nvm-sh/nvm):
     ```bash
     nvm install 18
     nvm use 18
     ```

#### Problem: Connection keeps dropping or reconnecting

**Cause:** Network instability or firewall issues.

**Solution:**
1. Check your internet connection
2. Verify firewall settings allow outbound HTTPS connections
3. Try increasing the retry delay:
   ```typescript
   const stream = new DexScreenerStream({
     // ... other options
     retryMs: 5000, // Wait 5 seconds between retries
   });
   ```
4. Check if your network blocks SSE (Server-Sent Events) connections

#### Problem: "ECONNREFUSED" or "ENOTFOUND" errors

**Cause:** Cannot reach the Actor base URL.

**Solution:**
1. Verify `DEX_ACTOR_BASE` URL is correct
2. Check if the Actor is running (visit the URL in a browser)
3. Ensure you have internet connectivity
4. Try pinging the host:
   ```bash
   ping muhammetakkurtt--dexscreener-realtime-monitor.apify.actor
   ```

#### Problem: No data received after connecting

**Cause:** The DexScreener page might not have active updates, or the stream is waiting for changes.

**Solution:**
1. Wait a few minutes - some pages update infrequently
2. Try a more active page (e.g., Solana trending pairs)
3. Check the `onStateChange` callback to verify connection state is `connected`
4. Enable debug logging to see what's happening:
   ```typescript
   onBatch: (event, ctx) => {
     console.log('Batch received:', JSON.stringify(event, null, 2));
   }
   ```

#### Problem: TypeScript errors when importing

**Cause:** Type definitions not found or incorrect import path.

**Solution:**
1. Ensure you've built the project: `npm run build`
2. Use the correct import path:
   ```typescript
   // Correct
   import { DexScreenerStream } from './dist/index.js';
   
   // Incorrect (missing .js extension)
   import { DexScreenerStream } from './dist/index';
   ```
3. If using TypeScript, ensure `tsconfig.json` has:
   ```json
   {
     "compilerOptions": {
       "moduleResolution": "node",
       "esModuleInterop": true
     }
   }
   ```

#### Problem: "Permission denied" when running CLI

**Cause:** CLI file doesn't have execute permissions (Unix/Linux/Mac).

**Solution:**
```bash
chmod +x dist/cli.cjs
```

Or always run with `node`:
```bash
node dist/cli.cjs --help
```

---

## SDK Usage Guide

This section provides practical examples for integrating the DexScreener Realtime Client SDK into your applications. Each example references working code from the `examples/` directory.

### Basic Single-Stream Usage

The simplest way to start streaming data is with the `DexScreenerStream` class. This example monitors a single DexScreener page and processes real-time updates.

**Reference:** `examples/basic-sdk.ts`

```typescript
import 'dotenv/config';
import { DexScreenerStream } from './dist/index.js';

const stream = new DexScreenerStream({
  baseUrl: process.env.DEX_ACTOR_BASE!,
  apiToken: process.env.APIFY_TOKEN!,
  pageUrl: 'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc',
  streamId: 'solana-trending',
  retryMs: 3000,
  keepAliveMs: 120000,
  
  // Called when a batch of pairs is received
  onBatch: (event, { streamId }) => {
    console.log(`[${streamId}] Received batch with ${event.pairs?.length ?? 0} pairs`);
    
    // Event statistics provide aggregate data
    if (event.stats) {
      console.log(`[${streamId}] Stats:`, JSON.stringify(event.stats, null, 2));
    }
    
    // Filter high-volume pairs
    const highVolumePairs = event.pairs?.filter(p => 
      (p.volume?.h24 ?? 0) > 100000
    ) ?? [];
    
    if (highVolumePairs.length > 0) {
      console.log(`[${streamId}] Found ${highVolumePairs.length} high-volume pairs (>$100k 24h)`);
    }
  },
  
  // Called for each individual pair
  onPair: (pair, { streamId }) => {
    const baseSymbol = pair.baseToken?.symbol ?? 'UNKNOWN';
    const quoteSymbol = pair.quoteToken?.symbol ?? 'UNKNOWN';
    const priceUsd = pair.priceUsd ?? 'N/A';
    const volume1h = pair.volume?.h1 ?? 'N/A';
    
    console.log(
      `[${streamId}] ${baseSymbol}/${quoteSymbol} ` +
      `priceUsd=${priceUsd} vol.h1=${volume1h}`
    );
  },
  
  // Called when an error occurs
  onError: (error, { streamId }) => {
    console.error(`[${streamId}] Stream error:`, error);
    
    if (error instanceof Error) {
      if (error.message.includes('Authentication failed')) {
        console.error('⚠️  Check your APIFY_TOKEN');
      } else if (error.message.includes('Network')) {
        console.error('⚠️  Network issue - stream will retry automatically');
      }
    }
  },
  
  // Called when connection state changes
  onStateChange: (state, { streamId }) => {
    const stateEmoji = {
      disconnected: '⚫',
      connecting: '🟡',
      connected: '🟢',
      reconnecting: '🟠',
    };
    
    console.log(`[${streamId}] ${stateEmoji[state]} Connection state: ${state}`);
  },
});

// Start streaming
stream.start();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  stream.stop();
  process.exit(0);
});
```

**Key Features:**
- **onBatch**: Process entire batches of pairs at once for aggregation or filtering
- **onPair**: Handle individual pairs as they arrive
- **onError**: Custom error handling with automatic retry
- **onStateChange**: Track connection health (disconnected, connecting, connected, reconnecting)
- **retryMs**: Automatic reconnection with configurable delay
- **keepAliveMs**: Keep connection alive with periodic pings

**Run the example:**
```bash
npx tsx examples/basic-sdk.ts
```


### Multi-Stream Usage

Monitor multiple DexScreener pages simultaneously with a single client instance using `DexScreenerMultiStream`.

**Reference:** `examples/multi-stream.ts`

```typescript
import 'dotenv/config';
import { DexScreenerMultiStream } from './dist/index.js';

const multi = new DexScreenerMultiStream({
  baseUrl: process.env.DEX_ACTOR_BASE!,
  apiToken: process.env.APIFY_TOKEN!,
  retryMs: 3000,
  keepAliveMs: 120000,
  
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
    
    // Handle different streams differently
    if (streamId === 'solana-trending' && event.stats) {
      console.log(`[${streamId}] Solana stats:`, event.stats);
    }
  },
  
  // Called for each pair from any stream
  onPair: (pair, { streamId }) => {
    const baseSymbol = pair.baseToken?.symbol ?? 'UNKNOWN';
    const quoteSymbol = pair.quoteToken?.symbol ?? 'UNKNOWN';
    const priceUsd = pair.priceUsd ?? 'N/A';
    
    console.log(`[${streamId}] ${baseSymbol}/${quoteSymbol} price=${priceUsd}`);
  },
  
  // Called when any stream encounters an error
  onError: (error, { streamId }) => {
    console.error(`[${streamId}] Stream error:`, error);
    
    // Handle errors per stream
    if (error instanceof Error && error.message.includes('Authentication')) {
      console.error(`[${streamId}] ⚠️  Authentication failed`);
      // Could stop just this stream: multi.getStream(streamId)?.stop();
    }
  },
  
  // Called when any stream's connection state changes
  onStateChange: (state, { streamId }) => {
    console.log(`[${streamId}] State: ${state}`);
    
    // Track overall health
    const allStreams = multi.getStreamIds();
    const connectedCount = allStreams.filter(id => {
      const stream = multi.getStream(id);
      return stream?.getState() === 'connected';
    }).length;
    
    console.log(`Overall: ${connectedCount}/${allStreams.length} streams connected`);
  },
});

// Start all streams
multi.startAll();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down all streams...');
  multi.stopAll();
  process.exit(0);
});
```

**Multi-Stream Methods:**
- `startAll()`: Start all configured streams
- `stopAll()`: Stop all streams
- `getStreamIds()`: Get array of all stream IDs
- `getStream(id)`: Get individual stream instance
- `addStream(config)`: Dynamically add a new stream
- `removeStream(id)`: Remove a stream

**Run the example:**
```bash
npx tsx examples/multi-stream.ts
```


### Filtering Data

Use the filtering API to select specific trading pairs based on criteria like chain, liquidity, volume, price change, and token symbol.

**Reference:** `examples/filtering.ts`

#### Using FilterBuilder

The `FilterBuilder` class provides convenient methods for creating common filters:

```typescript
import { DexScreenerStream, FilterBuilder } from './dist/index.js';

// Create individual filters
const liquidityFilter = FilterBuilder.liquidityFilter(50000); // Min $50k liquidity
const volumeFilter = FilterBuilder.volumeFilter('h1', 10000); // Min $10k volume in last hour
const priceChangeFilter = FilterBuilder.priceChangeFilter('h1', 5); // Min 5% price change

// Combine filters with AND logic
const combinedFilter = FilterBuilder.combineFilters(
  [liquidityFilter, volumeFilter, priceChangeFilter],
  'AND'
);

const stream = new DexScreenerStream({
  baseUrl: process.env.DEX_ACTOR_BASE!,
  apiToken: process.env.APIFY_TOKEN!,
  pageUrl: 'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc',
  streamId: 'filtered-stream',
  
  onBatch: (event, { streamId }) => {
    // Filter pairs before processing
    const filteredPairs = event.pairs?.filter(pair => 
      combinedFilter({ pair, event, streamId: streamId ?? 'unknown' })
    ) ?? [];
    
    console.log(`[${streamId}] ${filteredPairs.length}/${event.pairs?.length ?? 0} pairs passed filters`);
    
    for (const pair of filteredPairs) {
      const symbol = `${pair.baseToken?.symbol}/${pair.quoteToken?.symbol}`;
      const liquidity = pair.liquidity?.usd?.toFixed(0) ?? 'N/A';
      const volume = pair.volume?.h1?.toFixed(0) ?? 'N/A';
      const change = pair.priceChange?.h1?.toFixed(2) ?? 'N/A';
      
      console.log(`✓ ${symbol} | Liq: ${liquidity} | Vol(1h): ${volume} | Change(1h): ${change}%`);
    }
  },
  
  onError: (error) => console.error('Error:', error),
});

stream.start();
```


#### Available Filter Methods

**FilterBuilder Methods:**
- `chainFilter(chains: string[])`: Filter by blockchain (e.g., ['solana', 'ethereum'])
- `liquidityFilter(minUsd: number)`: Minimum liquidity in USD
- `volumeFilter(timeframe: 'h1' | 'h6' | 'h24', minUsd: number)`: Minimum volume
- `priceChangeFilter(timeframe: 'h1' | 'h6' | 'h24', minPercent: number)`: Minimum price change
- `symbolFilter(pattern: string | RegExp)`: Filter by token symbol pattern
- `combineFilters(filters: FilterFunction[], operator: 'AND' | 'OR')`: Combine multiple filters

#### Chain-Specific Filtering

```typescript
const solanaOnlyFilter = FilterBuilder.chainFilter(['solana']);

const stream = new DexScreenerStream({
  // ... config
  onBatch: (event, { streamId }) => {
    const solanaPairs = event.pairs?.filter(pair => 
      solanaOnlyFilter({ pair, event, streamId: streamId ?? 'unknown' })
    ) ?? [];
    
    console.log(`Solana pairs: ${solanaPairs.length}/${event.pairs?.length ?? 0}`);
  },
});
```

#### Symbol Pattern Matching

```typescript
// Match meme tokens using regex
const memeTokenFilter = FilterBuilder.symbolFilter(/^(PEPE|DOGE|SHIB|BONK)/i);

const stream = new DexScreenerStream({
  // ... config
  onBatch: (event, { streamId }) => {
    const memeTokens = event.pairs?.filter(pair => 
      memeTokenFilter({ pair, event, streamId: streamId ?? 'unknown' })
    ) ?? [];
    
    for (const pair of memeTokens) {
      const symbol = pair.baseToken?.symbol ?? 'UNKNOWN';
      const priceUsd = pair.priceUsd ?? 'N/A';
      console.log(`🐕 ${symbol} | Price: ${priceUsd}`);
    }
  },
});
```

**Run the example:**
```bash
npx tsx examples/filtering.ts
```


### Transforming Data

Use the transformation API to select specific fields and reshape data structures for your application needs.

**Reference:** `examples/transformation.ts`

#### Field Selection

Extract only the fields you need to reduce data size and processing overhead:

```typescript
import { DexScreenerStream, Transformer } from './dist/index.js';
import type { TransformConfig } from './dist/index.js';

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

const stream = new DexScreenerStream({
  baseUrl: process.env.DEX_ACTOR_BASE!,
  apiToken: process.env.APIFY_TOKEN!,
  pageUrl: 'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc',
  streamId: 'essential-fields',
  
  onBatch: (event, { streamId }) => {
    if (event.pairs && event.pairs.length > 0) {
      // Transform first pair as example
      const transformed = essentialTransformer.transform(event.pairs[0]);
      console.log('Transformed pair (essential fields only):');
      console.log(JSON.stringify(transformed, null, 2));
    }
  },
  
  onError: (error) => console.error('Error:', error),
});

stream.start();
```


#### Field Aliasing

Rename fields to match your application's naming conventions:

```typescript
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

const stream = new DexScreenerStream({
  // ... config
  onBatch: (event) => {
    if (event.pairs && event.pairs.length > 0) {
      const transformed = aliasedTransformer.transform(event.pairs[0]);
      console.log(JSON.stringify(transformed, null, 2));
      // Output: { chain: 'solana', base: 'SOL', quote: 'USDC', price: '123.45', ... }
    }
  },
});
```

#### Batch Transformation

Transform all pairs at once for better performance:

```typescript
const batchConfig: TransformConfig = {
  fields: ['baseToken.symbol', 'priceUsd', 'priceChange.h1', 'volume.h1'],
  aliases: {
    'baseToken.symbol': 'symbol',
    'priceUsd': 'price',
    'priceChange.h1': 'change1h',
    'volume.h1': 'volume1h'
  }
};

const batchTransformer = new Transformer(batchConfig);

const stream = new DexScreenerStream({
  // ... config
  onBatch: (event) => {
    if (event.pairs && event.pairs.length > 0) {
      // Transform all pairs at once
      const transformedPairs = batchTransformer.transformBatch(event.pairs);
      
      console.log(`Transformed ${transformedPairs.length} pairs`);
      transformedPairs.slice(0, 5).forEach((pair, index) => {
        console.log(`${index + 1}. ${JSON.stringify(pair)}`);
      });
    }
  },
});
```


#### Using createTransformer Helper

For quick transformations, use the `createTransformer` helper function:

```typescript
import { createTransformer } from './dist/index.js';

const simpleTransformer = createTransformer({
  fields: ['baseToken.symbol', 'quoteToken.symbol', 'priceUsd'],
  aliases: {
    'baseToken.symbol': 'base',
    'quoteToken.symbol': 'quote',
    'priceUsd': 'price'
  }
});

const stream = new DexScreenerStream({
  // ... config
  onPair: (pair) => {
    const transformed = simpleTransformer.transform(pair);
    console.log(`${transformed.base}/${transformed.quote} = ${transformed.price}`);
  },
});
```

#### Minimal Data for High-Frequency Trading

Extract only critical fields for low-latency applications:

```typescript
const hftConfig: TransformConfig = {
  fields: ['pairAddress', 'priceUsd', 'priceNative']
};

const hftTransformer = new Transformer(hftConfig);

const stream = new DexScreenerStream({
  // ... config
  onBatch: (event) => {
    if (event.pairs && event.pairs.length > 0) {
      const transformedPairs = hftTransformer.transformBatch(event.pairs);
      console.log(JSON.stringify(transformedPairs.slice(0, 3), null, 2));
    }
  },
});
```

**Transformation Features:**
- **Nested field access**: Use dot notation (e.g., `baseToken.symbol`)
- **Field selection**: Include only the fields you need
- **Field aliasing**: Rename fields to match your schema
- **Batch operations**: Transform multiple pairs efficiently
- **Type safety**: Full TypeScript support

**Run the example:**
```bash
npx tsx examples/transformation.ts
```


### Error Handling and Graceful Shutdown

Implement robust error handling and graceful shutdown patterns for production applications.

**Reference:** `examples/graceful-shutdown.ts`

#### Basic Graceful Shutdown

Handle cleanup of resources and pending operations:

```typescript
import { DexScreenerStream } from './dist/index.js';
import { writeFileSync, appendFileSync } from 'fs';

class GracefulStream {
  private stream: DexScreenerStream;
  private isShuttingDown = false;
  private pendingWrites: Promise<void>[] = [];
  private outputFile = './stream-output.jsonl';

  constructor() {
    this.stream = new DexScreenerStream({
      baseUrl: process.env.DEX_ACTOR_BASE!,
      apiToken: process.env.APIFY_TOKEN!,
      pageUrl: 'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc',
      streamId: 'graceful-stream',
      
      onBatch: (event, { streamId }) => {
        if (this.isShuttingDown) {
          console.log(`[${streamId}] Shutdown in progress, skipping batch`);
          return;
        }

        console.log(`[${streamId}] Processing ${event.pairs?.length ?? 0} pairs`);
        
        // Track async operations
        const writePromise = this.writeToFile(event);
        this.pendingWrites.push(writePromise);
      },
      
      onError: (error, { streamId }) => {
        console.error(`[${streamId}] Error:`, error);
      },
    });

    writeFileSync(this.outputFile, '');
  }

  private async writeToFile(event: any): Promise<void> {
    return new Promise((resolve) => {
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
    this.stream.start();
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;

    console.log('\n🛑 Initiating graceful shutdown...');
    this.isShuttingDown = true;

    // Step 1: Stop accepting new data
    console.log('1. Stopping stream...');
    this.stream.stop();

    // Step 2: Wait for pending writes
    console.log(`2. Waiting for ${this.pendingWrites.length} pending writes...`);
    await Promise.all(this.pendingWrites);
    console.log('   ✓ All writes completed');

    // Step 3: Final cleanup
    console.log('3. Cleanup complete');
    console.log(`   Output saved to: ${this.outputFile}`);
    console.log('✓ Graceful shutdown complete');
  }
}

// Usage
const streamWrapper = new GracefulStream();
streamWrapper.start();

// Handle shutdown signals
const handleShutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}`);
  await streamWrapper.shutdown();
  process.exit(0);
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
```

#### Multi-Stream Graceful Shutdown

Coordinate shutdown across multiple streams:

```typescript
import { DexScreenerMultiStream } from './dist/index.js';

class GracefulMultiStream {
  private multiStream: DexScreenerMultiStream;
  private isShuttingDown = false;
  private eventCounts: Map<string, number> = new Map();
  private shutdownTimeout = 5000; // 5 seconds max wait

  constructor() {
    this.multiStream = new DexScreenerMultiStream({
      baseUrl: process.env.DEX_ACTOR_BASE!,
      apiToken: process.env.APIFY_TOKEN!,
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
        
        console.log(`[${id}] Event #${count + 1} | ${event.pairs?.length ?? 0} pairs`);
      },
      
      onError: (error, { streamId }) => {
        console.error(`[${streamId ?? 'unknown'}] Error:`, error);
      },
    });
  }

  start(): void {
    console.log('Starting multi-stream...');
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
      setTimeout(() => resolve(), 1000);
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
```

#### Shutdown with State Persistence

Save application state during shutdown for recovery:

```typescript
import { writeFileSync, existsSync, readFileSync } from 'fs';

interface StreamState {
  streamId: string;
  lastEventTime: number;
  totalEvents: number;
  totalPairs: number;
}

class StatefulStream {
  private stream: DexScreenerStream;
  private state: StreamState;
  private stateFile = './stream-state.json';
  private saveInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Load previous state if exists
    this.state = this.loadState();

    this.stream = new DexScreenerStream({
      baseUrl: process.env.DEX_ACTOR_BASE!,
      apiToken: process.env.APIFY_TOKEN!,
      pageUrl: 'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc',
      streamId: 'stateful-stream',
      
      onBatch: (event, { streamId }) => {
        this.state.lastEventTime = Date.now();
        this.state.totalEvents++;
        this.state.totalPairs += event.pairs?.length ?? 0;
        
        console.log(`[${streamId}] Total: ${this.state.totalEvents} events, ${this.state.totalPairs} pairs`);
      },
      
      onError: (error) => console.error('Error:', error),
    });

    // Periodically save state
    this.saveInterval = setInterval(() => {
      this.saveState();
    }, 10000); // Save every 10 seconds
  }

  private loadState(): StreamState {
    try {
      if (existsSync(this.stateFile)) {
        const data = JSON.parse(readFileSync(this.stateFile, 'utf-8'));
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
```

**Graceful Shutdown Best Practices:**
- Stop accepting new data first
- Wait for pending async operations to complete
- Set reasonable timeouts to prevent hanging
- Save state for recovery
- Log shutdown progress
- Handle SIGINT and SIGTERM signals
- Clean up resources (timers, file handles, etc.)

**Run the example:**
```bash
npx tsx examples/graceful-shutdown.ts
```


### Custom Retry Logic

Implement advanced retry strategies for production resilience.

**Reference:** `examples/custom-retry.ts`

#### Exponential Backoff

Gradually increase retry delays to avoid overwhelming the server:

```typescript
import { DexScreenerStream } from './dist/index.js';

class ExponentialBackoffStream {
  private stream: DexScreenerStream;
  private retryCount = 0;
  private maxRetries = 5;
  private baseRetryMs = 1000;
  private maxRetryMs = 30000;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.stream = new DexScreenerStream({
      baseUrl: process.env.DEX_ACTOR_BASE!,
      apiToken: process.env.APIFY_TOKEN!,
      pageUrl: 'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc',
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

    console.log(`Retry attempt ${this.retryCount}/${this.maxRetries} in ${retryDelay}ms...`);

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
```


#### Circuit Breaker Pattern

Prevent cascading failures by temporarily stopping retry attempts:

```typescript
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
      baseUrl: process.env.DEX_ACTOR_BASE!,
      apiToken: process.env.APIFY_TOKEN!,
      pageUrl: 'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc',
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
```


#### Jittered Retry

Add randomness to retry delays to prevent thundering herd problems:

```typescript
class JitteredRetryStream {
  private stream: DexScreenerStream;
  private retryCount = 0;
  private maxRetries = 10;
  private baseRetryMs = 2000;

  constructor() {
    this.stream = new DexScreenerStream({
      baseUrl: process.env.DEX_ACTOR_BASE!,
      apiToken: process.env.APIFY_TOKEN!,
      pageUrl: 'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc',
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

    console.log(`Retry ${this.retryCount}/${this.maxRetries} in ${retryDelay.toFixed(0)}ms (with jitter)`);

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
```

**Retry Strategy Comparison:**

| Strategy | Use Case | Pros | Cons |
|----------|----------|------|------|
| **Exponential Backoff** | General purpose, API rate limits | Reduces server load, predictable | Can wait too long |
| **Circuit Breaker** | Cascading failures, service outages | Prevents resource waste | Requires tuning thresholds |
| **Jittered Retry** | Multiple clients, thundering herd | Distributes load evenly | Less predictable timing |

**Run the example:**
```bash
# Exponential backoff
npx tsx examples/custom-retry.ts 1

# Circuit breaker
npx tsx examples/custom-retry.ts 2

# Jittered retry
npx tsx examples/custom-retry.ts 3
```

---

## CLI Usage Guide

The DexScreener Realtime Client provides a powerful command-line interface for consuming streams without writing code. The CLI supports three output modes, extensive configuration options, and advanced features like filtering, transformation, and monitoring.

### CLI Modes

The CLI supports three output modes controlled by the `--mode` flag:

#### 1. stdout Mode (Default)

Outputs JSON events directly to standard output. Perfect for piping to other tools or quick testing.

```bash
node dist/cli.cjs \
  --base-url https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor \
  --page-url "https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc"
```

**Output format:**
```json
{
  "streamId": "stream-1",
  "pageUrl": "https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc",
  "timestamp": 1705843200000,
  "event": {
    "stats": { "totalPairs": 50, "avgVolume": 125000 },
    "pairs": [...]
  }
}
```

**Use cases:**
- Quick testing and debugging
- Piping to `jq` for JSON processing
- Redirecting to files with shell operators
- Integration with shell scripts

**Example with jq:**
```bash
node dist/cli.cjs \
  --base-url https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor \
  --page-url "https://dexscreener.com/solana" \
  | jq '.event.pairs[] | select(.volume.h24 > 100000) | {symbol: .baseToken.symbol, price: .priceUsd}'
```

#### 2. jsonl Mode

Appends events to a JSON Lines file. Each line is a complete JSON object, making it easy to process large datasets.

```bash
node dist/cli.cjs \
  --base-url https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor \
  --page-url "https://dexscreener.com/solana" \
  --mode jsonl \
  --jsonl-path ./data/solana-stream.jsonl
```

**File format (each line is a separate JSON object):**
```jsonl
{"streamId":"stream-1","pageUrl":"...","timestamp":1705843200000,"event":{...}}
{"streamId":"stream-1","pageUrl":"...","timestamp":1705843201000,"event":{...}}
{"streamId":"stream-1","pageUrl":"...","timestamp":1705843202000,"event":{...}}
```

**Use cases:**
- Long-running data collection
- Historical data analysis
- Batch processing with tools like `jq`, `awk`, or Python
- Data pipelines and ETL workflows

**Advanced jsonl options:**

**With compression:**
```bash
node dist/cli.cjs \
  --mode jsonl \
  --jsonl-path ./data/solana-stream.jsonl \
  --compress \
  --page-url "https://dexscreener.com/solana"
```
Creates `solana-stream.jsonl.gz` with gzip compression.

**With file rotation by size:**
```bash
node dist/cli.cjs \
  --mode jsonl \
  --jsonl-path ./data/solana-stream.jsonl \
  --rotate-size 100 \
  --page-url "https://dexscreener.com/solana"
```
Rotates file when it exceeds 100 MB. Creates `solana-stream.jsonl.1`, `solana-stream.jsonl.2`, etc.

**With file rotation by time:**
```bash
node dist/cli.cjs \
  --mode jsonl \
  --jsonl-path ./data/solana-stream.jsonl \
  --rotate-interval hourly \
  --page-url "https://dexscreener.com/solana"
```
Rotates file every hour. Creates timestamped files like `solana-stream-2026-01-21-14.jsonl`.

**With both compression and rotation:**
```bash
node dist/cli.cjs \
  --mode jsonl \
  --jsonl-path ./data/solana-stream.jsonl \
  --compress \
  --rotate-size 50 \
  --page-url "https://dexscreener.com/solana"
```

#### 3. webhook Mode

POSTs events to an HTTP endpoint. Ideal for integrating with existing systems and real-time processing pipelines.

```bash
node dist/cli.cjs \
  --base-url https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor \
  --page-url "https://dexscreener.com/solana" \
  --mode webhook \
  --webhook-url https://api.example.com/webhooks/dexscreener
```

**HTTP request format:**
```http
POST /api/dex-events HTTP/1.1
Host: api.example.com
Content-Type: application/json

{
  "streamId": "stream-1",
  "pageUrl": "https://dexscreener.com/solana",
  "timestamp": 1705843200000,
  "event": {
    "stats": {...},
    "pairs": [...]
  }
}
```

**Use cases:**
- Real-time data ingestion into databases
- Triggering alerts and notifications
- Integration with message queues (via webhook proxy)
- Feeding data to analytics platforms

**Advanced webhook options:**

**With compression:**
```bash
node dist/cli.cjs \
  --mode webhook \
  --webhook-url https://api.example.com/webhooks/dexscreener \
  --compress \
  --page-url "https://dexscreener.com/solana"
```
Sends gzip-compressed payloads with `Content-Encoding: gzip` header.

**With batching:**
```bash
node dist/cli.cjs \
  --mode webhook \
  --webhook-url https://api.example.com/webhooks/dexscreener \
  --batch-size 10 \
  --batch-interval 5000 \
  --page-url "https://dexscreener.com/solana"
```
Batches up to 10 events or waits 5 seconds before sending. Payload becomes an array:
```json
[
  {"streamId": "stream-1", "timestamp": 1705843200000, "event": {...}},
  {"streamId": "stream-1", "timestamp": 1705843201000, "event": {...}},
  ...
]
```

**With compression and batching:**
```bash
node dist/cli.cjs \
  --mode webhook \
  --webhook-url https://api.example.com/webhooks/dexscreener \
  --compress \
  --batch-size 20 \
  --batch-interval 10000 \
  --page-url "https://dexscreener.com/solana"
```

### CLI Flags Reference

Complete reference of all available command-line flags:

#### Required Flags

| Flag | Type | Description | Example |
|------|------|-------------|---------|
| `--base-url` | string | Apify Standby Actor base URL | `https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor` |
| `--api-token` | string | Apify API token (or use `APIFY_TOKEN` env var) | `apify_api_xxxxxxxxxxxxx` |
| `--page-url` | string[] | DexScreener page URL(s) to monitor (can be specified multiple times) | `"https://dexscreener.com/solana"` |

#### Output Mode Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--mode` | `stdout` \| `jsonl` \| `webhook` | `stdout` | Output mode |
| `--jsonl-path` | string | - | File path for JSONL output (required when `mode=jsonl`) |
| `--webhook-url` | string | - | Webhook URL for HTTP POST (required when `mode=webhook`) |

#### Connection Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--retry-ms` | number | `3000` | Reconnection delay in milliseconds |
| `--keep-alive-ms` | number | `120000` | Health check interval in milliseconds (set to 0 to disable) |

#### Output Management Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--compress` | boolean | `false` | Enable gzip compression for JSONL and webhook output |
| `--rotate-size` | number | - | Rotate JSONL file when it exceeds this size in MB |
| `--rotate-interval` | `hourly` \| `daily` | - | Rotate JSONL file at time intervals |
| `--batch-size` | number | - | Maximum number of events per batch for webhook mode |
| `--batch-interval` | number | - | Maximum time to wait before flushing batch in milliseconds |
| `--sample-rate` | number | - | Sample rate percentage (0-100) for event processing |

#### Data Processing Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--aggregate` | boolean | `false` | Output aggregated statistics only (no individual pairs) |

#### Monitoring Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--health-port` | number | - | Port for health check HTTP endpoint |
| `--metrics-port` | number | - | Port for Prometheus metrics HTTP endpoint |
| `--log-level` | `error` \| `warn` \| `info` \| `debug` | `info` | Logging level |
| `--log-format` | `text` \| `json` | `text` | Log output format |
| `--perf` | boolean | `false` | Enable performance monitoring |

#### Display Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--verbose` | boolean | `false` | Enable verbose output with detailed information |
| `--quiet` | boolean | `false` | Suppress all output except errors |
| `--debug` | boolean | `false` | Enable debug mode with diagnostic information |

#### Configuration Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--interactive` | boolean | `false` | Launch interactive configuration wizard |
| `--profile` | string | - | Configuration profile to use |
| `--validate` | boolean | `false` | Validate configuration and exit |
| `--init` | boolean | `false` | Generate default configuration file |

#### Help Flags

| Flag | Description |
|------|-------------|
| `--help`, `-h` | Show help message |

### Multi-Stream CLI Examples

Monitor multiple DexScreener pages simultaneously by specifying `--page-url` multiple times:

#### Basic Multi-Stream

```bash
node dist/cli.cjs \
  --base-url https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor \
  --page-url "https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc" \
  --page-url "https://dexscreener.com/ethereum?rankBy=volume&order=desc" \
  --page-url "https://dexscreener.com/base?rankBy=trendingScoreH6&order=desc"
```

**Output includes streamId to identify the source:**
```json
{"streamId":"stream-1","pageUrl":"https://dexscreener.com/solana?...","event":{...}}
{"streamId":"stream-2","pageUrl":"https://dexscreener.com/ethereum?...","event":{...}}
{"streamId":"stream-3","pageUrl":"https://dexscreener.com/base?...","event":{...}}
```

#### Multi-Stream to JSONL

```bash
node dist/cli.cjs \
  --mode jsonl \
  --jsonl-path ./data/multi-chain.jsonl \
  --page-url "https://dexscreener.com/solana" \
  --page-url "https://dexscreener.com/ethereum" \
  --page-url "https://dexscreener.com/bsc"
```

All streams write to the same file with `streamId` for identification.

#### Multi-Stream to Webhook with Batching

```bash
node dist/cli.cjs \
  --mode webhook \
  --webhook-url https://api.example.com/webhooks/dexscreener \
  --batch-size 20 \
  --batch-interval 10000 \
  --page-url "https://dexscreener.com/solana" \
  --page-url "https://dexscreener.com/ethereum" \
  --page-url "https://dexscreener.com/polygon"
```

Events from all streams are batched together and sent as arrays.

#### Multi-Stream with Different Chains

```bash
node dist/cli.cjs \
  --page-url "https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc&minLiq=10000" \
  --page-url "https://dexscreener.com/ethereum?rankBy=volume&order=desc&minLiq=50000" \
  --page-url "https://dexscreener.com/base?rankBy=trendingScoreH6&order=desc&minLiq=30000" \
  --page-url "https://dexscreener.com/arbitrum?rankBy=volume&order=desc" \
  --verbose
```

Use `--verbose` to see detailed connection status for each stream.

#### Multi-Stream with Monitoring

```bash
node dist/cli.cjs \
  --page-url "https://dexscreener.com/solana" \
  --page-url "https://dexscreener.com/ethereum" \
  --page-url "https://dexscreener.com/bsc" \
  --health-port 3001 \
  --metrics-port 3002 \
  --log-level info \
  --log-format json
```

**Health check endpoint (http://localhost:3001/health):**
```json
{
  "status": "healthy",
  "streams": {
    "stream-1": {"state": "connected", "lastEventAt": 1705843200000, "eventsReceived": 150},
    "stream-2": {"state": "connected", "lastEventAt": 1705843199000, "eventsReceived": 98},
    "stream-3": {"state": "reconnecting", "lastEventAt": 1705843180000, "eventsReceived": 45}
  }
}
```

**Metrics endpoint (http://localhost:3002/metrics):**
```
# HELP dex_events_total Total number of events received
# TYPE dex_events_total counter
dex_events_total{stream_id="stream-1"} 150
dex_events_total{stream_id="stream-2"} 98
dex_events_total{stream_id="stream-3"} 45

# HELP dex_connection_state Current connection state
# TYPE dex_connection_state gauge
dex_connection_state{stream_id="stream-1",state="connected"} 1
dex_connection_state{stream_id="stream-2",state="connected"} 1
dex_connection_state{stream_id="stream-3",state="reconnecting"} 1
```

### Configuration File Usage

The CLI supports configuration files to avoid repeating command-line arguments. Configuration files can be in JSON or YAML format.

#### Generate Configuration File

Use the `--init` flag to generate a default configuration file:

```bash
node dist/cli.cjs --init
```

**Interactive prompts:**
```
📝 Configuration File Generator

? Select configuration file format: (Use arrow keys)
❯ JSON (.dexrtrc.json)
  YAML (.dexrtrc.yaml)
```

This creates `.dexrtrc.json` or `.dexrtrc.yaml` in the current directory with example configuration.

#### Configuration File Discovery

The CLI automatically searches for configuration files in the following order:

1. `.dexrtrc.json` (current directory)
2. `.dexrtrc.yaml` (current directory)
3. `.dexrtrc.yml` (current directory)
4. `dexrt.config.json` (current directory)
5. `dexrt.config.yaml` (current directory)
6. `dexrt.config.yml` (current directory)

**Note:** CLI arguments always override configuration file settings.

#### Using Configuration Files

**Example `.dexrtrc.json`:**
```json
{
  "baseUrl": "https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor",
  "apiToken": "apify_api_xxxxxxxxxxxxx",
  "pageUrls": [
    "https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc",
    "https://dexscreener.com/ethereum?rankBy=volume&order=desc"
  ],
  "mode": "jsonl",
  "output": {
    "compression": {
      "enabled": true
    },
    "rotation": {
      "maxSizeMB": 100,
      "interval": "hourly"
    }
  },
  "monitoring": {
    "healthPort": 3001,
    "metricsPort": 3002,
    "logLevel": "info",
    "logFormat": "json"
  }
}
```

**Run with config file:**
```bash
# Uses .dexrtrc.json automatically
node dist/cli.cjs --jsonl-path ./data/output.jsonl

# Override specific settings
node dist/cli.cjs --jsonl-path ./data/output.jsonl --mode stdout
```

#### Validate Configuration

Check if your configuration is valid without starting the stream:

```bash
node dist/cli.cjs --validate
```

**Output on success:**
```
✅ Configuration is valid
```

**Output on error:**
```
Configuration validation failed:

  [baseUrl] Base URL is required
    Suggestion: Set baseUrl in config file or use --base-url flag
  [pageUrls] At least one page URL is required
    Suggestion: Set pageUrls in config file or use --page-url flag
```

#### Profile Selection

Configuration files can define multiple profiles for different environments (development, production, etc.):

**Example `.dexrtrc.json` with profiles:**
```json
{
  "baseUrl": "https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor",
  "apiToken": "apify_api_xxxxxxxxxxxxx",
  "pageUrls": ["https://dexscreener.com/solana"],
  "mode": "stdout",
  
  "profiles": {
    "dev": {
      "mode": "stdout",
      "monitoring": {
        "logLevel": "debug"
      }
    },
    "prod": {
      "mode": "jsonl",
      "output": {
        "compression": {
          "enabled": true
        },
        "rotation": {
          "maxSizeMB": 100,
          "interval": "hourly"
        }
      },
      "monitoring": {
        "healthPort": 3001,
        "metricsPort": 3002,
        "logLevel": "warn",
        "logFormat": "json"
      }
    },
    "webhook": {
      "mode": "webhook",
      "output": {
        "batching": {
          "maxSize": 20,
          "maxWaitMs": 10000
        },
        "compression": {
          "enabled": true
        }
      }
    }
  }
}
```

**Use a specific profile:**
```bash
# Development profile
node dist/cli.cjs --profile dev

# Production profile
node dist/cli.cjs --profile prod --jsonl-path ./data/prod-output.jsonl

# Webhook profile
node dist/cli.cjs --profile webhook --webhook-url https://api.example.com/webhooks/dexscreener
```

**Profile precedence:**
1. CLI arguments (highest priority)
2. Selected profile settings
3. Base configuration settings (lowest priority)

#### Interactive Configuration Wizard

Launch an interactive wizard to create configuration:

```bash
node dist/cli.cjs --interactive
```

**Wizard prompts:**
```
🧙 DexScreener Realtime Client Configuration Wizard

? Enter Apify Actor base URL: https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor
? Enter Apify API token: apify_api_xxxxxxxxxxxxx
? Enter DexScreener page URL: https://dexscreener.com/solana
? Add another page URL? No
? Select output mode: (Use arrow keys)
❯ stdout - Print to console
  jsonl - Save to JSON Lines file
  webhook - POST to HTTP endpoint
? Save configuration to file? Yes
? Configuration file path: .dexrtrc.json

✅ Configuration saved to .dexrtrc.json
```

The wizard creates a configuration file and immediately starts streaming with the configured settings.

### Common CLI Patterns

#### Pattern 1: Development Testing

Quick testing with verbose output:

```bash
node dist/cli.cjs \
  --page-url "https://dexscreener.com/solana" \
  --verbose \
  --log-level debug
```

#### Pattern 2: Production Data Collection

Long-running data collection with rotation and compression:

```bash
node dist/cli.cjs \
  --mode jsonl \
  --jsonl-path ./data/production.jsonl \
  --compress \
  --rotate-size 100 \
  --rotate-interval daily \
  --page-url "https://dexscreener.com/solana" \
  --page-url "https://dexscreener.com/ethereum" \
  --health-port 3001 \
  --metrics-port 3002 \
  --log-level warn \
  --log-format json
```

#### Pattern 3: Real-Time Integration

Webhook with batching and monitoring:

```bash
node dist/cli.cjs \
  --mode webhook \
  --webhook-url https://api.example.com/webhooks/dexscreener \
  --batch-size 20 \
  --batch-interval 5000 \
  --compress \
  --page-url "https://dexscreener.com/solana" \
  --health-port 3001 \
  --retry-ms 5000
```

#### Pattern 4: Filtered High-Volume Pairs

Using configuration file with filters (requires config file):

```bash
# .dexrtrc.json with filters
{
  "baseUrl": "...",
  "apiToken": "...",
  "pageUrls": ["https://dexscreener.com/solana"],
  "mode": "stdout",
  "filters": [
    {
      "type": "liquidity",
      "minUsd": 50000
    },
    {
      "type": "volume",
      "timeframe": "h24",
      "minUsd": 100000
    }
  ]
}
```

```bash
node dist/cli.cjs
```

#### Pattern 5: Aggregated Statistics Only

Output only aggregated stats without individual pairs:

```bash
node dist/cli.cjs \
  --page-url "https://dexscreener.com/solana" \
  --aggregate
```

**Output:**
```json
{
  "streamId": "stream-1",
  "pageUrl": "https://dexscreener.com/solana",
  "timestamp": 1705843200000,
  "event": {
    "stats": {
      "totalPairs": 50,
      "avgVolume": 125000,
      "avgLiquidity": 85000,
      "topGainer": {"symbol": "SOL/USDC", "change": 15.5}
    },
    "pairs": [],
    "aggregated": {
      "eventStats": {...},
      "pairStats": {...}
    }
  }
}
```

#### Pattern 6: Sampling for Load Reduction

Process only a percentage of events:

```bash
node dist/cli.cjs \
  --page-url "https://dexscreener.com/solana" \
  --sample-rate 50
```

Processes only 50% of events randomly, reducing load and output volume.

---

## Configuration

The DexScreener Realtime Client supports flexible configuration through files, environment variables, and command-line arguments. Configuration files allow you to define reusable settings, create environment-specific profiles, and avoid repeating command-line arguments.

### Configuration File Discovery and Precedence

The CLI automatically searches for configuration files in a specific order, using the first file it finds:

#### Search Order

1. **Current directory** (highest priority):
   - `.dexrtrc.json`
   - `.dexrtrc.yaml`
   - `.dexrtrc.yml`

2. **Home directory** (fallback):
   - `~/.dexrtrc.json`
   - `~/.dexrtrc.yaml`
   - `~/.dexrtrc.yml`

The search stops as soon as a configuration file is found. Files in the current directory take precedence over files in the home directory.

#### Configuration Precedence

When multiple configuration sources are present, they are merged in the following order (later sources override earlier ones):

1. **Configuration file** (lowest priority) - Base settings from `.dexrtrc.json` or `.dexrtrc.yaml`
2. **Profile settings** - If a profile is selected, its settings override base configuration
3. **Environment variables** - `APIFY_TOKEN` and `DEX_ACTOR_BASE` override file settings
4. **Command-line arguments** (highest priority) - CLI flags override all other sources

**Example precedence:**
```bash
# .dexrtrc.json has mode: "stdout"
# CLI argument --mode jsonl overrides it
node dist/cli.cjs --mode jsonl --jsonl-path ./output.jsonl
# Result: Uses jsonl mode (CLI argument wins)
```


### Complete JSON Configuration Example

Here's a comprehensive JSON configuration file demonstrating all available options:

**`.dexrtrc.json`:**
```json
{
  "baseUrl": "https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor",
  "apiToken": "apify_api_xxxxxxxxxxxxx",
  "pageUrls": [
    "https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc",
    "https://dexscreener.com/ethereum?rankBy=volume&order=desc"
  ],
  "mode": "jsonl",
  "filters": [
    {
      "type": "liquidity",
      "params": {
        "minUsd": 50000
      }
    },
    {
      "type": "volume",
      "params": {
        "period": "h24",
        "minUsd": 100000
      }
    }
  ],
  "transforms": {
    "fields": [
      "chainId",
      "baseToken.symbol",
      "quoteToken.symbol",
      "priceUsd",
      "volume.h24",
      "liquidity.usd"
    ],
    "aliases": {
      "baseToken.symbol": "base",
      "quoteToken.symbol": "quote",
      "priceUsd": "price"
    }
  },
  "output": {
    "compression": {
      "enabled": true,
      "level": 6
    },
    "rotation": {
      "maxSizeMB": 100,
      "interval": "hourly",
      "keepFiles": 24
    },
    "batching": {
      "maxSize": 50,
      "maxWaitMs": 5000
    },
    "throttling": {
      "maxPerSecond": 100,
      "dropStrategy": "oldest"
    },
    "sampling": {
      "rate": 100
    }
  },
  "monitoring": {
    "healthPort": 3001,
    "metricsPort": 9090,
    "logLevel": "info",
    "logFormat": "json",
    "performance": true,
    "alerts": [
      {
        "metric": "events_per_second",
        "threshold": 1,
        "comparison": "lt"
      }
    ]
  }
}
```

**Configuration Field Reference:**

| Field | Type | Description |
|-------|------|-------------|
| `baseUrl` | string | Apify Standby Actor base URL (required) |
| `apiToken` | string | Apify API token (can use `APIFY_TOKEN` env var) |
| `pageUrls` | string[] | Array of DexScreener page URLs to monitor (required) |
| `mode` | string | Output mode: `stdout`, `jsonl`, or `webhook` |
| `filters` | array | Array of filter configurations (see Filtering section) |
| `transforms` | object | Transformation configuration (see Transformation section) |
| `output` | object | Output management settings |
| `output.compression` | object | Compression settings for JSONL/webhook output |
| `output.rotation` | object | File rotation settings for JSONL mode |
| `output.batching` | object | Batching settings for webhook mode |
| `output.throttling` | object | Rate limiting settings |
| `output.sampling` | object | Event sampling settings |
| `monitoring` | object | Monitoring and observability settings |
| `monitoring.healthPort` | number | Port for health check endpoint |
| `monitoring.metricsPort` | number | Port for Prometheus metrics |
| `monitoring.logLevel` | string | Log level: `error`, `warn`, `info`, `debug` |
| `monitoring.logFormat` | string | Log format: `text` or `json` |
| `monitoring.performance` | boolean | Enable performance tracking |
| `monitoring.alerts` | array | Alert threshold configurations |


### Complete YAML Configuration Example

The same configuration can be expressed in YAML format for better readability:

**`.dexrtrc.yaml`:**
```yaml
# DexScreener Realtime Client Configuration
# Required: Apify Standby Actor base URL
baseUrl: https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor

# Required: API token (or set APIFY_TOKEN environment variable)
apiToken: apify_api_xxxxxxxxxxxxx

# Required: DexScreener page URLs to monitor
pageUrls:
  - https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc
  - https://dexscreener.com/ethereum?rankBy=volume&order=desc

# Output mode: stdout (console), jsonl (file), or webhook (HTTP POST)
mode: jsonl

# Optional: Filter trading pairs by criteria
filters:
  - type: liquidity
    params:
      minUsd: 50000  # Minimum liquidity in USD
  - type: volume
    params:
      period: h24  # m5, h1, h6, h24
      minUsd: 100000  # Minimum 24h volume

# Optional: Transform output data
transforms:
  fields:  # Select only these fields
    - chainId
    - baseToken.symbol
    - quoteToken.symbol
    - priceUsd
    - volume.h24
    - liquidity.usd
  aliases:  # Rename fields
    baseToken.symbol: base
    quoteToken.symbol: quote
    priceUsd: price

# Optional: Output management
output:
  compression:
    enabled: true  # Gzip compression for JSONL/webhook
    level: 6  # Compression level (1-9)
  rotation:  # For JSONL mode
    maxSizeMB: 100  # Rotate when file exceeds size
    interval: hourly  # Or: daily
    keepFiles: 24  # Keep last 24 rotated files
  batching:  # For webhook mode
    maxSize: 50  # Events per batch
    maxWaitMs: 5000  # Max wait time before flush
  throttling:
    maxPerSecond: 100  # Rate limit
    dropStrategy: oldest  # oldest, newest, random
  sampling:
    rate: 100  # Process 100% of events (0-100)

# Optional: Monitoring and observability
monitoring:
  healthPort: 3001  # HTTP health check endpoint
  metricsPort: 9090  # Prometheus metrics endpoint
  logLevel: info  # error, warn, info, debug
  logFormat: json  # text or json
  performance: true  # Track performance metrics
  alerts:  # Alert thresholds
    - metric: events_per_second
      threshold: 1
      comparison: lt  # lt (less than), gt, eq
```

**YAML Benefits:**
- More readable with comments
- Less verbose (no quotes or commas required)
- Better for human editing
- Supports multi-line strings


### Profile Creation and Usage

Profiles allow you to define multiple configurations for different environments (development, staging, production) in a single file. This eliminates the need for separate configuration files per environment.

#### Creating Profiles

Add a `profiles` section to your configuration file with named profile objects:

**`.dexrtrc.json` with profiles:**
```json
{
  "baseUrl": "https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor",
  "apiToken": "apify_api_xxxxxxxxxxxxx",
  "pageUrls": ["https://dexscreener.com/solana"],
  "mode": "stdout",
  
  "profiles": {
    "dev": {
      "name": "dev",
      "baseUrl": "https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor",
      "apiToken": "apify_api_xxxxxxxxxxxxx",
      "pageUrls": ["https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc"],
      "mode": "stdout",
      "monitoring": {
        "logLevel": "debug",
        "logFormat": "text"
      }
    },
    "staging": {
      "name": "staging",
      "baseUrl": "https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor",
      "apiToken": "apify_api_xxxxxxxxxxxxx",
      "pageUrls": [
        "https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc",
        "https://dexscreener.com/ethereum?rankBy=volume&order=desc"
      ],
      "mode": "jsonl",
      "output": {
        "compression": { "enabled": true },
        "rotation": { "maxSizeMB": 50, "interval": "hourly" }
      },
      "monitoring": {
        "healthPort": 3001,
        "logLevel": "info",
        "logFormat": "json"
      }
    },
    "prod": {
      "name": "prod",
      "baseUrl": "https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor",
      "apiToken": "apify_api_xxxxxxxxxxxxx",
      "pageUrls": [
        "https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc&minLiq=10000",
        "https://dexscreener.com/ethereum?rankBy=volume&order=desc&minLiq=50000",
        "https://dexscreener.com/base?rankBy=trendingScoreH6&order=desc&minLiq=30000"
      ],
      "mode": "jsonl",
      "output": {
        "compression": { "enabled": true, "level": 9 },
        "rotation": { "maxSizeMB": 100, "interval": "daily", "keepFiles": 30 }
      },
      "monitoring": {
        "healthPort": 3000,
        "metricsPort": 9090,
        "logLevel": "warn",
        "logFormat": "json",
        "performance": true
      }
    }
  },
  
  "default": "dev"
}
```


#### Using Profiles

**Select a profile with the `--profile` flag:**

```bash
# Use development profile
node dist/cli.cjs --profile dev

# Use staging profile
node dist/cli.cjs --profile staging --jsonl-path ./staging-output.jsonl

# Use production profile
node dist/cli.cjs --profile prod --jsonl-path ./prod-output.jsonl
```

**Use default profile (if specified in config):**

```bash
# Uses the profile specified in "default" field
node dist/cli.cjs
```

**Override profile settings with CLI arguments:**

```bash
# Use prod profile but override log level
node dist/cli.cjs --profile prod --log-level debug

# Use staging profile but change mode to stdout
node dist/cli.cjs --profile staging --mode stdout
```

#### Profile Structure

Each profile must include:
- `name`: Profile identifier (string)
- `baseUrl`: Apify Actor base URL (string)
- `pageUrls`: Array of page URLs to monitor (string[])

Optional profile fields:
- `apiToken`: API token (can use env var instead)
- `mode`: Output mode
- `filters`: Filter configurations
- `transforms`: Transformation settings
- `output`: Output management settings
- `monitoring`: Monitoring configuration


### Configuration Validation

The CLI provides built-in validation to catch configuration errors before starting streams.

#### Validate Configuration File

Use the `--validate` flag to check your configuration without starting the stream:

```bash
node dist/cli.cjs --validate
```

**Successful validation output:**
```
✅ Configuration is valid

Configuration summary:
  Base URL: https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor
  Page URLs: 2
  Mode: jsonl
  Profiles: 3 (dev, staging, prod)
  Default profile: dev
```

**Failed validation output:**
```
❌ Configuration validation failed:

  [baseUrl] Invalid URL: http://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor. Must be a valid HTTPS URL.
    Suggestion: Use HTTPS URLs only. Example: https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor

  [pageUrls.0] Invalid URL: not-a-url. Must be a valid HTTPS URL.
    Suggestion: Use HTTPS URLs only. Example: https://dexscreener.com/solana

  [apiToken] Invalid API token format: invalid_token
    Suggestion: API token must start with "apify_api_". Check your APIFY_TOKEN environment variable.

  [monitoring.logLevel] Invalid enum value. Expected 'error' | 'warn' | 'info' | 'debug', received 'trace'
    Suggestion: Field "logLevel" should be one of: error, warn, info, debug
```


#### Validation Rules

The validator checks:

**URL Validation:**
- All URLs must use HTTPS protocol
- URLs must be properly formatted
- Base URL and page URLs are validated

**Token Validation:**
- API token must start with `apify_api_`
- Token format is verified

**Required Fields:**
- `baseUrl` is required (unless using profiles)
- `pageUrls` must have at least one URL (unless using profiles)
- Profile configurations must include required fields

**Type Validation:**
- All fields must match expected types
- Enum values must be from allowed sets
- Numeric values must be within valid ranges

**Schema Validation:**
- Configuration structure matches expected schema
- No unknown fields (warns but doesn't fail)
- Nested objects are properly structured

#### Validate Specific Profile

```bash
# Validate a specific profile
node dist/cli.cjs --profile prod --validate
```

This validates the merged configuration (base + profile + CLI args).


### Deployment Scenario Examples

Here are practical configuration examples for common deployment scenarios:

#### Scenario 1: Local Development

**Goal:** Quick testing with verbose output and debug logging.

**`.dexrtrc.json`:**
```json
{
  "baseUrl": "https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor",
  "apiToken": "apify_api_xxxxxxxxxxxxx",
  "pageUrls": ["https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc"],
  "mode": "stdout",
  "monitoring": {
    "logLevel": "debug",
    "logFormat": "text"
  }
}
```

**Usage:**
```bash
node dist/cli.cjs
```

**Features:**
- Outputs to console for immediate feedback
- Debug logging for troubleshooting
- Human-readable text format
- Single chain for faster testing


#### Scenario 2: Production Data Collection

**Goal:** Long-running data collection with compression, rotation, and monitoring.

**`.dexrtrc.json`:**
```json
{
  "baseUrl": "https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor",
  "apiToken": "apify_api_xxxxxxxxxxxxx",
  "pageUrls": [
    "https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc&minLiq=10000",
    "https://dexscreener.com/ethereum?rankBy=volume&order=desc&minLiq=50000",
    "https://dexscreener.com/base?rankBy=trendingScoreH6&order=desc&minLiq=30000"
  ],
  "mode": "jsonl",
  "filters": [
    {
      "type": "liquidity",
      "params": { "minUsd": 50000 }
    },
    {
      "type": "volume",
      "params": { "period": "h24", "minUsd": 100000 }
    }
  ],
  "output": {
    "compression": {
      "enabled": true,
      "level": 9
    },
    "rotation": {
      "maxSizeMB": 100,
      "interval": "daily",
      "keepFiles": 30
    }
  },
  "monitoring": {
    "healthPort": 3000,
    "metricsPort": 9090,
    "logLevel": "warn",
    "logFormat": "json",
    "performance": true
  }
}
```


**Usage:**
```bash
node dist/cli.cjs --jsonl-path /var/log/dexscreener/production.jsonl
```

**Features:**
- Multiple chains for comprehensive coverage
- Filters for high-liquidity, high-volume pairs only
- Maximum compression (level 9) to save disk space
- Daily rotation with 30-day retention
- Health and metrics endpoints for monitoring
- JSON logging for log aggregation systems
- Performance tracking enabled

**Monitoring:**
```bash
# Check health
curl http://localhost:3000/health

# View Prometheus metrics
curl http://localhost:9090/metrics
```


#### Scenario 3: Real-Time Webhook Integration

**Goal:** Forward events to a backend API with batching and retry logic.

**`.dexrtrc.json`:**
```json
{
  "baseUrl": "https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor",
  "apiToken": "apify_api_xxxxxxxxxxxxx",
  "pageUrls": [
    "https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc"
  ],
  "mode": "webhook",
  "transforms": {
    "fields": [
      "chainId",
      "pairAddress",
      "baseToken.symbol",
      "quoteToken.symbol",
      "priceUsd",
      "volume.h24",
      "liquidity.usd",
      "priceChange.h24"
    ],
    "aliases": {
      "baseToken.symbol": "base",
      "quoteToken.symbol": "quote",
      "priceUsd": "price",
      "volume.h24": "volume24h",
      "liquidity.usd": "liquidity",
      "priceChange.h24": "change24h"
    }
  },
  "output": {
    "compression": {
      "enabled": true
    },
    "batching": {
      "maxSize": 20,
      "maxWaitMs": 5000
    }
  },
  "monitoring": {
    "healthPort": 3001,
    "logLevel": "info",
    "logFormat": "json"
  }
}
```


**Usage:**
```bash
node dist/cli.cjs --webhook-url https://api.example.com/webhooks/dexscreener
```

**Features:**
- Webhook mode for real-time integration
- Field transformation to reduce payload size
- Field aliasing for cleaner API
- Batching (20 events or 5 seconds) to reduce HTTP requests
- Compression to reduce bandwidth
- Health endpoint for monitoring
- JSON logging for production

**Backend receives:**
```json
[
  {
    "streamId": "stream-1",
    "timestamp": 1705843200000,
    "event": {
      "pairs": [
        {
          "chainId": "solana",
          "pairAddress": "0x...",
          "base": "SOL",
          "quote": "USDC",
          "price": "123.45",
          "volume24h": 1500000,
          "liquidity": 850000,
          "change24h": 5.2
        }
      ]
    }
  }
]
```


#### Scenario 4: Multi-Environment with Profiles

**Goal:** Single configuration file for dev, staging, and production environments.

**`.dexrtrc.json`:**
```json
{
  "baseUrl": "https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor",
  "apiToken": "apify_api_xxxxxxxxxxxxx",
  "pageUrls": ["https://dexscreener.com/solana"],
  "mode": "stdout",
  
  "profiles": {
    "dev": {
      "name": "dev",
      "baseUrl": "https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor",
      "apiToken": "apify_api_xxxxxxxxxxxxx",
      "pageUrls": ["https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc"],
      "mode": "stdout",
      "monitoring": {
        "logLevel": "debug",
        "logFormat": "text"
      }
    },
    "staging": {
      "name": "staging",
      "baseUrl": "https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor",
      "apiToken": "apify_api_xxxxxxxxxxxxx",
      "pageUrls": [
        "https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc",
        "https://dexscreener.com/ethereum?rankBy=volume&order=desc"
      ],
      "mode": "jsonl",
      "output": {
        "compression": { "enabled": true },
        "rotation": { "maxSizeMB": 50, "interval": "hourly" }
      },
      "monitoring": {
        "healthPort": 3001,
        "metricsPort": 9091,
        "logLevel": "info",
        "logFormat": "json"
      }
    },
    "prod": {
      "name": "prod",
      "baseUrl": "https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor",
      "apiToken": "apify_api_xxxxxxxxxxxxx",
      "pageUrls": [
        "https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc&minLiq=10000",
        "https://dexscreener.com/ethereum?rankBy=volume&order=desc&minLiq=50000",
        "https://dexscreener.com/base?rankBy=trendingScoreH6&order=desc&minLiq=30000",
        "https://dexscreener.com/arbitrum?rankBy=volume&order=desc&minLiq=30000"
      ],
      "mode": "jsonl",
      "filters": [
        {
          "type": "liquidity",
          "params": { "minUsd": 50000 }
        },
        {
          "type": "volume",
          "params": { "period": "h24", "minUsd": 100000 }
        }
      ],
      "output": {
        "compression": { "enabled": true, "level": 9 },
        "rotation": { "maxSizeMB": 100, "interval": "daily", "keepFiles": 30 }
      },
      "monitoring": {
        "healthPort": 3000,
        "metricsPort": 9090,
        "logLevel": "warn",
        "logFormat": "json",
        "performance": true,
        "alerts": [
          {
            "metric": "events_per_second",
            "threshold": 1,
            "comparison": "lt"
          }
        ]
      }
    }
  },
  
  "default": "dev"
}
```


**Usage:**

```bash
# Development (uses default profile)
node dist/cli.cjs

# Staging
node dist/cli.cjs --profile staging --jsonl-path /var/log/staging.jsonl

# Production
node dist/cli.cjs --profile prod --jsonl-path /var/log/production.jsonl
```

**Environment Comparison:**

| Feature | Dev | Staging | Production |
|---------|-----|---------|------------|
| **Chains** | 1 (Solana) | 2 (Solana, Ethereum) | 4 (Solana, Ethereum, Base, Arbitrum) |
| **Output** | stdout | jsonl | jsonl |
| **Filters** | None | None | Liquidity + Volume |
| **Compression** | No | Yes | Yes (max level) |
| **Rotation** | No | Hourly (50MB) | Daily (100MB, 30 days) |
| **Log Level** | debug | info | warn |
| **Log Format** | text | json | json |
| **Health Check** | No | Yes (3001) | Yes (3000) |
| **Metrics** | No | Yes (9091) | Yes (9090) |
| **Performance** | No | No | Yes |
| **Alerts** | No | No | Yes |


#### Scenario 5: High-Frequency Trading (HFT)

**Goal:** Minimal latency with essential data only, no disk I/O.

**`.dexrtrc.json`:**
```json
{
  "baseUrl": "https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor",
  "apiToken": "apify_api_xxxxxxxxxxxxx",
  "pageUrls": [
    "https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc"
  ],
  "mode": "webhook",
  "transforms": {
    "fields": [
      "pairAddress",
      "priceUsd",
      "priceNative"
    ]
  },
  "output": {
    "compression": { "enabled": false },
    "batching": { "maxSize": 1, "maxWaitMs": 0 }
  },
  "monitoring": {
    "logLevel": "error",
    "logFormat": "json",
    "performance": false
  }
}
```

**Usage:**
```bash
node dist/cli.cjs --webhook-url http://localhost:8080/webhooks/dexscreener
```

**Features:**
- Webhook mode for immediate forwarding
- Minimal field selection (only price data)
- No compression (reduces CPU overhead)
- No batching (immediate send)
- Error-only logging (minimal overhead)
- No performance tracking (reduces overhead)
- Single chain for focused monitoring


#### Scenario 6: Data Analysis Pipeline

**Goal:** Collect comprehensive data with sampling for analysis.

**`.dexrtrc.json`:**
```json
{
  "baseUrl": "https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor",
  "apiToken": "apify_api_xxxxxxxxxxxxx",
  "pageUrls": [
    "https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc",
    "https://dexscreener.com/ethereum?rankBy=volume&order=desc",
    "https://dexscreener.com/base?rankBy=trendingScoreH6&order=desc",
    "https://dexscreener.com/arbitrum?rankBy=volume&order=desc",
    "https://dexscreener.com/polygon?rankBy=trendingScoreH6&order=desc"
  ],
  "mode": "jsonl",
  "output": {
    "compression": { "enabled": true, "level": 9 },
    "rotation": { "maxSizeMB": 200, "interval": "daily", "keepFiles": 90 },
    "sampling": { "rate": 50 }
  },
  "monitoring": {
    "healthPort": 3002,
    "metricsPort": 9092,
    "logLevel": "info",
    "logFormat": "json",
    "performance": true
  }
}
```

**Usage:**
```bash
node dist/cli.cjs --jsonl-path /data/dexscreener/analysis.jsonl
```

**Features:**
- 5 chains for comprehensive market coverage
- 50% sampling to reduce data volume
- Maximum compression for storage efficiency
- Large rotation size (200MB) for fewer files
- 90-day retention for historical analysis
- Full event data (no transformation)
- Performance tracking for optimization


### Configuration Best Practices

#### Security

**1. Never commit API tokens to version control:**

```bash
# Use environment variables
export APIFY_TOKEN=apify_api_xxxxxxxxxxxxx
node dist/cli.cjs

# Or use .env file (add to .gitignore)
echo "APIFY_TOKEN=apify_api_xxxxxxxxxxxxx" > .env
```

**2. Use separate tokens per environment:**

```json
{
  "profiles": {
    "dev": {
      "apiToken": "${DEV_APIFY_TOKEN}"
    },
    "prod": {
      "apiToken": "${PROD_APIFY_TOKEN}"
    }
  }
}
```

**3. Restrict file permissions:**

```bash
# Make config file readable only by owner
chmod 600 .dexrtrc.json
```

#### Performance

**1. Use appropriate compression levels:**
- Level 1-3: Fast compression, larger files (development)
- Level 6: Balanced (default)
- Level 9: Maximum compression, slower (production with storage constraints)

**2. Tune batching for webhook mode:**
- Small batches (1-10): Lower latency, more HTTP requests
- Large batches (50-100): Higher latency, fewer HTTP requests
- Balance based on your backend's capacity

**3. Use sampling for high-volume streams:**
```json
{
  "output": {
    "sampling": { "rate": 25 }
  }
}
```
Reduces load by 75% while maintaining statistical significance.


#### Maintainability

**1. Use profiles for environment-specific settings:**
- Keeps all configurations in one file
- Easy to compare settings across environments
- Reduces configuration drift

**2. Document your configuration:**
```yaml
# .dexrtrc.yaml with comments
# Production configuration for DexScreener monitoring
# Last updated: 2026-01-21
# Owner: Data Engineering Team

baseUrl: https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor
# ... rest of config
```

**3. Version control your configuration:**
```bash
git add .dexrtrc.yaml
git commit -m "Update production config: increase rotation size"
```

**4. Validate before deploying:**
```bash
# Always validate after changes
node dist/cli.cjs --validate

# Test with dry-run if available
node dist/cli.cjs --profile prod --validate
```

#### Monitoring

**1. Always enable health checks in production:**
```json
{
  "monitoring": {
    "healthPort": 3000,
    "metricsPort": 9090
  }
}
```

**2. Use JSON logging for production:**
```json
{
  "monitoring": {
    "logFormat": "json",
    "logLevel": "warn"
  }
}
```
Easier to parse with log aggregation tools (ELK, Splunk, etc.).

**3. Set up alerts for critical metrics:**
```json
{
  "monitoring": {
    "alerts": [
      {
        "metric": "events_per_second",
        "threshold": 1,
        "comparison": "lt"
      }
    ]
  }
}
```

---

## Advanced Features

This section covers advanced capabilities for production deployments, including detailed filtering, transformation, monitoring, and output management.

### Advanced Filtering

The filtering API allows you to select specific trading pairs based on multiple criteria. Filters can be combined with AND/OR logic for complex selection rules.

#### Multiple Criteria Filtering

Combine multiple filters to create sophisticated selection logic:

```typescript
import { DexScreenerStream, FilterBuilder } from './dist/index.js';

// Create individual filters
const chainFilter = FilterBuilder.chainFilter(['solana', 'ethereum']);
const liquidityFilter = FilterBuilder.liquidityFilter(100000); // Min $100k liquidity
const volumeFilter = FilterBuilder.volumeFilter('h24', 500000); // Min $500k 24h volume
const priceChangeFilter = FilterBuilder.priceChangeFilter('h1', 5); // Min 5% price change in 1h

// Combine with AND logic (all must pass)
const strictFilter = FilterBuilder.combineFilters(
  [chainFilter, liquidityFilter, volumeFilter, priceChangeFilter],
  'AND'
);

const stream = new DexScreenerStream({
  baseUrl: process.env.DEX_ACTOR_BASE!,
  apiToken: process.env.APIFY_TOKEN!,
  pageUrl: 'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc',
  streamId: 'strict-filter',
  
  onBatch: (event, { streamId }) => {
    const filteredPairs = event.pairs?.filter(pair => 
      strictFilter({ pair, event, streamId: streamId ?? 'unknown' })
    ) ?? [];
    
    console.log(`[${streamId}] ${filteredPairs.length}/${event.pairs?.length ?? 0} pairs passed strict filters`);
    
    for (const pair of filteredPairs) {
      const symbol = `${pair.baseToken?.symbol}/${pair.quoteToken?.symbol}`;
      const chain = pair.chainId;
      const liquidity = pair.liquidity?.usd?.toFixed(0) ?? 'N/A';
      const volume = pair.volume?.h24?.toFixed(0) ?? 'N/A';
      const change = pair.priceChange?.h1?.toFixed(2) ?? 'N/A';
      
      console.log(
        `✓ ${symbol} (${chain}) | ` +
        `Liq: $${liquidity} | Vol(24h): $${volume} | Change(1h): ${change}%`
      );
    }
  },
  
  onError: (error) => console.error('Error:', error),
});

stream.start();
```


#### OR Logic Filtering

Use OR logic to match pairs that satisfy at least one criterion:

```typescript
// Create filters for different high-value scenarios
const highLiquidityFilter = FilterBuilder.liquidityFilter(1000000); // $1M+ liquidity
const highVolumeFilter = FilterBuilder.volumeFilter('h24', 5000000); // $5M+ 24h volume
const bigMoverFilter = FilterBuilder.priceChangeFilter('h1', 20); // 20%+ price change

// Combine with OR logic (at least one must pass)
const opportunityFilter = FilterBuilder.combineFilters(
  [highLiquidityFilter, highVolumeFilter, bigMoverFilter],
  'OR'
);

const stream = new DexScreenerStream({
  // ... config
  onBatch: (event, { streamId }) => {
    const opportunities = event.pairs?.filter(pair => 
      opportunityFilter({ pair, event, streamId: streamId ?? 'unknown' })
    ) ?? [];
    
    console.log(`[${streamId}] Found ${opportunities.length} high-value opportunities`);
    
    for (const pair of opportunities) {
      const symbol = `${pair.baseToken?.symbol}/${pair.quoteToken?.symbol}`;
      const liquidity = pair.liquidity?.usd?.toFixed(0) ?? 'N/A';
      const volume = pair.volume?.h24?.toFixed(0) ?? 'N/A';
      const change = pair.priceChange?.h1?.toFixed(2) ?? 'N/A';
      
      // Identify which criteria matched
      const reasons = [];
      if ((pair.liquidity?.usd ?? 0) >= 1000000) reasons.push('High Liquidity');
      if ((pair.volume?.h24 ?? 0) >= 5000000) reasons.push('High Volume');
      if ((pair.priceChange?.h1 ?? 0) >= 20) reasons.push('Big Mover');
      
      console.log(
        `💎 ${symbol} | Liq: $${liquidity} | Vol: $${volume} | ` +
        `Change: ${change}% | Reasons: ${reasons.join(', ')}`
      );
    }
  },
});

stream.start();
```


#### Nested Filter Logic

Create complex filter hierarchies by nesting AND/OR combinations:

```typescript
// High-quality Solana pairs: (Solana) AND (High liquidity OR High volume)
const solanaFilter = FilterBuilder.chainFilter(['solana']);
const qualityFilter = FilterBuilder.combineFilters(
  [
    FilterBuilder.liquidityFilter(50000),
    FilterBuilder.volumeFilter('h24', 100000)
  ],
  'OR'
);

const highQualitySolanaFilter = FilterBuilder.combineFilters(
  [solanaFilter, qualityFilter],
  'AND'
);

// Trending pairs: (Price increase) AND (Volume spike)
const priceUpFilter = FilterBuilder.priceChangeFilter('h1', 10);
const volumeSpikeFilter = FilterBuilder.volumeFilter('h1', 50000);

const trendingFilter = FilterBuilder.combineFilters(
  [priceUpFilter, volumeSpikeFilter],
  'AND'
);

// Final filter: High-quality Solana OR Trending (any chain)
const finalFilter = FilterBuilder.combineFilters(
  [highQualitySolanaFilter, trendingFilter],
  'OR'
);

const stream = new DexScreenerStream({
  // ... config
  onBatch: (event, { streamId }) => {
    const selected = event.pairs?.filter(pair => 
      finalFilter({ pair, event, streamId: streamId ?? 'unknown' })
    ) ?? [];
    
    console.log(`[${streamId}] Selected ${selected.length} pairs with nested logic`);
  },
});
```

#### Custom Filter Functions

Create custom filters for specialized logic:

```typescript
// Custom filter: Pairs with specific token symbols
const customSymbolFilter = (ctx: FilterContext): boolean => {
  const { pair } = ctx;
  const baseSymbol = pair.baseToken?.symbol?.toUpperCase() ?? '';
  const quoteSymbol = pair.quoteToken?.symbol?.toUpperCase() ?? '';
  
  // Match pairs with USDC, USDT, or SOL as quote token
  const stableQuotes = ['USDC', 'USDT', 'SOL'];
  return stableQuotes.includes(quoteSymbol);
};

// Custom filter: Pairs with balanced liquidity distribution
const balancedLiquidityFilter = (ctx: FilterContext): boolean => {
  const { pair } = ctx;
  const liquidity = pair.liquidity?.usd ?? 0;
  const volume = pair.volume?.h24 ?? 0;
  
  // Require liquidity to be at least 2x the 24h volume
  return liquidity >= volume * 2;
};

// Combine custom filters with built-in filters
const combinedFilter = FilterBuilder.combineFilters(
  [
    FilterBuilder.chainFilter(['solana']),
    customSymbolFilter,
    balancedLiquidityFilter
  ],
  'AND'
);
```


### Advanced Transformation

The transformation API provides powerful field selection, aliasing, and nested field extraction capabilities.

#### Nested Field Transformation

Extract and reshape nested data structures:

```typescript
import { Transformer } from './dist/index.js';
import type { TransformConfig } from './dist/index.js';

// Select nested fields with dot notation
const nestedConfig: TransformConfig = {
  fields: [
    'chainId',
    'pairAddress',
    'baseToken.address',
    'baseToken.symbol',
    'baseToken.name',
    'quoteToken.address',
    'quoteToken.symbol',
    'quoteToken.name',
    'priceUsd',
    'priceNative',
    'volume.m5',
    'volume.h1',
    'volume.h6',
    'volume.h24',
    'priceChange.m5',
    'priceChange.h1',
    'priceChange.h6',
    'priceChange.h24',
    'liquidity.usd',
    'liquidity.base',
    'liquidity.quote',
    'txns.m5.buys',
    'txns.m5.sells',
    'txns.h1.buys',
    'txns.h1.sells',
    'txns.h24.buys',
    'txns.h24.sells'
  ]
};

const nestedTransformer = new Transformer(nestedConfig);

const stream = new DexScreenerStream({
  // ... config
  onBatch: (event, { streamId }) => {
    if (event.pairs && event.pairs.length > 0) {
      const transformedPairs = nestedTransformer.transformBatch(event.pairs);
      
      console.log(`[${streamId}] Transformed ${transformedPairs.length} pairs`);
      console.log('Sample transformed pair:');
      console.log(JSON.stringify(transformedPairs[0], null, 2));
    }
  },
});
```

**Output structure:**
```json
{
  "chainId": "solana",
  "pairAddress": "0x...",
  "baseToken": {
    "address": "0x...",
    "symbol": "SOL",
    "name": "Solana"
  },
  "quoteToken": {
    "address": "0x...",
    "symbol": "USDC",
    "name": "USD Coin"
  },
  "priceUsd": "123.45",
  "priceNative": "1.0",
  "volume": {
    "m5": 5000,
    "h1": 50000,
    "h6": 250000,
    "h24": 1000000
  },
  "priceChange": {
    "m5": 0.5,
    "h1": 2.3,
    "h6": 5.1,
    "h24": 8.7
  },
  "liquidity": {
    "usd": 850000,
    "base": 6500,
    "quote": 850000
  },
  "txns": {
    "m5": { "buys": 10, "sells": 8 },
    "h1": { "buys": 120, "sells": 95 },
    "h24": { "buys": 2500, "sells": 2100 }
  }
}
```


#### Field Aliasing for API Compatibility

Rename fields to match your application's schema or API requirements:

```typescript
const apiCompatibleConfig: TransformConfig = {
  fields: [
    'chainId',
    'pairAddress',
    'baseToken.symbol',
    'quoteToken.symbol',
    'priceUsd',
    'volume.h24',
    'priceChange.h24',
    'liquidity.usd',
    'txns.h24.buys',
    'txns.h24.sells'
  ],
  aliases: {
    'chainId': 'blockchain',
    'pairAddress': 'contract_address',
    'baseToken.symbol': 'base_symbol',
    'quoteToken.symbol': 'quote_symbol',
    'priceUsd': 'price_usd',
    'volume.h24': 'volume_24h',
    'priceChange.h24': 'price_change_24h',
    'liquidity.usd': 'liquidity_usd',
    'txns.h24.buys': 'buy_count_24h',
    'txns.h24.sells': 'sell_count_24h'
  }
};

const apiTransformer = new Transformer(apiCompatibleConfig);

const stream = new DexScreenerStream({
  // ... config
  onPair: (pair) => {
    const transformed = apiTransformer.transform(pair);
    
    // Send to your API with compatible field names
    console.log(JSON.stringify(transformed));
    // {
    //   "blockchain": "solana",
    //   "contract_address": "0x...",
    //   "base_symbol": "SOL",
    //   "quote_symbol": "USDC",
    //   "price_usd": "123.45",
    //   "volume_24h": 1000000,
    //   "price_change_24h": 8.7,
    //   "liquidity_usd": 850000,
    //   "buy_count_24h": 2500,
    //   "sell_count_24h": 2100
    // }
  },
});
```

#### Combining Filtering and Transformation

Use filters and transformers together for efficient data processing:

```typescript
// Create filter for high-value pairs
const highValueFilter = FilterBuilder.combineFilters(
  [
    FilterBuilder.liquidityFilter(100000),
    FilterBuilder.volumeFilter('h24', 500000)
  ],
  'AND'
);

// Create transformer for essential fields only
const essentialTransformer = new Transformer({
  fields: [
    'chainId',
    'baseToken.symbol',
    'quoteToken.symbol',
    'priceUsd',
    'volume.h24',
    'liquidity.usd'
  ],
  aliases: {
    'baseToken.symbol': 'base',
    'quoteToken.symbol': 'quote',
    'priceUsd': 'price',
    'volume.h24': 'volume',
    'liquidity.usd': 'liquidity'
  }
});

const stream = new DexScreenerStream({
  // ... config
  onBatch: (event, { streamId }) => {
    // Filter first
    const highValuePairs = event.pairs?.filter(pair => 
      highValueFilter({ pair, event, streamId: streamId ?? 'unknown' })
    ) ?? [];
    
    // Then transform
    const transformed = essentialTransformer.transformBatch(highValuePairs);
    
    console.log(`[${streamId}] Processed ${transformed.length} high-value pairs`);
    
    // Output compact, filtered data
    for (const pair of transformed) {
      console.log(JSON.stringify(pair));
    }
  },
});
```


### Monitoring Setup

The monitoring API provides comprehensive observability through metrics, health checks, structured logging, performance tracking, and alerting.

#### Prometheus Metrics Integration

Expose Prometheus-compatible metrics for monitoring and alerting:

```typescript
import { DexScreenerStream, MetricsCollector } from './dist/index.js';
import { createServer } from 'http';

// Create metrics collector
const metrics = new MetricsCollector();

// Create HTTP server for metrics endpoint
const metricsServer = createServer(async (req, res) => {
  if (req.url === '/metrics' && req.method === 'GET') {
    try {
      const metricsText = await metrics.getPrometheusMetrics();
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(metricsText);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error generating metrics');
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

metricsServer.listen(9090, () => {
  console.log('Metrics server listening on http://localhost:9090/metrics');
});

const stream = new DexScreenerStream({
  baseUrl: process.env.DEX_ACTOR_BASE!,
  apiToken: process.env.APIFY_TOKEN!,
  pageUrl: 'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc',
  streamId: 'monitored-stream',
  
  onBatch: (event, { streamId }) => {
    const startTime = Date.now();
    const pairCount = event.pairs?.length ?? 0;
    
    // Process pairs...
    console.log(`[${streamId}] Received ${pairCount} pairs`);
    
    // Record metrics
    const duration = Date.now() - startTime;
    metrics.recordEvent(streamId ?? 'unknown', pairCount, duration);
    metrics.updateMemoryUsage();
  },
  
  onStateChange: (state, { streamId }) => {
    console.log(`[${streamId}] State: ${state}`);
    metrics.recordConnectionState(streamId ?? 'unknown', state);
  },
  
  onError: (error) => console.error('Error:', error),
});

stream.start();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  stream.stop();
  metricsServer.close();
  process.exit(0);
});
```

**Prometheus metrics output (http://localhost:9090/metrics):**
```
# HELP dexscreener_events_received_total Total number of events received per stream
# TYPE dexscreener_events_received_total counter
dexscreener_events_received_total{streamId="monitored-stream"} 150

# HELP dexscreener_pairs_processed_total Total number of pairs processed per stream
# TYPE dexscreener_pairs_processed_total counter
dexscreener_pairs_processed_total{streamId="monitored-stream"} 7500

# HELP dexscreener_event_processing_duration_ms Event processing duration in milliseconds
# TYPE dexscreener_event_processing_duration_ms histogram
dexscreener_event_processing_duration_ms_bucket{le="1",streamId="monitored-stream"} 10
dexscreener_event_processing_duration_ms_bucket{le="5",streamId="monitored-stream"} 45
dexscreener_event_processing_duration_ms_bucket{le="10",streamId="monitored-stream"} 120
dexscreener_event_processing_duration_ms_bucket{le="+Inf",streamId="monitored-stream"} 150

# HELP dexscreener_connection_state Current connection state
# TYPE dexscreener_connection_state gauge
dexscreener_connection_state{streamId="monitored-stream"} 2

# HELP dexscreener_memory_usage_bytes Current memory usage in bytes
# TYPE dexscreener_memory_usage_bytes gauge
dexscreener_memory_usage_bytes 52428800
```


**Grafana Dashboard Configuration:**

Create a Grafana dashboard to visualize these metrics:

1. Add Prometheus as a data source in Grafana
2. Create panels with these queries:

```promql
# Events per second
rate(dexscreener_events_received_total[1m])

# Average processing duration
rate(dexscreener_event_processing_duration_ms_sum[5m]) / rate(dexscreener_event_processing_duration_ms_count[5m])

# Connection state (2 = connected)
dexscreener_connection_state

# Memory usage in MB
dexscreener_memory_usage_bytes / 1024 / 1024

# Total pairs processed
dexscreener_pairs_processed_total
```

#### Health Check Integration

Implement health checks for load balancers and orchestration systems:

```typescript
import { DexScreenerMultiStream, HealthChecker } from './dist/index.js';

// Create health checker on port 3000
const healthChecker = new HealthChecker(3000);
healthChecker.start();

console.log('Health check endpoint: http://localhost:3000/health');

const multi = new DexScreenerMultiStream({
  baseUrl: process.env.DEX_ACTOR_BASE!,
  apiToken: process.env.APIFY_TOKEN!,
  streams: [
    { id: 'solana', pageUrl: 'https://dexscreener.com/solana' },
    { id: 'ethereum', pageUrl: 'https://dexscreener.com/ethereum' },
    { id: 'base', pageUrl: 'https://dexscreener.com/base' },
  ],
  
  onBatch: (event, { streamId }) => {
    const id = streamId ?? 'unknown';
    
    // Update health status
    healthChecker.updateStreamHealth(id, {
      state: 'connected',
      lastEventAt: Date.now(),
      eventsReceived: event.pairs?.length ?? 0
    });
    
    console.log(`[${id}] Received ${event.pairs?.length ?? 0} pairs`);
  },
  
  onStateChange: (state, { streamId }) => {
    const id = streamId ?? 'unknown';
    
    // Update health status on state change
    healthChecker.updateStreamHealth(id, {
      state,
      lastEventAt: Date.now(),
      eventsReceived: 0
    });
    
    console.log(`[${id}] State: ${state}`);
  },
  
  onError: (error, { streamId }) => {
    const id = streamId ?? 'unknown';
    
    // Mark as unhealthy on error
    healthChecker.updateStreamHealth(id, {
      state: 'disconnected',
      lastEventAt: Date.now(),
      eventsReceived: 0
    });
    
    console.error(`[${id}] Error:`, error);
  },
});

multi.startAll();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  multi.stopAll();
  healthChecker.stop();
  process.exit(0);
});
```

**Health check response (http://localhost:3000/health):**

**Healthy (200 OK):**
```json
{
  "status": "healthy",
  "streams": {
    "solana": {
      "state": "connected",
      "lastEventAt": 1705843200000,
      "eventsReceived": 50
    },
    "ethereum": {
      "state": "connected",
      "lastEventAt": 1705843199000,
      "eventsReceived": 45
    },
    "base": {
      "state": "connected",
      "lastEventAt": 1705843198000,
      "eventsReceived": 38
    }
  },
  "uptime": 3600
}
```

**Degraded (200 OK):**
```json
{
  "status": "degraded",
  "streams": {
    "solana": {
      "state": "connected",
      "lastEventAt": 1705843200000,
      "eventsReceived": 50
    },
    "ethereum": {
      "state": "reconnecting",
      "lastEventAt": 1705843180000,
      "eventsReceived": 0
    },
    "base": {
      "state": "connected",
      "lastEventAt": 1705843198000,
      "eventsReceived": 38
    }
  },
  "uptime": 3600
}
```

**Unhealthy (503 Service Unavailable):**
```json
{
  "status": "unhealthy",
  "streams": {
    "solana": {
      "state": "disconnected",
      "lastEventAt": 1705843100000,
      "eventsReceived": 0
    },
    "ethereum": {
      "state": "disconnected",
      "lastEventAt": 1705843095000,
      "eventsReceived": 0
    },
    "base": {
      "state": "disconnected",
      "lastEventAt": 1705843090000,
      "eventsReceived": 0
    }
  },
  "uptime": 3600
}
```


**Kubernetes Liveness and Readiness Probes:**

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: dexscreener-client
spec:
  containers:
  - name: client
    image: dexscreener-client:latest
    ports:
    - containerPort: 3000
      name: health
    livenessProbe:
      httpGet:
        path: /health
        port: 3000
      initialDelaySeconds: 30
      periodSeconds: 10
      timeoutSeconds: 5
      failureThreshold: 3
    readinessProbe:
      httpGet:
        path: /health
        port: 3000
      initialDelaySeconds: 10
      periodSeconds: 5
      timeoutSeconds: 3
      successThreshold: 1
      failureThreshold: 3
```

#### Structured Logging

Implement structured logging for production environments:

```typescript
import { DexScreenerStream, StructuredLogger } from './dist/index.js';

// Create logger with JSON format for production
const logger = new StructuredLogger('info', 'json');

const stream = new DexScreenerStream({
  baseUrl: process.env.DEX_ACTOR_BASE!,
  apiToken: process.env.APIFY_TOKEN!,
  pageUrl: 'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc',
  streamId: 'logged-stream',
  
  onBatch: (event, { streamId }) => {
    const pairCount = event.pairs?.length ?? 0;
    
    logger.info('Batch received', {
      streamId,
      pairCount,
      hasStats: !!event.stats
    });
    
    // Log high-value pairs
    const highValuePairs = event.pairs?.filter(p => 
      (p.liquidity?.usd ?? 0) > 1000000
    ) ?? [];
    
    if (highValuePairs.length > 0) {
      logger.info('High-value pairs detected', {
        streamId,
        count: highValuePairs.length,
        symbols: highValuePairs.map(p => p.baseToken?.symbol).slice(0, 5)
      });
    }
  },
  
  onStateChange: (state, { streamId }) => {
    logger.info('Connection state changed', {
      streamId,
      state,
      timestamp: Date.now()
    });
  },
  
  onError: (error, { streamId }) => {
    logger.error('Stream error occurred', {
      streamId,
      errorType: error instanceof Error ? error.constructor.name : 'Unknown'
    }, error instanceof Error ? error : undefined);
  },
});

stream.start();
logger.info('Stream started', { streamId: 'logged-stream' });
```

**JSON log output:**
```json
{"timestamp":"2026-01-21T10:30:00.000Z","level":"info","message":"Stream started","context":{"streamId":"logged-stream"}}
{"timestamp":"2026-01-21T10:30:01.000Z","level":"info","message":"Connection state changed","context":{"streamId":"logged-stream","state":"connecting","timestamp":1705843801000}}
{"timestamp":"2026-01-21T10:30:02.000Z","level":"info","message":"Connection state changed","context":{"streamId":"logged-stream","state":"connected","timestamp":1705843802000}}
{"timestamp":"2026-01-21T10:30:05.000Z","level":"info","message":"Batch received","context":{"streamId":"logged-stream","pairCount":50,"hasStats":true}}
{"timestamp":"2026-01-21T10:30:05.100Z","level":"info","message":"High-value pairs detected","context":{"streamId":"logged-stream","count":3,"symbols":["SOL","ETH","BTC"]}}
```

**Text log output (for development):**

```typescript
// Create logger with text format for development
const devLogger = new StructuredLogger('debug', 'text');
```

```
[2026-01-21T10:30:00.000Z] INFO  Stream started {"streamId":"logged-stream"}
[2026-01-21T10:30:01.000Z] INFO  Connection state changed {"streamId":"logged-stream","state":"connecting","timestamp":1705843801000}
[2026-01-21T10:30:02.000Z] INFO  Connection state changed {"streamId":"logged-stream","state":"connected","timestamp":1705843802000}
[2026-01-21T10:30:05.000Z] INFO  Batch received {"streamId":"logged-stream","pairCount":50,"hasStats":true}
[2026-01-21T10:30:05.100Z] INFO  High-value pairs detected {"streamId":"logged-stream","count":3,"symbols":["SOL","ETH","BTC"]}
```


**Log Levels:**

| Level | Priority | Use Case |
|-------|----------|----------|
| `error` | 0 (highest) | Critical errors that require immediate attention |
| `warn` | 1 | Warning conditions that should be reviewed |
| `info` | 2 | Informational messages about normal operations |
| `debug` | 3 (lowest) | Detailed diagnostic information for troubleshooting |

**Integration with Log Aggregation Systems:**

The JSON format is compatible with popular log aggregation tools:

- **ELK Stack (Elasticsearch, Logstash, Kibana)**: Parse JSON logs with Logstash
- **Splunk**: Ingest JSON logs directly
- **Datadog**: Use the Datadog agent to collect JSON logs
- **CloudWatch Logs**: Stream JSON logs to AWS CloudWatch
- **Google Cloud Logging**: Send structured JSON logs

### Output Management

The output management API provides utilities for compression, file rotation, batching, throttling, and sampling.

#### Compression

Reduce storage and bandwidth usage with gzip compression:

```typescript
import { DexScreenerStream, Compressor } from './dist/index.js';
import { writeFileSync, appendFileSync } from 'fs';

const outputFile = './compressed-output.jsonl.gz';

const stream = new DexScreenerStream({
  baseUrl: process.env.DEX_ACTOR_BASE!,
  apiToken: process.env.APIFY_TOKEN!,
  pageUrl: 'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc',
  streamId: 'compressed-stream',
  
  onBatch: async (event, { streamId }) => {
    const eventData = JSON.stringify({
      streamId,
      timestamp: Date.now(),
      event
    }) + '\n';
    
    // Compress data before writing
    const compressed = await Compressor.compress(eventData, 9); // Max compression
    
    // Append compressed data to file
    appendFileSync(outputFile, compressed);
    
    console.log(`[${streamId}] Compressed ${eventData.length} bytes to ${compressed.length} bytes`);
  },
  
  onError: (error) => console.error('Error:', error),
});

stream.start();
```

**Compression Levels:**

| Level | Speed | Compression Ratio | Use Case |
|-------|-------|-------------------|----------|
| 1 | Fastest | Lowest (~2-3x) | Real-time streaming, CPU-constrained |
| 6 | Balanced | Medium (~4-5x) | Default, general purpose |
| 9 | Slowest | Highest (~6-8x) | Archival, storage-constrained |

**Synchronous Compression (for small data):**

```typescript
import { Compressor } from './dist/index.js';

const data = JSON.stringify({ foo: 'bar' });
const compressed = Compressor.compressSync(data, 6);
```


#### File Rotation

Automatically rotate log files based on size or time intervals:

```typescript
import { DexScreenerStream, FileRotator } from './dist/index.js';

// Create file rotator with size and time-based rotation
const rotator = new FileRotator('./stream-output.jsonl', {
  maxSizeMB: 100,        // Rotate when file exceeds 100 MB
  interval: 'hourly',    // Also rotate every hour
  keepFiles: 24          // Keep last 24 rotated files
});

const stream = new DexScreenerStream({
  baseUrl: process.env.DEX_ACTOR_BASE!,
  apiToken: process.env.APIFY_TOKEN!,
  pageUrl: 'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc',
  streamId: 'rotated-stream',
  
  onBatch: (event, { streamId }) => {
    const eventData = JSON.stringify({
      streamId,
      timestamp: Date.now(),
      event
    }) + '\n';
    
    // Write to rotator (handles rotation automatically)
    rotator.write(eventData);
    
    console.log(`[${streamId}] Written to ${rotator.getCurrentPath()}`);
  },
  
  onError: (error) => console.error('Error:', error),
});

stream.start();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  stream.stop();
  rotator.close();
  process.exit(0);
});
```

**Rotation Strategies:**

**Size-based rotation:**
```typescript
const rotator = new FileRotator('./output.jsonl', {
  maxSizeMB: 50  // Rotate when file exceeds 50 MB
});
```

**Time-based rotation:**
```typescript
// Hourly rotation
const hourlyRotator = new FileRotator('./output.jsonl', {
  interval: 'hourly'
});

// Daily rotation
const dailyRotator = new FileRotator('./output.jsonl', {
  interval: 'daily'
});
```

**Combined rotation with cleanup:**
```typescript
const rotator = new FileRotator('./output.jsonl', {
  maxSizeMB: 100,      // Rotate at 100 MB
  interval: 'daily',   // Or daily, whichever comes first
  keepFiles: 7         // Keep only last 7 rotated files
});
```

**Rotated file naming:**
- Original: `stream-output.jsonl`
- Rotated: `stream-output.jsonl.2026-01-21T10-30-00-000Z`
- Rotated: `stream-output.jsonl.2026-01-21T11-30-00-000Z`


#### Batching

Batch multiple events together to reduce I/O operations or HTTP requests:

```typescript
import { DexScreenerStream, Batcher } from './dist/index.js';
import { writeFileSync } from 'fs';

// Create batcher that flushes every 50 events or 10 seconds
const batcher = new Batcher<any>(
  {
    maxSize: 50,
    maxWaitMs: 10000
  },
  (items) => {
    // Flush callback: write all batched items at once
    const batchData = items.map(item => JSON.stringify(item)).join('\n') + '\n';
    writeFileSync('./batched-output.jsonl', batchData, { flag: 'a' });
    console.log(`Flushed batch of ${items.length} events`);
  }
);

const stream = new DexScreenerStream({
  baseUrl: process.env.DEX_ACTOR_BASE!,
  apiToken: process.env.APIFY_TOKEN!,
  pageUrl: 'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc',
  streamId: 'batched-stream',
  
  onBatch: (event, { streamId }) => {
    // Add event to batcher
    batcher.add({
      streamId,
      timestamp: Date.now(),
      event
    });
    
    console.log(`[${streamId}] Added to batch (${batcher.size()}/${50})`);
  },
  
  onError: (error) => console.error('Error:', error),
});

stream.start();

// Graceful shutdown with final flush
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  stream.stop();
  batcher.flush(); // Flush remaining items
  batcher.destroy();
  process.exit(0);
});
```

**Batching for Webhook Delivery:**

```typescript
import { Batcher } from './dist/index.js';
import fetch from 'node-fetch';

const webhookBatcher = new Batcher<any>(
  {
    maxSize: 20,
    maxWaitMs: 5000
  },
  async (items) => {
    // Send batch to webhook
    try {
      const response = await fetch('https://api.example.com/webhooks/dexscreener {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(items)
      });
      
      if (response.ok) {
        console.log(`✓ Sent batch of ${items.length} events to webhook`);
      } else {
        console.error(`✗ Webhook failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('✗ Webhook error:', error);
    }
  }
);

const stream = new DexScreenerStream({
  // ... config
  onBatch: (event, { streamId }) => {
    webhookBatcher.add({
      streamId,
      timestamp: Date.now(),
      event
    });
  },
});
```

**Batching Benefits:**
- Reduces I/O operations (fewer file writes)
- Reduces HTTP requests (fewer webhook calls)
- Improves throughput for high-volume streams
- Reduces API rate limit pressure


#### Throttling

Limit the rate of event processing to prevent overwhelming downstream systems:

```typescript
import { DexScreenerStream, Throttler } from './dist/index.js';

// Create throttler: max 100 events per second, drop oldest when exceeded
const throttler = new Throttler<any>({
  maxPerSecond: 100,
  dropStrategy: 'oldest'
});

const stream = new DexScreenerStream({
  baseUrl: process.env.DEX_ACTOR_BASE!,
  apiToken: process.env.APIFY_TOKEN!,
  pageUrl: 'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc',
  streamId: 'throttled-stream',
  
  onBatch: (event, { streamId }) => {
    const pairs = event.pairs ?? [];
    
    for (const pair of pairs) {
      // Check if pair should be processed
      if (throttler.shouldProcess(pair)) {
        // Process pair
        const symbol = `${pair.baseToken?.symbol}/${pair.quoteToken?.symbol}`;
        console.log(`✓ Processing ${symbol}`);
      } else {
        // Pair was dropped due to rate limit
        const symbol = `${pair.baseToken?.symbol}/${pair.quoteToken?.symbol}`;
        console.log(`✗ Dropped ${symbol} (rate limit)`);
      }
    }
    
    // Log throttling stats
    const stats = throttler.getStats();
    console.log(`[${streamId}] Processed: ${stats.processed}, Dropped: ${stats.dropped}`);
  },
  
  onError: (error) => console.error('Error:', error),
});

stream.start();
```

**Drop Strategies:**

**1. Oldest (FIFO):**
```typescript
const throttler = new Throttler({
  maxPerSecond: 100,
  dropStrategy: 'oldest'  // Drop oldest items when limit exceeded
});
```
- Keeps newest data
- Good for real-time applications where recent data is more valuable

**2. Newest (LIFO):**
```typescript
const throttler = new Throttler({
  maxPerSecond: 100,
  dropStrategy: 'newest'  // Drop newest items when limit exceeded
});
```
- Keeps oldest data
- Good for ensuring all data gets processed eventually

**3. Random:**
```typescript
const throttler = new Throttler({
  maxPerSecond: 100,
  dropStrategy: 'random'  // Drop random items when limit exceeded
});
```
- Uniform distribution of dropped items
- Good for statistical sampling

**Monitoring Throttling:**

```typescript
// Periodically log throttling statistics
setInterval(() => {
  const stats = throttler.getStats();
  const dropRate = stats.total > 0 
    ? ((stats.dropped / stats.total) * 100).toFixed(2) 
    : 0;
  
  console.log(`Throttling stats: ${stats.processed} processed, ${stats.dropped} dropped (${dropRate}% drop rate)`);
  
  // Reset stats for next interval
  throttler.reset();
}, 60000); // Every minute
```


#### Sampling

Process only a percentage of events to reduce load:

```typescript
import { DexScreenerStream, Sampler } from './dist/index.js';

// Create sampler: process 25% of events
const sampler = new Sampler({
  rate: 25  // 0-100 percentage
});

const stream = new DexScreenerStream({
  baseUrl: process.env.DEX_ACTOR_BASE!,
  apiToken: process.env.APIFY_TOKEN!,
  pageUrl: 'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc',
  streamId: 'sampled-stream',
  
  onBatch: (event, { streamId }) => {
    // Check if this batch should be sampled
    if (sampler.shouldSample()) {
      console.log(`[${streamId}] ✓ Processing batch (${event.pairs?.length ?? 0} pairs)`);
      
      // Process pairs...
      for (const pair of event.pairs ?? []) {
        const symbol = `${pair.baseToken?.symbol}/${pair.quoteToken?.symbol}`;
        const price = pair.priceUsd ?? 'N/A';
        console.log(`  ${symbol}: ${price}`);
      }
    } else {
      console.log(`[${streamId}] ✗ Skipped batch (sampling)`);
    }
    
    // Log sampling stats
    const stats = sampler.getStats();
    console.log(
      `Sampling stats: ${stats.sampled}/${stats.total} ` +
      `(${stats.actualRate.toFixed(2)}% actual rate)`
    );
  },
  
  onError: (error) => console.error('Error:', error),
});

stream.start();
```

**Sampling Rates:**

| Rate | Use Case |
|------|----------|
| 100% | No sampling, process all events (default) |
| 50% | Reduce load by half, good for testing |
| 25% | Reduce load by 75%, statistical sampling |
| 10% | Minimal load, trend analysis only |
| 1% | Extreme load reduction, basic monitoring |

**Adaptive Sampling:**

Adjust sampling rate based on system load:

```typescript
import { Sampler } from './dist/index.js';

let currentRate = 100;
const sampler = new Sampler({ rate: currentRate });

// Monitor memory usage and adjust sampling
setInterval(() => {
  const memUsage = process.memoryUsage();
  const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
  
  if (heapUsedMB > 500) {
    // High memory usage, reduce sampling
    currentRate = Math.max(10, currentRate - 10);
    console.log(`⚠️  High memory (${heapUsedMB.toFixed(0)}MB), reducing sampling to ${currentRate}%`);
  } else if (heapUsedMB < 200 && currentRate < 100) {
    // Low memory usage, increase sampling
    currentRate = Math.min(100, currentRate + 10);
    console.log(`✓ Low memory (${heapUsedMB.toFixed(0)}MB), increasing sampling to ${currentRate}%`);
  }
  
  // Create new sampler with updated rate
  sampler.reset();
}, 30000); // Check every 30 seconds
```

**Sampling Statistics:**

```typescript
// Get detailed sampling statistics
const stats = sampler.getStats();

console.log(`Configured rate: ${sampler.getConfiguredRate()}%`);
console.log(`Actual rate: ${stats.actualRate.toFixed(2)}%`);
console.log(`Sampled: ${stats.sampled}`);
console.log(`Total: ${stats.total}`);
console.log(`Skipped: ${stats.total - stats.sampled}`);
```


#### Combined Output Management

Use multiple output management utilities together for production-grade data handling:

```typescript
import { 
  DexScreenerStream, 
  FileRotator, 
  Compressor, 
  Batcher, 
  Throttler, 
  Sampler 
} from './dist/index.js';

// Setup output management components
const sampler = new Sampler({ rate: 50 }); // Process 50% of events
const throttler = new Throttler({ maxPerSecond: 100, dropStrategy: 'oldest' });
const rotator = new FileRotator('./production-output.jsonl', {
  maxSizeMB: 100,
  interval: 'hourly',
  keepFiles: 24
});

const batcher = new Batcher<string>(
  { maxSize: 50, maxWaitMs: 10000 },
  async (items) => {
    // Compress batch before writing
    const batchData = items.join('\n') + '\n';
    const compressed = await Compressor.compress(batchData, 6);
    
    // Write compressed batch to rotated file
    rotator.write(compressed.toString('base64') + '\n');
    
    console.log(`Flushed ${items.length} events (compressed ${batchData.length} → ${compressed.length} bytes)`);
  }
);

const stream = new DexScreenerStream({
  baseUrl: process.env.DEX_ACTOR_BASE!,
  apiToken: process.env.APIFY_TOKEN!,
  pageUrl: 'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc',
  streamId: 'production-stream',
  
  onBatch: (event, { streamId }) => {
    // Step 1: Sampling (reduce load)
    if (!sampler.shouldSample()) {
      return;
    }
    
    // Step 2: Process pairs with throttling
    for (const pair of event.pairs ?? []) {
      if (!throttler.shouldProcess(pair)) {
        continue;
      }
      
      // Step 3: Add to batcher (will compress and rotate)
      const eventData = JSON.stringify({
        streamId,
        timestamp: Date.now(),
        pair
      });
      
      batcher.add(eventData);
    }
    
    // Log statistics
    const samplerStats = sampler.getStats();
    const throttlerStats = throttler.getStats();
    
    console.log(
      `[${streamId}] Sampled: ${samplerStats.actualRate.toFixed(1)}% | ` +
      `Throttled: ${throttlerStats.processed}/${throttlerStats.processed + throttlerStats.dropped} | ` +
      `Batched: ${batcher.size()}/50`
    );
  },
  
  onError: (error) => console.error('Error:', error),
});

stream.start();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  stream.stop();
  batcher.flush();
  batcher.destroy();
  rotator.close();
  
  // Final statistics
  console.log('\nFinal Statistics:');
  console.log('Sampler:', sampler.getStats());
  console.log('Throttler:', throttler.getStats());
  
  process.exit(0);
});
```

**Output Management Pipeline:**

```
Raw Events (100%)
    ↓
Sampling (50%)
    ↓
Throttling (100/sec)
    ↓
Batching (50 events or 10s)
    ↓
Compression (gzip level 6)
    ↓
File Rotation (100MB or hourly)
    ↓
Disk Storage
```

**Benefits of Combined Approach:**
- **Sampling**: Reduces overall load by 50%
- **Throttling**: Prevents burst overload (max 100/sec)
- **Batching**: Reduces I/O operations by 50x
- **Compression**: Reduces storage by ~5x
- **Rotation**: Manages disk space automatically

**Total Efficiency:**
- Load reduction: 50% (sampling)
- I/O reduction: 98% (batching)
- Storage reduction: 80% (compression)
- Automatic cleanup: Yes (rotation)

---


## Best Practices

This section covers production-ready patterns and recommendations for deploying and operating the DexScreener Realtime Client in production environments.

### Connection Management

#### Use Appropriate Retry Delays

Configure retry delays based on your use case and expected failure patterns:

```typescript
// Development: Fast retries for quick iteration
const devStream = new DexScreenerStream({
  // ... config
  retryMs: 1000  // 1 second
});

// Production: Longer delays to avoid overwhelming the server
const prodStream = new DexScreenerStream({
  // ... config
  retryMs: 5000  // 5 seconds
});

// High-availability: Exponential backoff for resilience
class ResilientStream {
  private retryCount = 0;
  private baseRetryMs = 2000;
  private maxRetryMs = 60000;
  
  private calculateRetryDelay(): number {
    const delay = Math.min(
      this.baseRetryMs * Math.pow(2, this.retryCount),
      this.maxRetryMs
    );
    this.retryCount++;
    return delay;
  }
}
```

**Recommendations:**
- Development: 1-3 seconds for fast feedback
- Production: 5-10 seconds to reduce server load
- High-traffic: Exponential backoff (2s, 4s, 8s, 16s, ...)
- Never use delays < 1 second in production

#### Configure Keep-Alive Appropriately

Keep-alive pings maintain long-running connections and detect network issues:

```typescript
// Default: 2 minutes (recommended for most use cases)
const stream = new DexScreenerStream({
  // ... config
  keepAliveMs: 120000  // 2 minutes
});

// Long-running: 5 minutes for stable connections
const longRunningStream = new DexScreenerStream({
  // ... config
  keepAliveMs: 300000  // 5 minutes
});

// Disable keep-alive (not recommended for production)
const noKeepAliveStream = new DexScreenerStream({
  // ... config
  keepAliveMs: 0  // Disabled
});
```

**Recommendations:**
- Use default (2 minutes) for most applications
- Increase to 5 minutes for very stable networks
- Never disable keep-alive in production
- Monitor connection state changes to detect issues

#### Handle Connection State Changes

Monitor connection state to implement custom logic:

```typescript
const stream = new DexScreenerStream({
  // ... config
  onStateChange: (state, { streamId }) => {
    switch (state) {
      case 'connecting':
        console.log(`[${streamId}] Establishing connection...`);
        // Optional: Show loading indicator
        break;
        
      case 'connected':
        console.log(`[${streamId}] Connected successfully`);
        // Optional: Clear error messages, reset retry counters
        break;
        
      case 'reconnecting':
        console.log(`[${streamId}] Connection lost, reconnecting...`);
        // Optional: Show reconnection indicator, alert monitoring
        break;
        
      case 'disconnected':
        console.log(`[${streamId}] Disconnected`);
        // Optional: Clean up resources, show offline indicator
        break;
    }
  }
});
```


### Error Handling Patterns

#### Categorize Errors by Type

Different errors require different handling strategies:

```typescript
const stream = new DexScreenerStream({
  // ... config
  onError: (error, { streamId }) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Authentication errors (don't retry)
    if (errorMessage.includes('Authentication failed') || 
        errorMessage.includes('Invalid or expired API token')) {
      console.error(`[${streamId}] ❌ Authentication error:`, errorMessage);
      console.error('Action required: Check your APIFY_TOKEN environment variable');
      // Stop stream, don't retry
      stream.stop();
      process.exit(1);
      return;
    }
    
    // Network errors (retry automatically)
    if (errorMessage.includes('ECONNREFUSED') || 
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('Network')) {
      console.warn(`[${streamId}] ⚠️  Network error:`, errorMessage);
      console.warn('Stream will retry automatically');
      // Let automatic retry handle it
      return;
    }
    
    // Server errors (retry with backoff)
    if (errorMessage.includes('500') || 
        errorMessage.includes('502') ||
        errorMessage.includes('503')) {
      console.warn(`[${streamId}] ⚠️  Server error:`, errorMessage);
      console.warn('Server may be temporarily unavailable');
      // Let automatic retry handle it
      return;
    }
    
    // Parse errors (log and continue)
    if (errorMessage.includes('JSON') || 
        errorMessage.includes('parse')) {
      console.error(`[${streamId}] ⚠️  Parse error:`, errorMessage);
      // Continue streaming, just log the error
      return;
    }
    
    // Unknown errors (log with full details)
    console.error(`[${streamId}] ❌ Unknown error:`, error);
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }
});
```

**Error Categories:**

| Category | Action | Retry? | Example |
|----------|--------|--------|---------|
| **Authentication** | Stop stream, fix credentials | No | Invalid API token |
| **Network** | Log warning, let retry | Yes | ECONNREFUSED, timeout |
| **Server** | Log warning, backoff | Yes | 500, 502, 503 |
| **Client** | Stop stream, fix config | No | 400, 404 |
| **Parse** | Log error, continue | N/A | Invalid JSON |
| **Unknown** | Log with stack trace | Depends | Unexpected errors |


#### Implement Circuit Breaker Pattern

Prevent cascading failures with circuit breaker logic:

```typescript
type CircuitState = 'closed' | 'open' | 'half-open';

class CircuitBreakerWrapper {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private failureThreshold = 5;
  private resetTimeoutMs = 60000;
  private resetTimer: NodeJS.Timeout | null = null;
  
  constructor(private stream: DexScreenerStream) {}
  
  onSuccess(): void {
    this.failureCount = 0;
    if (this.state === 'half-open') {
      console.log('Circuit breaker: CLOSED (recovered)');
      this.state = 'closed';
    }
  }
  
  onFailure(): void {
    this.failureCount++;
    
    if (this.state === 'closed' && this.failureCount >= this.failureThreshold) {
      console.log(`Circuit breaker: OPEN (${this.failureCount} failures)`);
      this.state = 'open';
      this.stream.stop();
      this.scheduleReset();
    } else if (this.state === 'half-open') {
      console.log('Circuit breaker: OPEN (still failing)');
      this.state = 'open';
      this.stream.stop();
      this.scheduleReset();
    }
  }
  
  private scheduleReset(): void {
    if (this.resetTimer) clearTimeout(this.resetTimer);
    
    this.resetTimer = setTimeout(() => {
      console.log('Circuit breaker: HALF-OPEN (testing)');
      this.state = 'half-open';
      this.failureCount = 0;
      this.stream.start();
    }, this.resetTimeoutMs);
  }
  
  getState(): CircuitState {
    return this.state;
  }
}
```

**When to use:**
- High-frequency failures (> 5 in short period)
- Cascading failures across multiple streams
- Protecting downstream systems from overload
- Production environments with strict SLAs


### Graceful Shutdown Patterns

#### Basic Graceful Shutdown

Always implement graceful shutdown to prevent data loss:

```typescript
class GracefulStreamManager {
  private stream: DexScreenerStream;
  private isShuttingDown = false;
  private pendingOperations: Promise<void>[] = [];
  
  constructor(config: DexStreamOptions) {
    this.stream = new DexScreenerStream({
      ...config,
      onBatch: (event, ctx) => {
        if (this.isShuttingDown) {
          console.log('Shutdown in progress, skipping batch');
          return;
        }
        
        // Track async operations
        const operation = this.processBatch(event);
        this.pendingOperations.push(operation);
      }
    });
  }
  
  private async processBatch(event: DexEvent): Promise<void> {
    // Your processing logic here
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  start(): void {
    this.stream.start();
  }
  
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    
    console.log('🛑 Initiating graceful shutdown...');
    this.isShuttingDown = true;
    
    // Step 1: Stop accepting new data
    this.stream.stop();
    
    // Step 2: Wait for pending operations
    console.log(`Waiting for ${this.pendingOperations.length} pending operations...`);
    await Promise.all(this.pendingOperations);
    
    // Step 3: Final cleanup
    console.log('✓ Graceful shutdown complete');
  }
}

// Usage
const manager = new GracefulStreamManager({ /* config */ });
manager.start();

process.on('SIGINT', async () => {
  await manager.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await manager.shutdown();
  process.exit(0);
});
```

**Shutdown Checklist:**
- ✅ Stop accepting new data first
- ✅ Wait for pending async operations
- ✅ Flush buffered data to disk/network
- ✅ Close file handles and network connections
- ✅ Save application state if needed
- ✅ Log shutdown completion
- ✅ Handle both SIGINT (Ctrl+C) and SIGTERM


#### Shutdown with Timeout

Prevent hanging on shutdown with timeout protection:

```typescript
async function shutdownWithTimeout(
  shutdownFn: () => Promise<void>,
  timeoutMs: number = 10000
): Promise<void> {
  const timeoutPromise = new Promise<void>((resolve) => {
    setTimeout(() => {
      console.warn(`⚠️  Shutdown timeout (${timeoutMs}ms) reached`);
      resolve();
    }, timeoutMs);
  });
  
  await Promise.race([shutdownFn(), timeoutPromise]);
}

// Usage
process.on('SIGINT', async () => {
  await shutdownWithTimeout(async () => {
    await manager.shutdown();
  }, 10000);
  process.exit(0);
});
```

**Timeout Recommendations:**
- Development: 5 seconds
- Production: 10-30 seconds
- Long-running operations: 60 seconds
- Never use infinite timeout

### Resource Cleanup Best Practices

#### Clean Up Timers and Intervals

Always clear timers to prevent memory leaks:

```typescript
class StreamWithTimers {
  private stream: DexScreenerStream;
  private statsInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  
  start(): void {
    this.stream.start();
    
    // Periodic statistics
    this.statsInterval = setInterval(() => {
      console.log('Stats:', this.getStats());
    }, 60000);
    
    // Health checks
    this.healthCheckInterval = setInterval(() => {
      this.checkHealth();
    }, 30000);
  }
  
  stop(): void {
    this.stream.stop();
    
    // Clean up timers
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
  
  private getStats() { /* ... */ }
  private checkHealth() { /* ... */ }
}
```


#### Close File Handles Properly

Ensure all file handles are closed on shutdown:

```typescript
import { createWriteStream, WriteStream } from 'fs';

class StreamWithFileOutput {
  private stream: DexScreenerStream;
  private outputStream: WriteStream | null = null;
  
  start(): void {
    this.outputStream = createWriteStream('./output.jsonl', { flags: 'a' });
    
    this.stream = new DexScreenerStream({
      // ... config
      onBatch: (event) => {
        if (this.outputStream) {
          this.outputStream.write(JSON.stringify(event) + '\n');
        }
      }
    });
    
    this.stream.start();
  }
  
  async stop(): Promise<void> {
    this.stream.stop();
    
    // Close file handle
    if (this.outputStream) {
      await new Promise<void>((resolve, reject) => {
        this.outputStream!.end((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      this.outputStream = null;
    }
  }
}
```

**Resource Cleanup Checklist:**
- ✅ Clear all timers (setTimeout, setInterval)
- ✅ Close file handles (WriteStream, ReadStream)
- ✅ Close network connections (HTTP clients, WebSockets)
- ✅ Unregister event listeners
- ✅ Release memory-intensive objects
- ✅ Flush buffered data

### Performance Optimization

#### Use Batching for I/O Operations

Reduce I/O overhead by batching writes:

```typescript
import { Batcher } from './dist/index.js';

const batcher = new Batcher<string>(
  { maxSize: 100, maxWaitMs: 5000 },
  (items) => {
    // Write all items at once
    const data = items.join('\n') + '\n';
    fs.appendFileSync('./output.jsonl', data);
  }
);

const stream = new DexScreenerStream({
  // ... config
  onPair: (pair) => {
    batcher.add(JSON.stringify(pair));
  }
});
```

**Batching Benefits:**
- Reduces system calls by 50-100x
- Improves throughput by 10-50x
- Reduces CPU usage
- Better for SSDs and network I/O


#### Filter Early, Transform Late

Apply filters before expensive operations:

```typescript
// ❌ Bad: Transform all pairs, then filter
const stream = new DexScreenerStream({
  // ... config
  onBatch: (event) => {
    const transformed = transformer.transformBatch(event.pairs ?? []);
    const filtered = transformed.filter(p => p.liquidity > 100000);
    // Process filtered...
  }
});

// ✅ Good: Filter first, then transform
const stream = new DexScreenerStream({
  // ... config
  onBatch: (event) => {
    const filtered = (event.pairs ?? []).filter(p => 
      (p.liquidity?.usd ?? 0) > 100000
    );
    const transformed = transformer.transformBatch(filtered);
    // Process transformed...
  }
});
```

**Performance Tips:**
- Filter before transformation (reduces work)
- Use sampling for high-volume streams
- Throttle processing to prevent overload
- Compress data before writing to disk
- Use connection pooling for webhooks

#### Monitor Memory Usage

Track and limit memory consumption:

```typescript
class MemoryMonitoredStream {
  private stream: DexScreenerStream;
  private memoryCheckInterval: NodeJS.Timeout | null = null;
  private maxHeapMB = 512;
  
  start(): void {
    this.stream.start();
    
    // Monitor memory every 30 seconds
    this.memoryCheckInterval = setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsedMB = usage.heapUsed / 1024 / 1024;
      
      console.log(`Memory: ${heapUsedMB.toFixed(0)}MB / ${this.maxHeapMB}MB`);
      
      if (heapUsedMB > this.maxHeapMB) {
        console.warn('⚠️  High memory usage detected');
        // Optional: Trigger garbage collection
        if (global.gc) {
          global.gc();
        }
      }
    }, 30000);
  }
  
  stop(): void {
    this.stream.stop();
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
  }
}
```

**Memory Management:**
- Monitor heap usage regularly
- Set memory limits (--max-old-space-size)
- Use streaming for large datasets
- Avoid accumulating data in memory
- Clear references to unused objects


### Security Best Practices

#### Protect API Tokens

Never expose API tokens in code or logs:

```typescript
// ❌ Bad: Hardcoded token
const stream = new DexScreenerStream({
  apiToken: 'apify_api_xxxxxxxxxxxxx',  // Never do this!
  // ...
});

// ✅ Good: Use environment variables
const stream = new DexScreenerStream({
  apiToken: process.env.APIFY_TOKEN!,
  // ...
});

// ✅ Good: Validate token format
function validateApiToken(token: string): void {
  if (!token || token.trim() === '') {
    throw new Error('API token is required');
  }
  
  if (!token.startsWith('apify_api_')) {
    throw new Error('Invalid API token format. Token must start with "apify_api_"');
  }
  
  if (token.length < 20) {
    throw new Error('API token appears to be invalid (too short)');
  }
}

const apiToken = process.env.APIFY_TOKEN!;
validateApiToken(apiToken);
```

**Token Security Checklist:**
- ✅ Store tokens in environment variables
- ✅ Use .env files (add to .gitignore)
- ✅ Never commit tokens to version control
- ✅ Rotate tokens regularly
- ✅ Use different tokens per environment
- ✅ Restrict token permissions if possible
- ✅ Redact tokens from logs

#### Sanitize Log Output

Prevent sensitive data leakage in logs:

```typescript
function sanitizeForLogging(data: any): any {
  const sanitized = { ...data };
  
  // Redact API tokens
  if (sanitized.apiToken) {
    sanitized.apiToken = '***REDACTED***';
  }
  
  // Redact sensitive fields
  const sensitiveFields = ['password', 'secret', 'key', 'token'];
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  }
  
  return sanitized;
}

// Usage
console.log('Config:', sanitizeForLogging(config));
```


#### Validate URLs

Always validate URLs to prevent injection attacks:

```typescript
function validateUrl(url: string, name: string): void {
  try {
    const parsed = new URL(url);
    
    // Require HTTPS
    if (parsed.protocol !== 'https:') {
      throw new Error(`${name} must use HTTPS protocol`);
    }
    
    // Validate hostname
    if (!parsed.hostname || parsed.hostname === 'localhost') {
      throw new Error(`${name} has invalid hostname`);
    }
    
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`${name} is not a valid URL: ${url}`);
    }
    throw error;
  }
}

// Usage
validateUrl(baseUrl, 'Base URL');
validateUrl(pageUrl, 'Page URL');
```

**Security Recommendations:**
- Always use HTTPS (never HTTP)
- Validate all user-provided URLs
- Sanitize URL parameters
- Use allowlists for trusted domains
- Implement rate limiting
- Monitor for suspicious activity

---

## Troubleshooting

This section provides solutions to common issues you may encounter when using the DexScreener Realtime Client.

### Connection Errors

#### Problem: "ECONNREFUSED" or "Connection refused"

**Symptoms:**
```
Error: connect ECONNREFUSED 127.0.0.1:443
```

**Causes:**
- Actor base URL is incorrect or unreachable
- Network firewall blocking outbound HTTPS
- DNS resolution failure
- Actor is not running

**Solutions:**

1. **Verify the base URL:**
```bash
# Test if the URL is reachable
curl -I https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor
```

2. **Check environment variables:**
```bash
# Print current values
echo $DEX_ACTOR_BASE
echo $APIFY_TOKEN

# Verify they're set correctly
cat .env
```

3. **Test network connectivity:**
```bash
# Test DNS resolution
nslookup muhammetakkurtt--dexscreener-realtime-monitor.apify.actor

# Test HTTPS connection
curl -v https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor
```

4. **Check firewall settings:**
- Ensure outbound HTTPS (port 443) is allowed
- Check corporate proxy settings
- Verify VPN is not blocking connections


#### Problem: "ETIMEDOUT" or "Connection timeout"

**Symptoms:**
```
Error: connect ETIMEDOUT
Stream will retry automatically
```

**Causes:**
- Slow network connection
- Server is overloaded
- Firewall dropping packets
- DNS resolution is slow

**Solutions:**

1. **Increase retry delay:**
```typescript
const stream = new DexScreenerStream({
  // ... config
  retryMs: 10000  // Increase to 10 seconds
});
```

2. **Check network latency:**
```bash
# Test latency to the server
ping muhammetakkurtt--dexscreener-realtime-monitor.apify.actor

# Test with curl
time curl -I https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor
```

3. **Use a different network:**
- Try a different WiFi network
- Use mobile hotspot
- Check if VPN improves connectivity

#### Problem: "ENOTFOUND" or "DNS lookup failed"

**Symptoms:**
```
Error: getaddrinfo ENOTFOUND muhammetakkurtt--dexscreener-realtime-monitor.apify.actor
```

**Causes:**
- DNS server is down or slow
- Hostname is misspelled
- Network has no internet access

**Solutions:**

1. **Verify hostname spelling:**
```typescript
// Correct hostname
const baseUrl = 'https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor';

// Common mistakes to avoid:
// ❌ 'https://muhammetakkurt--dexscreener-realtime-monitor.apify.actor' (one 't')
// ❌ 'https://muhammetakkurtt-dexscreener-realtime-monitor.apify.actor' (one dash)
```

2. **Test DNS resolution:**
```bash
# Test with different DNS servers
nslookup muhammetakkurtt--dexscreener-realtime-monitor.apify.actor 8.8.8.8
nslookup muhammetakkurtt--dexscreener-realtime-monitor.apify.actor 1.1.1.1
```

3. **Check internet connectivity:**
```bash
# Test basic connectivity
ping 8.8.8.8
ping google.com
```


### Authentication Errors

#### Problem: "Authentication failed" or 401 Unauthorized

**Symptoms:**
```
Error: Authentication failed: Invalid or expired API token. Please check your APIFY_TOKEN.
```

**Causes:**
- API token is missing or empty
- API token is invalid or expired
- API token has wrong format
- Environment variable not loaded

**Solutions:**

1. **Verify token is set:**
```bash
# Check if token is set
echo $APIFY_TOKEN

# Should output: apify_api_xxxxxxxxxxxxx
# If empty, token is not set
```

2. **Check .env file:**
```bash
# View .env file
cat .env

# Should contain:
# APIFY_TOKEN=apify_api_xxxxxxxxxxxxx
# DEX_ACTOR_BASE=https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor
```

3. **Verify token format:**
```typescript
const token = process.env.APIFY_TOKEN;

if (!token) {
  console.error('❌ APIFY_TOKEN is not set');
  process.exit(1);
}

if (!token.startsWith('apify_api_')) {
  console.error('❌ APIFY_TOKEN has invalid format');
  console.error('   Token should start with "apify_api_"');
  process.exit(1);
}

console.log('✓ Token format is valid');
```

4. **Get a new token:**
- Visit [Apify Console](https://console.apify.com/settings/integrations?fpr=muh)
- Navigate to Settings → Integrations
- Copy your API token
- Update .env file with new token

5. **Ensure dotenv is loaded:**
```typescript
// Add this at the top of your file
import 'dotenv/config';

// Or explicitly load
import dotenv from 'dotenv';
dotenv.config();
```


#### Problem: Token works in browser but not in code

**Causes:**
- Token has extra whitespace or quotes
- Token is truncated
- Environment variable not properly exported

**Solutions:**

1. **Check for whitespace:**
```bash
# View token with quotes to see whitespace
echo "[$APIFY_TOKEN]"

# Should be: [apify_api_xxxxxxxxxxxxx]
# Not: [ apify_api_xxxxxxxxxxxxx] (leading space)
# Not: [apify_api_xxxxxxxxxxxxx ] (trailing space)
```

2. **Remove quotes from .env:**
```bash
# ❌ Wrong (has quotes)
APIFY_TOKEN="apify_api_xxxxxxxxxxxxx"

# ✅ Correct (no quotes)
APIFY_TOKEN=apify_api_xxxxxxxxxxxxx
```

3. **Verify token length:**
```typescript
const token = process.env.APIFY_TOKEN;
console.log('Token length:', token?.length);
// Should be around 40-50 characters
```

### Configuration Errors

#### Problem: "Configuration file not found"

**Symptoms:**
```
Error: Configuration file not found
Searched: .dexrtrc.json, .dexrtrc.yaml, dexrt.config.json
```

**Causes:**
- Configuration file doesn't exist
- File is in wrong directory
- File has wrong name or extension

**Solutions:**

1. **Generate configuration file:**
```bash
node dist/cli.cjs --init
```

2. **Check current directory:**
```bash
# List configuration files
ls -la .dexrtrc* dexrt.config*

# Should show one of:
# .dexrtrc.json
# .dexrtrc.yaml
# dexrt.config.json
```

3. **Create configuration manually:**
```bash
# Create JSON config
cat > .dexrtrc.json << 'EOF'
{
  "baseUrl": "https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor",
  "apiToken": "apify_api_xxxxxxxxxxxxx",
  "pageUrls": ["https://dexscreener.com/solana"],
  "mode": "stdout"
}
EOF
```


#### Problem: "Configuration validation failed"

**Symptoms:**
```
❌ Configuration validation failed:
  [baseUrl] Invalid URL: http://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor. Must be a valid HTTPS URL.
  [pageUrls] At least one page URL is required
```

**Causes:**
- Required fields are missing
- URLs use HTTP instead of HTTPS
- Invalid field values

**Solutions:**

1. **Validate configuration:**
```bash
node dist/cli.cjs --validate
```

2. **Fix common validation errors:**
```json
{
  "baseUrl": "https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor",
  "apiToken": "apify_api_xxxxxxxxxxxxx",
  "pageUrls": [
    "https://dexscreener.com/solana"
  ],
  "mode": "stdout",
  "monitoring": {
    "logLevel": "info",
    "logFormat": "text"
  }
}
```

**Common Validation Issues:**

| Field | Issue | Fix |
|-------|-------|-----|
| `baseUrl` | Uses HTTP | Change to HTTPS |
| `pageUrls` | Empty array | Add at least one URL |
| `apiToken` | Missing | Add token from Apify Console |
| `mode` | Invalid value | Use: stdout, jsonl, or webhook |
| `logLevel` | Invalid value | Use: error, warn, info, or debug |

#### Problem: "Profile not found"

**Symptoms:**
```
Error: Profile 'production' not found in configuration
Available profiles: dev, staging
```

**Causes:**
- Profile name is misspelled
- Profile doesn't exist in config file
- Using wrong configuration file

**Solutions:**

1. **List available profiles:**
```bash
# View configuration file
cat .dexrtrc.json | jq '.profiles | keys'
```

2. **Check profile name:**
```bash
# ❌ Wrong
node dist/cli.cjs --profile prod

# ✅ Correct (if profile is named 'production')
node dist/cli.cjs --profile production
```

3. **Add missing profile:**
```json
{
  "profiles": {
    "dev": { /* ... */ },
    "staging": { /* ... */ },
    "production": {
      "name": "production",
      "baseUrl": "https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor",
      "apiToken": "apify_api_xxxxxxxxxxxxx",
      "pageUrls": ["https://dexscreener.com/solana"],
      "mode": "jsonl"
    }
  }
}
```


### Performance Issues

#### Problem: High memory usage

**Symptoms:**
```
Memory: 1024MB / 512MB
⚠️  High memory usage detected
```

**Causes:**
- Accumulating data in memory
- Not releasing references
- Memory leaks in callbacks
- Processing too much data at once

**Solutions:**

1. **Enable sampling:**
```typescript
const stream = new DexScreenerStream({
  // ... config
  onBatch: (event) => {
    // Process only 50% of events
    if (Math.random() > 0.5) return;
    
    // Process event...
  }
});
```

2. **Use streaming instead of accumulation:**
```typescript
// ❌ Bad: Accumulates in memory
const allPairs: Pair[] = [];
const stream = new DexScreenerStream({
  onPair: (pair) => {
    allPairs.push(pair);  // Memory grows indefinitely
  }
});

// ✅ Good: Process and discard
const stream = new DexScreenerStream({
  onPair: (pair) => {
    processPair(pair);  // Process immediately
    // pair is garbage collected after callback
  }
});
```

3. **Limit batch size:**
```typescript
const stream = new DexScreenerStream({
  onBatch: (event) => {
    // Process in smaller chunks
    const pairs = event.pairs ?? [];
    const chunkSize = 10;
    
    for (let i = 0; i < pairs.length; i += chunkSize) {
      const chunk = pairs.slice(i, i + chunkSize);
      processChunk(chunk);
    }
  }
});
```

4. **Increase Node.js memory limit:**
```bash
# Increase to 2GB
node --max-old-space-size=2048 dist/cli.cjs

# Increase to 4GB
node --max-old-space-size=4096 dist/cli.cjs
```

5. **Monitor and trigger garbage collection:**
```typescript
// Run with: node --expose-gc your-script.js
setInterval(() => {
  const usage = process.memoryUsage();
  const heapUsedMB = usage.heapUsed / 1024 / 1024;
  
  if (heapUsedMB > 512 && global.gc) {
    console.log('Triggering garbage collection...');
    global.gc();
  }
}, 30000);
```


#### Problem: High CPU usage

**Symptoms:**
- CPU usage consistently above 80%
- System becomes slow and unresponsive
- Other processes are affected

**Causes:**
- Processing too many events
- Expensive operations in callbacks
- Inefficient filtering or transformation
- JSON parsing overhead

**Solutions:**

1. **Use throttling:**
```typescript
import { Throttler } from './dist/index.js';

const throttler = new Throttler({
  maxPerSecond: 100,
  dropStrategy: 'oldest'
});

const stream = new DexScreenerStream({
  onPair: (pair) => {
    if (throttler.shouldProcess(pair)) {
      processPair(pair);
    }
  }
});
```

2. **Optimize filtering:**
```typescript
// ❌ Bad: Complex regex on every pair
const stream = new DexScreenerStream({
  onPair: (pair) => {
    if (/^(PEPE|DOGE|SHIB|BONK|WIF|FLOKI|SAMO)/i.test(pair.baseToken?.symbol ?? '')) {
      processPair(pair);
    }
  }
});

// ✅ Good: Simple string comparison
const memeTokens = new Set(['PEPE', 'DOGE', 'SHIB', 'BONK', 'WIF', 'FLOKI', 'SAMO']);
const stream = new DexScreenerStream({
  onPair: (pair) => {
    const symbol = pair.baseToken?.symbol?.toUpperCase();
    if (symbol && memeTokens.has(symbol)) {
      processPair(pair);
    }
  }
});
```

3. **Reduce transformation overhead:**
```typescript
// ❌ Bad: Transform every pair
const stream = new DexScreenerStream({
  onBatch: (event) => {
    const transformed = transformer.transformBatch(event.pairs ?? []);
    // Process all transformed pairs...
  }
});

// ✅ Good: Filter first, transform less
const stream = new DexScreenerStream({
  onBatch: (event) => {
    const filtered = (event.pairs ?? []).filter(p => 
      (p.liquidity?.usd ?? 0) > 100000
    );
    const transformed = transformer.transformBatch(filtered);
    // Process fewer transformed pairs
  }
});
```

4. **Use worker threads for heavy processing:**
```typescript
import { Worker } from 'worker_threads';

const worker = new Worker('./processor-worker.js');

const stream = new DexScreenerStream({
  onBatch: (event) => {
    // Offload heavy processing to worker thread
    worker.postMessage({ type: 'process', data: event });
  }
});

worker.on('message', (result) => {
  console.log('Processed:', result);
});
```


#### Problem: Slow file writes

**Symptoms:**
- File writes take several seconds
- Disk I/O is bottleneck
- System becomes unresponsive during writes

**Causes:**
- Writing to disk on every event
- Not using buffering
- Synchronous file operations
- Slow disk (HDD vs SSD)

**Solutions:**

1. **Use batching:**
```typescript
import { Batcher } from './dist/index.js';
import { appendFileSync } from 'fs';

const batcher = new Batcher<string>(
  { maxSize: 100, maxWaitMs: 5000 },
  (items) => {
    const data = items.join('\n') + '\n';
    appendFileSync('./output.jsonl', data);
  }
);

const stream = new DexScreenerStream({
  onPair: (pair) => {
    batcher.add(JSON.stringify(pair));
  }
});
```

2. **Use async file operations:**
```typescript
import { appendFile } from 'fs/promises';

const stream = new DexScreenerStream({
  onBatch: async (event) => {
    const data = JSON.stringify(event) + '\n';
    await appendFile('./output.jsonl', data);
  }
});
```

3. **Use compression:**
```typescript
import { Compressor } from './dist/index.js';

const stream = new DexScreenerStream({
  onBatch: async (event) => {
    const data = JSON.stringify(event) + '\n';
    const compressed = await Compressor.compress(data, 6);
    await appendFile('./output.jsonl.gz', compressed);
  }
});
```

#### Problem: No data received after connecting

**Symptoms:**
```
[stream-1] State: connecting
[stream-1] State: connected
(no further output)
```

**Causes:**
- DexScreener page has no active updates
- Page URL is incorrect
- Filters are too restrictive
- Stream is waiting for changes

**Solutions:**

1. **Verify page URL:**
```bash
# Open in browser to check if page exists
open "https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc"
```

2. **Try a more active page:**
```typescript
// Try Solana trending (usually very active)
const stream = new DexScreenerStream({
  pageUrl: 'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc',
  // ...
});
```

3. **Add debug logging:**
```typescript
const stream = new DexScreenerStream({
  // ... config
  onBatch: (event, { streamId }) => {
    console.log(`[${streamId}] Batch received:`, {
      pairCount: event.pairs?.length ?? 0,
      hasStats: !!event.stats,
      timestamp: event.timestamp
    });
  },
  onStateChange: (state, { streamId }) => {
    console.log(`[${streamId}] State changed to: ${state}`);
  }
});
```

4. **Check if filters are too restrictive:**
```typescript
// Temporarily remove filters to test
const stream = new DexScreenerStream({
  // ... config
  onBatch: (event) => {
    console.log('Received batch with', event.pairs?.length, 'pairs');
    // If you see output now, filters were too restrictive
  }
});
```


### Debugging Techniques

#### Enable Debug Logging

Get detailed information about stream operations:

```typescript
import { StructuredLogger } from './dist/index.js';

const logger = new StructuredLogger('debug', 'text');

const stream = new DexScreenerStream({
  // ... config
  onBatch: (event, { streamId }) => {
    logger.debug('Batch received', {
      streamId,
      pairCount: event.pairs?.length ?? 0,
      hasStats: !!event.stats,
      timestamp: event.timestamp
    });
  },
  onStateChange: (state, { streamId }) => {
    logger.debug('State changed', { streamId, state });
  },
  onError: (error, { streamId }) => {
    logger.error('Error occurred', { streamId }, error instanceof Error ? error : undefined);
  }
});
```

#### Inspect Raw Events

Log raw event data to understand structure:

```typescript
const stream = new DexScreenerStream({
  // ... config
  onBatch: (event) => {
    // Log first pair in detail
    if (event.pairs && event.pairs.length > 0) {
      console.log('First pair (full structure):');
      console.log(JSON.stringify(event.pairs[0], null, 2));
    }
    
    // Log event stats
    if (event.stats) {
      console.log('Event stats:');
      console.log(JSON.stringify(event.stats, null, 2));
    }
  }
});
```

#### Monitor Connection State

Track connection lifecycle:

```typescript
const stateHistory: Array<{ state: ConnectionState; timestamp: number }> = [];

const stream = new DexScreenerStream({
  // ... config
  onStateChange: (state, { streamId }) => {
    const timestamp = Date.now();
    stateHistory.push({ state, timestamp });
    
    console.log(`[${streamId}] State: ${state} at ${new Date(timestamp).toISOString()}`);
    
    // Calculate time in each state
    if (stateHistory.length > 1) {
      const prev = stateHistory[stateHistory.length - 2];
      const duration = timestamp - prev.timestamp;
      console.log(`  Previous state (${prev.state}) lasted ${duration}ms`);
    }
  }
});

// Print state history on shutdown
process.on('SIGINT', () => {
  console.log('\nConnection State History:');
  for (const entry of stateHistory) {
    console.log(`  ${new Date(entry.timestamp).toISOString()} - ${entry.state}`);
  }
  process.exit(0);
});
```


#### Measure Processing Performance

Track how long operations take:

```typescript
import { PerformanceMonitor } from './dist/index.js';

const perfMonitor = new PerformanceMonitor();

const stream = new DexScreenerStream({
  // ... config
  onBatch: (event, { streamId }) => {
    const startTime = Date.now();
    
    // Your processing logic
    processBatch(event);
    
    const duration = Date.now() - startTime;
    perfMonitor.recordOperation('batch_processing', duration);
    
    // Log slow operations
    if (duration > 100) {
      console.warn(`[${streamId}] Slow batch processing: ${duration}ms`);
    }
  }
});

// Print performance stats every minute
setInterval(() => {
  const stats = perfMonitor.getStats('batch_processing');
  console.log('Performance stats:', {
    count: stats.count,
    avgMs: stats.avgDuration.toFixed(2),
    minMs: stats.minDuration,
    maxMs: stats.maxDuration
  });
}, 60000);
```

#### Test with Mock Data

Test your processing logic without connecting:

```typescript
import type { DexEvent, Pair } from './dist/index.js';

// Create mock event
const mockEvent: DexEvent = {
  stats: {
    totalPairs: 1,
    avgVolume: 100000,
    avgLiquidity: 50000
  },
  pairs: [
    {
      chainId: 'solana',
      dexId: 'raydium',
      pairAddress: '0x123...',
      baseToken: {
        address: '0xabc...',
        symbol: 'SOL',
        name: 'Solana'
      },
      quoteToken: {
        address: '0xdef...',
        symbol: 'USDC',
        name: 'USD Coin'
      },
      priceUsd: '123.45',
      priceNative: '1.0',
      volume: {
        h24: 1000000,
        h6: 250000,
        h1: 50000,
        m5: 5000
      },
      liquidity: {
        usd: 500000,
        base: 4000,
        quote: 500000
      }
    } as Pair
  ],
  event_type: 'pairs',
  timestamp: Date.now()
};

// Test your processing logic
const ctx = { streamId: 'test-stream' };
onBatch(mockEvent, ctx);
```

#### Use Network Inspection Tools

Monitor network traffic to debug connection issues:

```bash
# macOS/Linux: Use tcpdump
sudo tcpdump -i any -n host muhammetakkurtt--dexscreener-realtime-monitor.apify.actor

# Windows: Use Wireshark or netsh
netsh trace start capture=yes
# ... run your application ...
netsh trace stop
```

#### Check Environment Variables

Verify all environment variables are loaded correctly:

```typescript
console.log('Environment Check:');
console.log('================');
console.log('DEX_ACTOR_BASE:', process.env.DEX_ACTOR_BASE ? '✓ Set' : '✗ Not set');
console.log('APIFY_TOKEN:', process.env.APIFY_TOKEN ? '✓ Set' : '✗ Not set');

if (process.env.APIFY_TOKEN) {
  const token = process.env.APIFY_TOKEN;
  console.log('Token format:', token.startsWith('apify_api_') ? '✓ Valid' : '✗ Invalid');
  console.log('Token length:', token.length, 'characters');
}

console.log('NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('================\n');
```

---

## Additional Resources

### Example Files

The `examples/` directory contains working examples for common use cases:

- `basic-sdk.ts` - Simple single-stream usage
- `multi-stream.ts` - Multiple streams simultaneously
- `filtering.ts` - Data filtering examples
- `transformation.ts` - Data transformation examples
- `graceful-shutdown.ts` - Graceful shutdown patterns
- `custom-retry.ts` - Custom retry strategies

### API Documentation

For detailed API reference, see [API.md](./API.md).

### Getting Help

If you encounter issues not covered in this guide:

1. Check the [GitHub Issues](https://github.com/muhammetakkurtt/dexscreener-realtime-client/issues)
2. Review example files in the `examples/` directory
3. Enable debug logging to get more information
4. Create a new issue with:
   - Error message and stack trace
   - Minimal reproduction code
   - Environment details (Node.js version, OS)
   - Configuration (with sensitive data redacted)

