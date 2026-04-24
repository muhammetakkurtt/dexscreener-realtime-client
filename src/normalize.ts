import type {
  DexEvent,
  DexEventStats,
  DexEventTimeframeStats,
  Launchpad,
  Pair,
  PairCreatedAtRaw,
  PairType,
} from './types.js';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function normalizeStatsWindow(value: unknown): DexEventTimeframeStats | unknown {
  if (!isRecord(value)) {
    return value;
  }

  const normalized: UnknownRecord = { ...value };
  if (normalized.volumeUsd === undefined && normalized.volumeUSD !== undefined) {
    normalized.volumeUsd = normalized.volumeUSD;
  }

  return normalized as DexEventTimeframeStats;
}

export function normalizeDexEventStats(stats: DexEventStats | undefined): DexEventStats | undefined {
  if (!isRecord(stats)) {
    return stats;
  }

  const normalized: UnknownRecord = { ...stats };
  for (const timeframe of Object.keys(normalized)) {
    normalized[timeframe] = normalizeStatsWindow(normalized[timeframe]);
  }

  return normalized as DexEventStats;
}

function normalizePairCreatedAt(value: unknown): {
  pairCreatedAt?: number;
  pairCreatedAtRaw?: PairCreatedAtRaw;
} {
  const numericValue = toFiniteNumber(value);
  if (numericValue !== undefined) {
    return { pairCreatedAt: numericValue };
  }

  if (!isRecord(value)) {
    return {};
  }

  const seconds = toFiniteNumber(value.seconds);
  if (seconds === undefined) {
    return { pairCreatedAtRaw: value as PairCreatedAtRaw };
  }

  const nanos = toFiniteNumber(value.nanos) ?? 0;
  return {
    pairCreatedAt: (seconds * 1000) + Math.floor(nanos / 1_000_000),
    pairCreatedAtRaw: value as PairCreatedAtRaw,
  };
}

function normalizeLaunchpad(value: unknown): Launchpad | unknown {
  if (!isRecord(value)) {
    return value;
  }

  const normalized: UnknownRecord = { ...value };
  if (normalized.migrationDex === undefined && normalized.migrationDEX !== undefined) {
    normalized.migrationDex = normalized.migrationDEX;
  }

  return normalized as Launchpad;
}

function normalizePairType(value: unknown): PairType | unknown {
  if (!isRecord(value)) {
    return value;
  }

  const normalized: UnknownRecord = { ...value };
  if (isRecord(normalized.value)) {
    const normalizedValue: UnknownRecord = { ...normalized.value };
    if (normalizedValue.launchpad !== undefined) {
      normalizedValue.launchpad = normalizeLaunchpad(normalizedValue.launchpad);
    }
    normalized.value = normalizedValue;
  }

  return normalized as PairType;
}

function getNestedLaunchpad(pair: UnknownRecord): unknown {
  const pairType = pair.type;
  if (!isRecord(pairType) || !isRecord(pairType.value)) {
    return undefined;
  }

  return pairType.value.launchpad;
}

export function normalizePair(pair: Pair): Pair {
  const source = pair as UnknownRecord;
  const normalized: UnknownRecord = { ...source };

  if (normalized.priceUsd === undefined && normalized.priceUSD !== undefined && normalized.priceUSD !== null) {
    normalized.priceUsd = String(normalized.priceUSD);
  }

  if (normalized.quoteTokenSymbol === undefined && isRecord(normalized.quoteToken)) {
    const symbol = normalized.quoteToken.symbol;
    if (typeof symbol === 'string') {
      normalized.quoteTokenSymbol = symbol;
    }
  }

  if (normalized.pairCreatedAt !== undefined) {
    const createdAt = normalizePairCreatedAt(normalized.pairCreatedAt);
    if (createdAt.pairCreatedAt !== undefined) {
      normalized.pairCreatedAt = createdAt.pairCreatedAt;
    }
    if (createdAt.pairCreatedAtRaw !== undefined) {
      normalized.pairCreatedAtRaw = createdAt.pairCreatedAtRaw;
    }
  }

  if (normalized.type !== undefined) {
    normalized.type = normalizePairType(normalized.type);
  }

  if (normalized.launchpad !== undefined) {
    normalized.launchpad = normalizeLaunchpad(normalized.launchpad);
  } else {
    const nestedLaunchpad = getNestedLaunchpad(normalized);
    if (nestedLaunchpad !== undefined) {
      normalized.launchpad = normalizeLaunchpad(nestedLaunchpad);
    }
  }

  return normalized as Pair;
}

export function normalizeDexEvent(event: DexEvent): DexEvent {
  const normalized: DexEvent = { ...event };
  normalized.stats = normalizeDexEventStats(event.stats);

  if (Array.isArray(event.pairs)) {
    normalized.pairs = event.pairs.map((pair) => normalizePair(pair));
  }

  return normalized;
}
