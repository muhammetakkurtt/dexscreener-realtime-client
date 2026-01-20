# DexScreener Realtime Client

Node.js/TypeScript SDK and CLI for consuming SSE streams from the DexScreener Realtime Monitor Apify Actor. This client makes it easy to integrate real-time DexScreener data into your backends, bots, and data pipelines.

## Prerequisites

- Node.js 18.0.0 or higher
- Apify API Token ([get one here](https://apify.com?fpr=muh))

## Quick Start

1. Clone the repository:
```bash
git clone https://github.com/muhammetakkurtt/dexscreener-realtime-client.git
cd dexscreener-realtime-client
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

4. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your credentials
```

5. Run an example:
```bash
npx tsx examples/basic-sdk.ts
```

## Configuration

Create a `.env` file in the project root with the following variables:

| Variable | Description |
|----------|-------------|
| `APIFY_TOKEN` | Your Apify API token for authentication |
| `DEX_ACTOR_BASE` | Base URL for your DexScreener Realtime Monitor Actor |

Example:
```bash
APIFY_TOKEN=apify_api_xxxxxxxxxxxxx
DEX_ACTOR_BASE=https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor
```

## SDK Usage

### Basic Stream

Import from the local build and create a stream:

```typescript
import { DexScreenerStream } from './dist/index.js';

const stream = new DexScreenerStream({
  baseUrl: process.env.DEX_ACTOR_BASE!,
  apiToken: process.env.APIFY_TOKEN!,
  pageUrl: 'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc',
  streamId: 'solana-trending',
  
  onBatch: (event, { streamId }) => {
    console.log(`[${streamId}] Received ${event.pairs?.length ?? 0} pairs`);
  },
  
  onPair: (pair, { streamId }) => {
    console.log(`[${streamId}] ${pair.baseToken?.symbol}/${pair.quoteToken?.symbol} ${pair.priceUsd}`);
  },
  
  onError: (error, { streamId }) => {
    console.error(`[${streamId}] Error:`, error);
  },
  
  onStateChange: (state, { streamId }) => {
    console.log(`[${streamId}] State: ${state}`);
  },
});

stream.start();

// Stop when done
// stream.stop();
```

### Multi-Stream

Monitor multiple DexScreener pages simultaneously:

```typescript
import { DexScreenerMultiStream } from './dist/index.js';

const multi = new DexScreenerMultiStream({
  baseUrl: process.env.DEX_ACTOR_BASE!,
  apiToken: process.env.APIFY_TOKEN!,
  
  streams: [
    { id: 'solana-trending', pageUrl: 'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc' },
    { id: 'base-latest', pageUrl: 'https://dexscreener.com/base?rankBy=trendingScoreH6&order=desc&minLiq=30000' },
    { id: 'ethereum-volume', pageUrl: 'https://dexscreener.com/ethereum?rankBy=volume&order=desc' },
  ],
  
  onPair: (pair, { streamId }) => {
    console.log(`[${streamId}] ${pair.baseToken?.symbol} ${pair.priceUsd}`);
  },
});

multi.startAll();

// Stop all streams
// multi.stopAll();
```

See `examples/` directory for complete working examples.

## CLI Usage

After building the project, use the CLI to consume streams without writing code.

### stdout Mode (default)

Print JSON events to stdout:

```bash
node dist/cli.cjs \
  --base-url https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor \
  --api-token YOUR_TOKEN \
  --page-url "https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc"
```

Or using environment variable:

```bash
export APIFY_TOKEN=your_token
node dist/cli.cjs \
  --base-url https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor \
  --page-url "https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc"
```

### JSONL File Mode

Append events to a JSON Lines file:

```bash
node dist/cli.cjs \
  --base-url https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor \
  --page-url "https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc" \
  --mode jsonl \
  --jsonl-path ./events.jsonl
```

### Webhook Mode

Forward events to an HTTP endpoint:

```bash
node dist/cli.cjs \
  --base-url https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor \
  --page-url "https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc" \
  --mode webhook \
  --webhook-url https://your-backend.com/dex-events
```

### Multiple Streams

```bash
node dist/cli.cjs \
  --base-url https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor \
  --page-url "https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc" \
  --page-url "https://dexscreener.com/base?rankBy=trendingScoreH6&order=desc" \
  --page-url "https://dexscreener.com/ethereum?rankBy=trendingScoreH6&order=desc"
```

### CLI Options

| Option | Description | Required |
|--------|-------------|----------|
| `--base-url` | Apify Standby Actor base URL | Yes |
| `--api-token` | Apify API token (or use `APIFY_TOKEN` env) | Yes |
| `--page-url` | DexScreener page URL(s) to monitor | Yes |
| `--mode` | Output mode: `stdout`, `jsonl`, `webhook` | No (default: `stdout`) |
| `--jsonl-path` | File path for JSONL output | Required for `jsonl` mode |
| `--webhook-url` | Webhook URL for HTTP POST | Required for `webhook` mode |
| `--retry-ms` | Reconnection delay in ms | No (default: 3000) |
| `--keep-alive-ms` | Health check interval in ms | No (default: 120000, set to 0 to disable) |

## API Reference

### DexStreamOptions

```typescript
type DexStreamOptions = {
  baseUrl: string;           // Apify Standby Actor base URL
  apiToken: string;          // Apify API token
  pageUrl: string;           // DexScreener page URL
  streamId?: string;         // Optional stream identifier
  retryMs?: number;          // Reconnection delay (default: 3000)
  keepAliveMs?: number;      // Health check interval (default: 120000, set to 0 to disable)
  onBatch?: (event: DexEvent, ctx: StreamContext) => void;
  onPair?: (pair: Pair, ctx: StreamContext) => void;
  onError?: (error: unknown, ctx: StreamContext) => void;
  onStateChange?: (state: ConnectionState, ctx: StreamContext) => void;
};
```

### MultiStreamConfig

```typescript
type MultiStreamConfig = {
  baseUrl: string;
  apiToken: string;
  streams: Array<{ id: string; pageUrl: string }>;
  retryMs?: number;
  keepAliveMs?: number;
  onBatch?: (event: DexEvent, ctx: StreamContext) => void;
  onPair?: (pair: Pair, ctx: StreamContext) => void;
  onError?: (error: unknown, ctx: StreamContext) => void;
  onStateChange?: (state: ConnectionState, ctx: StreamContext) => void;
};
```

### DexEvent

```typescript
type DexEvent = {
  stats?: DexEventStats;
  pairs?: Pair[];
  event_type?: string;
  timestamp?: string;
};
```

### Pair

```typescript
type Pair = {
  chainId?: string;
  dexId?: string;
  pairAddress?: string;
  baseToken?: Token;
  quoteToken?: Token;
  price?: string;
  priceUsd?: string;
  txns?: Txns;
  volume?: Volume;
  priceChange?: PriceChange;
  liquidity?: Liquidity;
  marketCap?: number;
  fdv?: number;
  pairCreatedAt?: number;
};
```

### ConnectionState

```typescript
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
```

## Development

```bash
# Run tests
npm test

# Type check
npm run typecheck

# Watch mode for development
npm run dev
```
