/** Possible states of an SSE connection. */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

/** Price change percentages over different time periods. */
export type PriceChange = {
  m5?: number | null;
  h1?: number | null;
  h6?: number | null;
  h24?: number | null;
  [key: string]: unknown;
};

/** Trading volume over different time periods. */
export type Volume = {
  m5?: number | null;
  h1?: number | null;
  h6?: number | null;
  h24?: number | null;
  [key: string]: unknown;
};

/** Liquidity information for a trading pair. */
export type Liquidity = {
  usd?: number | null;
  base?: number | null;
  quote?: number | null;
  [key: string]: unknown;
};

/** Transaction counts (buys/sells) over different time periods. */
export type Txns = {
  m5?: { buys?: number; sells?: number };
  h1?: { buys?: number; sells?: number };
  h6?: { buys?: number; sells?: number };
  h24?: { buys?: number; sells?: number };
  [key: string]: unknown;
};

/** Token information (address, name, symbol, decimals). */
export type Token = {
  address?: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  [key: string]: unknown;
};

/** User counts over different time periods. */
export type UserCounts = {
  m5?: number | null;
  h1?: number | null;
  h6?: number | null;
  h24?: number | null;
  [key: string]: unknown;
};

/** Boost information for a trading pair. */
export type Boosts = {
  active?: number | null;
  [key: string]: unknown;
};

/** Profile information for a token or pair. */
export type Profile = {
  eti?: boolean;
  header?: boolean;
  website?: boolean;
  twitter?: boolean;
  linkCount?: number;
  imgKey?: string;
  [key: string]: unknown;
};

/** CMS profile information. */
export type CmsProfile = {
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

/** Launchpad information. */
export type Launchpad = {
  progress?: number;
  creator?: string;
  migrationDex?: string;
  meta?: {
    id?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

/** Trading pair data from DexScreener. */
export type Pair = {
  chainId?: string;
  dexId?: string;
  pairAddress?: string;
  baseToken?: Token;
  quoteToken?: Token;
  quoteTokenSymbol?: string;
  price?: string;
  priceUsd?: string;
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
  isBoostable?: boolean;
  boosts?: Boosts;
  c?: string;
  a?: string;
  launchpad?: Launchpad;
  [key: string]: unknown;
};

/** Aggregated statistics from a DexScreener event. */
export type DexEventStats = {
  m5?: { txns?: number; volumeUsd?: number };
  h1?: { txns?: number; volumeUsd?: number };
  h6?: { txns?: number; volumeUsd?: number };
  h24?: { txns?: number; volumeUsd?: number };
  [key: string]: unknown;
};

/** SSE event payload containing pairs and statistics. */
export type DexEvent = {
  stats?: DexEventStats;
  pairs?: Pair[];
  event_type?: string;
  timestamp?: string;
  [key: string]: unknown;
};

/** Context passed to event callbacks. */
export type StreamContext = {
  streamId?: string;
};

/** Configuration for a single stream connection. */
export type DexStreamOptions = {
  baseUrl: string;
  pageUrl: string;
  apiToken: string;
  streamId?: string;
  retryMs?: number;
  keepAliveMs?: number;
  onBatch?: (event: DexEvent, ctx: StreamContext) => void;
  onPair?: (pair: Pair, ctx: StreamContext) => void;
  onError?: (error: unknown, ctx: StreamContext) => void;
  onStateChange?: (state: ConnectionState, ctx: StreamContext) => void;
};

/** Configuration for managing multiple streams. */
export type MultiStreamConfig = {
  baseUrl: string;
  apiToken: string;
  streams: Array<{
    id: string;
    pageUrl: string;
  }>;
  retryMs?: number;
  keepAliveMs?: number;
  onBatch?: (event: DexEvent, ctx: StreamContext) => void;
  onPair?: (pair: Pair, ctx: StreamContext) => void;
  onError?: (error: unknown, ctx: StreamContext) => void;
  onStateChange?: (state: ConnectionState, ctx: StreamContext) => void;
};

/** CLI output event wrapper with metadata. */
export type CliOutputEvent = {
  streamId: string;
  pageUrl: string;
  timestamp: number;
  event: DexEvent;
};
