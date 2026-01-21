# DexScreener Realtime Client

Node.js/TypeScript SDK and CLI for consuming SSE streams from the DexScreener Realtime Monitor Apify Actor. This client makes it easy to integrate real-time DexScreener data into your backends, bots, and data pipelines.

## Prerequisites

- Node.js 18.0.0 or higher
- Apify API Token ([get one here](https://console.apify.com/settings/integrations?fpr=muh))

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
  // Identity & Classification
  chainId?: string;              // Blockchain network (e.g., "solana", "ethereum")
  dexId?: string;                // DEX identifier (e.g., "raydium", "uniswap")
  pairAddress?: string;          // Unique pair contract address
  labels?: string[];             // Classification labels (e.g., ["CPMM"])
  
  // Token Information
  baseToken?: Token;             // Base token details
  quoteToken?: Token;            // Quote token details
  quoteTokenSymbol?: string;     // Quote token symbol (convenience field)
  
  // Pricing
  price?: string;                // Price in quote token
  priceUsd?: string;             // Price in USD
  priceChange?: PriceChange;     // Price changes over time periods
  
  // Trading Activity
  txns?: Txns;                   // Transaction counts (buys/sells)
  buyers?: UserCounts;           // Unique buyer counts over time periods (m5, h1, h6, h24)
  sellers?: UserCounts;          // Unique seller counts over time periods (m5, h1, h6, h24)
  makers?: UserCounts;           // Unique maker counts over time periods (m5, h1, h6, h24)
  
  // Volume Metrics
  volume?: Volume;               // Total trading volume over time periods
  volumeBuy?: Volume;            // Buy-side volume over time periods
  volumeSell?: Volume;           // Sell-side volume over time periods
  
  // Market Data
  liquidity?: Liquidity;         // Liquidity in USD, base, and quote tokens
  marketCap?: number;            // Market capitalization
  fdv?: number;                  // Fully diluted valuation
  
  // Metadata & Features
  pairCreatedAt?: number;        // Unix timestamp of pair creation
  profile?: Profile;             // Token profile information (eti, header, website, twitter, linkCount, imgKey)
  cmsProfile?: CmsProfile;       // CMS profile information (headerId, iconId, description, links, nsfw)
  isBoostable?: boolean;         // Whether pair can be boosted
  boosts?: Boosts;               // Active boost information
  launchpad?: Launchpad;         // Launchpad information (progress, creator, migrationDex, meta)
  
  // Additional Fields
  c?: string;                    // Additional metadata field
  a?: string;                    // Additional metadata field
  
  // Future Extensibility
  [key: string]: unknown;        // Allows access to new fields added by the API
};
```

#### Example DexEvent Structure

The SDK automatically parses SSE messages and delivers clean `DexEvent` objects to your callbacks. Here's what you receive in the `onBatch` callback:

```json
{
  "stats": {
    "m5": { "txns": 54923, "volumeUsd": 9045447.56 },
    "h1": { "txns": 756730, "volumeUsd": 134179114.12 },
    "h6": { "txns": 4880021, "volumeUsd": 1151490222.86 },
    "h24": { "txns": 19323940, "volumeUsd": 4377335189.87 }
  },
  "pairs": [
    {
      "chainId": "solana",
      "dexId": "raydium",
      "labels": ["CPMM"],
      "pairAddress": "EAf2Qn1kNix6gdiaEviWqzKwKtJUJTXTRT3nZLYcV9QY",
      "baseToken": {
        "address": "FT6ZnLbmaQbUmxbpe69qwRgPi9tU8QGY8S7gqt4Wbonk",
        "name": "BIG",
        "symbol": "BIG",
        "decimals": 6
      },
      "quoteToken": {
        "address": "USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB",
        "name": "World Liberty Financial USD",
        "symbol": "USD1",
        "decimals": 6
      },
      "quoteTokenSymbol": "USD1",
      "price": "0.001820",
      "priceUsd": "0.001820",
      "txns": {
        "m5": { "buys": 68, "sells": 28 },
        "h1": { "buys": 1333, "sells": 1064 },
        "h6": { "buys": 32404, "sells": 29022 },
        "h24": { "buys": 35242, "sells": 32222 }
      },
      "buyers": { "m5": 51, "h1": 622, "h6": 7600, "h24": 8290 },
      "sellers": { "m5": 27, "h1": 565, "h6": 6549, "h24": 6859 },
      "makers": { "m5": 76, "h1": 996, "h6": 8906, "h24": 9249 },
      "volume": { "m5": 9933.02, "h1": 296433.65, "h6": 9458621.98, "h24": 9981693.42 },
      "volumeBuy": { "m5": 4850, "h1": 144929.23, "h6": 4722534.19, "h24": 4996787.53 },
      "volumeSell": { "m5": 5083.01, "h1": 151504.42, "h6": 4736087.78, "h24": 4984905.89 },
      "priceChange": { "m5": -0.65, "h1": -8.89, "h6": 239, "h24": 2582 },
      "liquidity": { "usd": 151707.33, "base": 41663892, "quote": 75853 },
      "marketCap": 1820609,
      "fdv": 1820609,
      "pairCreatedAt": 1765041438000,
      "profile": {
        "eti": true,
        "header": true,
        "website": true,
        "twitter": true,
        "linkCount": 2,
        "imgKey": "2da648"
      },
      "cmsProfile": {
        "headerId": "4a2b4e6e0640ededdd9b3dab20d9f6900bddcc6878fe732d38c9f9cc80d98efc",
        "iconId": "82678f55db554c1d61b069daf596aeef6f1d665ee3a12f261b144c0326c9c17f",
        "description": "This is going to be $BIG",
        "links": [
          { "label": "Website", "url": "https://truthsocial.com/@unknown/posts/115673738803217830" },
          { "type": "twitter", "url": "https://x.com/i/communities/1997366922938126733" }
        ],
        "nsfw": false
      },
      "isBoostable": true,
      "c": "a",
      "a": "solamm"
    },
    {
      "chainId": "solana",
      "dexId": "pumpswap",
      "pairAddress": "8wXzwpLjk6QJMYYC1VHueNnxRVW2nFGvQjgEnV4Mv8sY",
      "baseToken": {
        "address": "CSrwNk6B1DwWCHRMsaoDVUfD5bBMQCJPY72ZG3Nnpump",
        "name": "Franklin The Turtle",
        "symbol": "Franklin",
        "decimals": 6
      },
      "quoteToken": {
        "address": "So11111111111111111111111111111111111111112",
        "name": "Wrapped SOL",
        "symbol": "SOL",
        "decimals": 9
      },
      "quoteTokenSymbol": "SOL",
      "price": "0.00007098",
      "priceUsd": "0.009336",
      "txns": {
        "m5": { "buys": 57, "sells": 54 },
        "h1": { "buys": 7924, "sells": 799 },
        "h6": { "buys": 13090, "sells": 5776 },
        "h24": { "buys": 37491, "sells": 28148 }
      },
      "buyers": { "m5": 49, "h1": 7196, "h6": 8713, "h24": 13450 },
      "sellers": { "m5": 46, "h1": 465, "h6": 2077, "h24": 6558 },
      "makers": { "m5": 94, "h1": 7543, "h6": 9818, "h24": 15675 },
      "volume": { "m5": 17675.25, "h1": 334508.48, "h6": 2505119.75, "h24": 12825807.97 },
      "volumeBuy": { "m5": 8714.96, "h1": 156717.8, "h6": 1242301.69, "h24": 6470078.63 },
      "volumeSell": { "m5": 8960.28, "h1": 177790.68, "h6": 1262818.06, "h24": 6355729.34 },
      "priceChange": { "m5": -0.34, "h1": -19.48, "h6": -22.12, "h24": 223 },
      "liquidity": { "usd": 403605.74, "base": 21566984, "quote": 1537.8354 },
      "marketCap": 9335780,
      "fdv": 9335780,
      "pairCreatedAt": 1764588851000,
      "profile": {
        "eti": true,
        "header": true,
        "website": true,
        "twitter": true,
        "linkCount": 2,
        "imgKey": "731b40"
      },
      "isBoostable": true,
      "c": "a",
      "a": "pumpfundex",
      "launchpad": {
        "progress": 100,
        "creator": "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
        "migrationDex": "pumpswap",
        "meta": { "id": "pumpfun" }
      }
    }
  ],
  "event_type": "pairs",
  "timestamp": "2026-01-21T08:28:36.113Z"
}
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
