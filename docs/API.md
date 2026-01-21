# DexScreener Realtime Client - API Reference

> **For practical examples and tutorials, see [GUIDE.md](./GUIDE.md)**

This document provides a complete technical reference for all classes, methods, types, and interfaces in the DexScreener Realtime Client SDK.

---

## Table of Contents

- [Core Streaming API](#core-streaming-api)
  - [DexScreenerStream](#dexscreenerstream)
  - [DexScreenerMultiStream](#dexscreenermultistream)
- [Data Types](#data-types)
- [Filtering API](#filtering-api)
- [Transformation API](#transformation-api)
- [Aggregation & Pipeline](#aggregation--pipeline)
- [Monitoring API](#monitoring-api)
- [Output Management](#output-management)
- [Configuration](#configuration)
- [Utilities](#utilities)

---

## Core Streaming API

### DexScreenerStream

Primary interface for consuming real-time data from a single DexScreener page.

#### Constructor

```typescript
new DexScreenerStream(options: DexStreamOptions)
```

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `baseUrl` | string | Yes | - | Apify Actor base URL |
| `pageUrl` | string | Yes | - | DexScreener page URL to monitor |
| `apiToken` | string | Yes | - | Apify API token |
| `streamId` | string | No | undefined | Unique identifier for this stream |
| `retryMs` | number | No | 3000 | Milliseconds to wait before reconnecting |
| `keepAliveMs` | number | No | 120000 | Milliseconds between keep-alive pings |
| `onBatch` | function | No | undefined | Callback for batch events |
| `onPair` | function | No | undefined | Callback for individual pairs |
| `onError` | function | No | undefined | Callback for errors |
| `onStateChange` | function | No | undefined | Callback for connection state changes |

**Callback Signatures:**

```typescript
onBatch?: (event: DexEvent, ctx: StreamContext) => void
onPair?: (pair: Pair, ctx: StreamContext) => void
onError?: (error: unknown, ctx: StreamContext) => void
onStateChange?: (state: ConnectionState, ctx: StreamContext) => void
```

**Example:**

```typescript
const stream = new DexScreenerStream({
  baseUrl: process.env.DEX_ACTOR_BASE!,
  pageUrl: 'https://dexscreener.com/solana',
  apiToken: process.env.APIFY_TOKEN!,
  onPair: (pair, ctx) => console.log(pair.baseToken?.symbol)
});
```

#### Methods

##### start()

```typescript
start(): void
```

Starts the SSE connection and begins receiving events.

##### stop()

```typescript
stop(): void
```

Stops the connection and cleans up resources.

##### getState()

```typescript
getState(): ConnectionState
```

Returns the current connection state: `'disconnected'` | `'connecting'` | `'connected'` | `'reconnecting'`

---

### DexScreenerMultiStream

Manages multiple DexScreener streams simultaneously.

#### Constructor

```typescript
new DexScreenerMultiStream(config: MultiStreamConfig)
```

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `baseUrl` | string | Yes | - | Apify Actor base URL (shared by all streams) |
| `apiToken` | string | Yes | - | Apify API token (shared by all streams) |
| `streams` | StreamConfig[] | Yes | - | Array of stream configurations |
| `retryMs` | number | No | 3000 | Retry delay for all streams |
| `keepAliveMs` | number | No | 120000 | Keep-alive interval for all streams |
| `onBatch` | function | No | undefined | Callback for batch events from any stream |
| `onPair` | function | No | undefined | Callback for pairs from any stream |
| `onError` | function | No | undefined | Callback for errors from any stream |
| `onStateChange` | function | No | undefined | Callback for state changes from any stream |

**StreamConfig Type:**

```typescript
type StreamConfig = {
  id: string;        // Unique identifier
  pageUrl: string;   // DexScreener page URL
}
```

**Example:**

```typescript
const multi = new DexScreenerMultiStream({
  baseUrl: process.env.DEX_ACTOR_BASE!,
  apiToken: process.env.APIFY_TOKEN!,
  streams: [
    { id: 'solana', pageUrl: 'https://dexscreener.com/solana' },
    { id: 'ethereum', pageUrl: 'https://dexscreener.com/ethereum' }
  ],
  onPair: (pair, ctx) => console.log(`[${ctx.streamId}] ${pair.baseToken?.symbol}`)
});
```

#### Methods

##### startAll()

```typescript
startAll(): void
```

Starts all configured streams.

##### stopAll()

```typescript
stopAll(): void
```

Stops all streams.

##### getStream()

```typescript
getStream(id: string): DexScreenerStream | undefined
```

Returns a specific stream by ID.

##### getStreamIds()

```typescript
getStreamIds(): string[]
```

Returns all stream IDs.

##### getStreamCount()

```typescript
getStreamCount(): number
```

Returns the total number of streams.

---

## Data Types

### Core Types

#### ConnectionState

```typescript
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
```

#### StreamContext

```typescript
type StreamContext = {
  streamId?: string;
};
```

#### DexEvent

```typescript
type DexEvent = {
  stats?: DexEventStats;
  pairs?: Pair[];
  event_type?: string;
  timestamp?: string;
  [key: string]: unknown;
};
```

#### Pair

```typescript
type Pair = {
  chainId?: string;
  dexId?: string;
  pairAddress?: string;
  baseToken?: Token;
  quoteToken?: Token;
  priceUsd?: string;
  priceNative?: string;
  txns?: Txns;
  volume?: Volume;
  priceChange?: PriceChange;
  liquidity?: Liquidity;
  marketCap?: number;
  fdv?: number;
  pairCreatedAt?: number;
  labels?: string[];
  buyers?: UserCounts;
  sellers?: UserCounts;
  makers?: UserCounts;
  volumeBuy?: Volume;
  volumeSell?: Volume;
  profile?: Profile;
  cmsProfile?: CmsProfile;
  boosts?: Boosts;
  launchpad?: Launchpad;
  [key: string]: unknown;
};
```

### Supporting Types

#### Token

```typescript
type Token = {
  address?: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  [key: string]: unknown;
};
```

#### Volume

```typescript
type Volume = {
  m5?: number | null;
  h1?: number | null;
  h6?: number | null;
  h24?: number | null;
  [key: string]: unknown;
};
```

#### Liquidity

```typescript
type Liquidity = {
  usd?: number | null;
  base?: number | null;
  quote?: number | null;
  [key: string]: unknown;
};
```

#### Txns

```typescript
type Txns = {
  m5?: { buys?: number; sells?: number };
  h1?: { buys?: number; sells?: number };
  h6?: { buys?: number; sells?: number };
  h24?: { buys?: number; sells?: number };
  [key: string]: unknown;
};
```

#### PriceChange

```typescript
type PriceChange = {
  m5?: number | null;
  h1?: number | null;
  h6?: number | null;
  h24?: number | null;
  [key: string]: unknown;
};
```

#### UserCounts

```typescript
type UserCounts = {
  m5?: number | null;
  h1?: number | null;
  h6?: number | null;
  h24?: number | null;
  [key: string]: unknown;
};
```

#### Boosts

```typescript
type Boosts = {
  active?: number | null;
  [key: string]: unknown;
};
```

#### Profile

```typescript
type Profile = {
  eti?: boolean;
  header?: boolean;
  website?: boolean;
  twitter?: boolean;
  linkCount?: number;
  imgKey?: string;
  [key: string]: unknown;
};
```

#### CmsProfile

```typescript
type CmsProfile = {
  headerId?: string;
  iconId?: string;
  description?: string;
  links?: Array<{
    label?: string;
    type?: string;
    url?: string;
  }>;
  nsfw?: boolean;
  [key: string]: unknown;
};
```

#### Launchpad

```typescript
type Launchpad = {
  progress?: number;
  creator?: string;
  migrationDex?: string;
  meta?: {
    id?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};
```

#### DexEventStats

```typescript
type DexEventStats = {
  m5?: { txns?: number; volumeUsd?: number };
  h1?: { txns?: number; volumeUsd?: number };
  h6?: { txns?: number; volumeUsd?: number };
  h24?: { txns?: number; volumeUsd?: number };
  [key: string]: unknown;
};
```

---

## Filtering API

### FilterBuilder

Static methods for creating filter functions.

#### Methods

##### chainFilter()

```typescript
static chainFilter(chains: string[]): FilterFunction
```

Filters pairs by blockchain.

**Example:** `FilterBuilder.chainFilter(['solana', 'ethereum'])`

##### liquidityFilter()

```typescript
static liquidityFilter(minUsd: number): FilterFunction
```

Filters pairs by minimum liquidity in USD.

**Example:** `FilterBuilder.liquidityFilter(100000)`

##### volumeFilter()

```typescript
static volumeFilter(period: 'm5' | 'h1' | 'h6' | 'h24', minUsd: number): FilterFunction
```

Filters pairs by minimum volume over a time period.

**Example:** `FilterBuilder.volumeFilter('h24', 50000)`

##### priceChangeFilter()

```typescript
static priceChangeFilter(period: 'm5' | 'h1' | 'h6' | 'h24', minPercent: number): FilterFunction
```

Filters pairs by minimum price change percentage.

**Example:** `FilterBuilder.priceChangeFilter('h1', 10)`

##### symbolFilter()

```typescript
static symbolFilter(pattern: string | RegExp): FilterFunction
```

Filters pairs by base token symbol.

**Example:** `FilterBuilder.symbolFilter(/^(SOL|ETH)$/)`

##### combineFilters()

```typescript
static combineFilters(filters: FilterFunction[], logic: 'AND' | 'OR' = 'AND'): FilterFunction
```

Combines multiple filters with AND/OR logic.

**Example:**

```typescript
const filter = FilterBuilder.combineFilters([
  FilterBuilder.chainFilter(['solana']),
  FilterBuilder.liquidityFilter(100000)
], 'AND');
```

##### createFilter()

```typescript
static createFilter(config: FilterConfig): FilterFunction
```

Creates a filter from a configuration object.

### Filter Types

#### FilterFunction

```typescript
type FilterFunction = (ctx: FilterContext) => boolean;
```

#### FilterContext

```typescript
type FilterContext = {
  pair: Pair;
  event: DexEvent;
  streamId: string;
};
```

#### FilterConfig

```typescript
type FilterConfig = {
  type: 'chain' | 'liquidity' | 'volume' | 'priceChange' | 'symbol';
  params: Record<string, unknown>;
};
```

### Helper Functions

#### createFilter()

```typescript
function createFilter(config: FilterConfig): FilterFunction
```

Convenience wrapper for `FilterBuilder.createFilter()`.

---

## Transformation API

### Transformer

Transforms trading pair data by selecting fields, applying aliases, and computing values.

#### Constructor

```typescript
new Transformer(config: TransformConfig)
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `fields` | string[] | Array of field paths to select (supports dot notation) |
| `aliases` | Record<string, string> | Map of field name aliases |
| `computed` | ComputedField[] | Array of computed fields to add |

**Example:**

```typescript
const transformer = new Transformer({
  fields: ['baseToken.symbol', 'priceUsd', 'volume.h24'],
  aliases: {
    'baseToken.symbol': 'symbol',
    'priceUsd': 'price',
    'volume.h24': 'volume'
  }
});
```

#### Methods

##### transform()

```typescript
transform(pair: Pair): Record<string, unknown>
```

Transforms a single pair.

##### transformBatch()

```typescript
transformBatch(pairs: Pair[]): Record<string, unknown>[]
```

Transforms multiple pairs.

### Transform Types

#### TransformConfig

```typescript
type TransformConfig = {
  fields?: string[];
  aliases?: Record<string, string>;
  computed?: ComputedField[];
};
```

#### ComputedField

```typescript
type ComputedField = {
  name: string;
  expression: (pair: Pair) => unknown;
};
```

### Helper Functions

#### createTransformer()

```typescript
function createTransformer(config: TransformConfig): Transformer
```

Convenience wrapper for creating a Transformer instance.

---

## Aggregation & Pipeline

### Aggregator

Computes aggregated statistics from DexScreener events.

#### Constructor

```typescript
new Aggregator()
```

#### Methods

##### aggregate()

```typescript
aggregate(event: DexEvent, streamId?: string): AggregateStats
```

Computes statistics from an event.

**Returns:**

```typescript
type AggregateStats = {
  timestamp: string;
  streamId?: string;
  totalPairs: number;
  uniqueChains: number;
  uniqueDexs: number;
  topChains: Array<{ chain: string; count: number }>;
  topDexs: Array<{ dex: string; count: number }>;
};
```

### ProcessingPipeline

Integrates filters, transformers, and aggregators into a unified pipeline.

#### Constructor

```typescript
new ProcessingPipeline(config: PipelineConfig)
```

**Parameters:**

```typescript
type PipelineConfig = {
  filters?: FilterConfig[];
  transforms?: TransformConfig;
  aggregate?: boolean;
};
```

**Example:**

```typescript
const pipeline = new ProcessingPipeline({
  filters: [
    { type: 'chain', params: { chains: ['solana'] } },
    { type: 'liquidity', params: { minUsd: 100000 } }
  ],
  transforms: {
    fields: ['baseToken.symbol', 'priceUsd'],
    aliases: { 'baseToken.symbol': 'symbol', 'priceUsd': 'price' }
  },
  aggregate: false
});
```

#### Methods

##### process()

```typescript
process(event: DexEvent, streamId: string): PipelineResult
```

Processes an event through all pipeline stages.

**Returns:**

```typescript
type PipelineResult = {
  filtered: boolean;
  transformed?: Record<string, unknown>[];
  aggregated?: AggregateStats;
  droppedPairs: number;
};
```

##### getFilterCount()

```typescript
getFilterCount(): number
```

Returns the number of configured filters.

##### hasTransformer()

```typescript
hasTransformer(): boolean
```

Returns true if a transformer is configured.

##### hasAggregator()

```typescript
hasAggregator(): boolean
```

Returns true if aggregation is enabled.

---

## Monitoring API

### MetricsCollector

Collects and exposes performance metrics in Prometheus format.

#### Constructor

```typescript
new MetricsCollector()
```

#### Methods

##### recordEvent()

```typescript
recordEvent(streamId: string, pairCount: number, durationMs: number): void
```

Records an event with pair count and processing duration.

##### recordConnectionState()

```typescript
recordConnectionState(streamId: string, state: ConnectionState): void
```

Records a connection state change.

##### updateEventsPerSecond()

```typescript
updateEventsPerSecond(streamId: string, rate: number): void
```

Updates the events per second metric.

##### updateMemoryUsage()

```typescript
updateMemoryUsage(): void
```

Updates the memory usage metric.

##### getPrometheusMetrics()

```typescript
async getPrometheusMetrics(): Promise<string>
```

Returns all metrics in Prometheus text format.

---

### HealthChecker

Provides an HTTP health check endpoint.

#### Constructor

```typescript
new HealthChecker(port: number)
```

#### Methods

##### start()

```typescript
start(): void
```

Starts the health check HTTP server on `/health`.

##### stop()

```typescript
stop(): void
```

Stops the health check HTTP server.

##### updateStreamHealth()

```typescript
updateStreamHealth(streamId: string, health: StreamHealth): void
```

Updates health information for a stream.

**StreamHealth Type:**

```typescript
type StreamHealth = {
  state: ConnectionState;
  lastEventAt?: number;
  eventsReceived: number;
};
```

##### getStatus()

```typescript
getStatus(): HealthStatus
```

Returns the current health status.

**HealthStatus Type:**

```typescript
type HealthStatus = {
  status: 'healthy' | 'degraded' | 'unhealthy';
  streams: Record<string, StreamHealth>;
  uptime: number;
};
```

---

### StructuredLogger

Provides leveled, structured logging.

#### Constructor

```typescript
new StructuredLogger(level?: LogLevel, format?: 'text' | 'json')
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `level` | 'error' \| 'warn' \| 'info' \| 'debug' | 'info' | Minimum log level |
| `format` | 'text' \| 'json' | 'text' | Output format |

#### Methods

##### error()

```typescript
error(message: string, context?: Record<string, unknown>, error?: Error): void
```

Logs an error message.

##### warn()

```typescript
warn(message: string, context?: Record<string, unknown>): void
```

Logs a warning message.

##### info()

```typescript
info(message: string, context?: Record<string, unknown>): void
```

Logs an info message.

##### debug()

```typescript
debug(message: string, context?: Record<string, unknown>): void
```

Logs a debug message.

---

### PerformanceMonitor

Tracks event processing duration and memory usage.

#### Constructor

```typescript
new PerformanceMonitor()
```

#### Methods

##### startMemoryMonitoring()

```typescript
startMemoryMonitoring(intervalMs?: number): void
```

Starts monitoring memory usage. Default interval: 5000ms.

##### stopMemoryMonitoring()

```typescript
stopMemoryMonitoring(): void
```

Stops monitoring memory usage.

##### trackEventDuration()

```typescript
trackEventDuration(durationMs: number): void
```

Tracks an event processing duration.

##### sampleMemoryUsage()

```typescript
sampleMemoryUsage(): void
```

Takes a memory usage sample.

##### getStats()

```typescript
getStats(label?: string): PerformanceStats
```

Returns performance statistics.

**PerformanceStats Type:**

```typescript
type PerformanceStats = {
  count: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  peakMemoryMB: number;
  currentMemoryMB: number;
};
```

---

### AlertMonitor

Monitors metrics against thresholds and logs warnings.

#### Constructor

```typescript
new AlertMonitor(thresholds: AlertThresholds, logger?: StructuredLogger)
```

**AlertThresholds Type:**

```typescript
type AlertThresholds = {
  maxEventDurationMs?: number;
  maxMemoryMB?: number;
  minEventsPerSecond?: number;
  maxErrorRate?: number;
};
```

#### Methods

##### checkEventDuration()

```typescript
checkEventDuration(durationMs: number, streamId: string): void
```

Checks if event duration exceeds threshold.

##### checkMemoryUsage()

```typescript
checkMemoryUsage(memoryMB: number): void
```

Checks if memory usage exceeds threshold.

##### checkEventsPerSecond()

```typescript
checkEventsPerSecond(rate: number, streamId: string): void
```

Checks if event rate is below threshold.

##### checkErrorRate()

```typescript
checkErrorRate(errorCount: number, totalCount: number, streamId: string): void
```

Checks if error rate exceeds threshold.

---

## Output Management

### Compressor

Provides gzip compression for data output.

#### Static Methods

##### compress()

```typescript
static async compress(data: string, level?: number): Promise<Buffer>
```

Compresses data asynchronously. Level: 0-9 (default: 6).

##### compressSync()

```typescript
static compressSync(data: string, level?: number): Buffer
```

Compresses data synchronously.

##### decompress()

```typescript
static async decompress(data: Buffer): Promise<string>
```

Decompresses data asynchronously.

##### decompressSync()

```typescript
static decompressSync(data: Buffer): string
```

Decompresses data synchronously.

---

### FileRotator

Manages automatic file rotation based on size or time.

#### Constructor

```typescript
new FileRotator(filePath: string, config: RotationConfig)
```

**RotationConfig Type:**

```typescript
type RotationConfig = {
  maxSizeMB?: number;
  interval?: 'hourly' | 'daily' | 'weekly';
  keepFiles?: number;
  compress?: boolean;
};
```

#### Methods

##### write()

```typescript
async write(data: string): Promise<void>
```

Writes data to file, rotating if necessary.

##### close()

```typescript
async close(): Promise<void>
```

Closes the current file.

---

### Batcher

Accumulates items and flushes them in batches.

#### Constructor

```typescript
new Batcher<T>(config: BatchConfig<T>)
```

**BatchConfig Type:**

```typescript
type BatchConfig<T> = {
  maxSize: number;
  maxWaitMs: number;
  onFlush: (items: T[]) => void | Promise<void>;
};
```

#### Methods

##### add()

```typescript
async add(item: T): Promise<void>
```

Adds an item to the batch.

##### flush()

```typescript
async flush(): Promise<void>
```

Flushes the current batch immediately.

##### close()

```typescript
async close(): Promise<void>
```

Flushes and stops the batcher.

---

### Throttler

Implements rate limiting with configurable drop strategies.

#### Constructor

```typescript
new Throttler<T>(config: ThrottleConfig)
```

**ThrottleConfig Type:**

```typescript
type ThrottleConfig = {
  maxPerSecond: number;
  dropStrategy?: 'oldest' | 'newest' | 'random';
};
```

#### Methods

##### add()

```typescript
add(item: T): void
```

Adds an item to the throttle queue.

##### setConsumer()

```typescript
setConsumer(consumer: (item: T) => void): void
```

Sets the consumer function for throttled items.

##### getDroppedCount()

```typescript
getDroppedCount(): number
```

Returns the number of dropped items.

##### stop()

```typescript
stop(): void
```

Stops the throttler.

---

### Sampler

Implements probabilistic sampling.

#### Constructor

```typescript
new Sampler<T>(config: SamplingConfig<T>)
```

**SamplingConfig Type:**

```typescript
type SamplingConfig<T> = {
  rate: number;  // 0.0 to 1.0
  onSample: (item: T) => void;
};
```

#### Methods

##### sample()

```typescript
sample(item: T): boolean
```

Samples an item based on the configured rate. Returns true if sampled.

##### getSampledCount()

```typescript
getSampledCount(): number
```

Returns the number of sampled items.

##### getDroppedCount()

```typescript
getDroppedCount(): number
```

Returns the number of dropped items.

---

## Configuration

### Configuration Types

#### DexConfig

```typescript
type DexConfig = {
  baseUrl: string;
  apiToken: string;
  pageUrls: string[];
  mode?: 'stdout' | 'jsonl' | 'webhook';
  jsonlPath?: string;
  webhookUrl?: string;
  retryMs?: number;
  keepAliveMs?: number;
  profiles?: ConfigProfile[];
};
```

#### ConfigProfile

```typescript
type ConfigProfile = {
  name: string;
  baseUrl?: string;
  apiToken?: string;
  pageUrls?: string[];
  mode?: 'stdout' | 'jsonl' | 'webhook';
  jsonlPath?: string;
  webhookUrl?: string;
  retryMs?: number;
  keepAliveMs?: number;
};
```

#### OutputConfig

```typescript
type OutputConfig = {
  mode: 'stdout' | 'jsonl' | 'webhook';
  jsonlPath?: string;
  webhookUrl?: string;
};
```

#### MonitoringConfig

```typescript
type MonitoringConfig = {
  metricsPort?: number;
  healthPort?: number;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
  logFormat?: 'text' | 'json';
};
```

---

## Utilities

### URL Utilities

#### sanitizeBaseUrl()

```typescript
function sanitizeBaseUrl(url: string): string
```

Removes trailing slashes from base URL.

#### buildSseUrl()

```typescript
function buildSseUrl(baseUrl: string, pageUrl: string, apiToken: string): string
```

Constructs the SSE endpoint URL.

#### validateUrls()

```typescript
function validateUrls(baseUrl: string, pageUrl: string): void
```

Validates that URLs are HTTPS. Throws error if invalid.

---

### KeepAliveManager

Manages periodic health checks to keep Apify Standby containers warm.

#### Static Methods

##### getOrCreate()

```typescript
static getOrCreate(baseUrl: string, apiToken: string, intervalMs: number): KeepAliveManager
```

Gets or creates a shared manager for the given base URL.

#### Instance Methods

##### register()

```typescript
register(streamId: string): void
```

Registers a stream with this manager.

##### unregister()

```typescript
unregister(streamId: string): void
```

Unregisters a stream. Stops health checks when count reaches 0.

##### getActiveStreamCount()

```typescript
getActiveStreamCount(): number
```

Returns the number of active streams.

##### hasStream()

```typescript
hasStream(streamId: string): boolean
```

Checks if a stream is registered.

#### Helper Functions

##### clearManagerRegistry()

```typescript
function clearManagerRegistry(): void
```

Clears all managers from the global registry. Useful for testing.

---

## See Also

- **[User Guide](./GUIDE.md)** - Practical examples and tutorials
- **[Examples Directory](../examples/)** - Working code examples
- **[README](../README.md)** - Project overview and quick start
