import { z } from 'zod';

/** Schema for CLI mode. */
export const cliModeSchema = z.enum(['stdout', 'jsonl', 'webhook']);

/** Schema for log level. */
export const logLevelSchema = z.enum(['error', 'warn', 'info', 'debug']);

/** Schema for filter configuration. */
export const filterConfigSchema = z.object({
  type: z.enum(['chain', 'liquidity', 'volume', 'priceChange', 'symbol', 'custom']),
  params: z.record(z.unknown()),
});

/** Schema for computed field. */
export const computedFieldSchema = z.object({
  name: z.string(),
  expression: z.union([z.string(), z.function()]),
});

/** Schema for transform configuration. */
export const transformConfigSchema = z.object({
  fields: z.array(z.string()).optional(),
  aliases: z.record(z.string()).optional(),
  computed: z.array(computedFieldSchema).optional(),
});

/** Schema for compression configuration. */
export const compressionConfigSchema = z.object({
  enabled: z.boolean(),
  level: z.number().min(1).max(9).optional(),
});

/** Schema for rotation configuration. */
export const rotationConfigSchema = z.object({
  maxSizeMB: z.number().positive().optional(),
  interval: z.enum(['hourly', 'daily']).optional(),
  keepFiles: z.number().int().positive().optional(),
});

/** Schema for batch configuration. */
export const batchConfigSchema = z.object({
  maxSize: z.number().int().positive(),
  maxWaitMs: z.number().int().positive(),
});

/** Schema for throttle configuration. */
export const throttleConfigSchema = z.object({
  maxPerSecond: z.number().positive(),
  dropStrategy: z.enum(['oldest', 'newest', 'random']),
});

/** Schema for alert configuration. */
export const alertConfigSchema = z.object({
  metric: z.string(),
  threshold: z.number(),
  comparison: z.enum(['lt', 'gt', 'eq']),
});

/** Schema for output configuration. */
export const outputConfigSchema = z.object({
  compression: compressionConfigSchema.optional(),
  rotation: rotationConfigSchema.optional(),
  batching: batchConfigSchema.optional(),
  throttling: throttleConfigSchema.optional(),
  sampling: z.object({ rate: z.number().min(0).max(100) }).optional(),
});

/** Schema for monitoring configuration. */
export const monitoringConfigSchema = z.object({
  healthPort: z.number().int().positive().optional(),
  metricsPort: z.number().int().positive().optional(),
  logLevel: logLevelSchema.optional(),
  logFormat: z.enum(['text', 'json']).optional(),
  performance: z.boolean().optional(),
  alerts: z.array(alertConfigSchema).optional(),
});

/** Schema for configuration profile. */
export const configProfileSchema = z.object({
  name: z.string(),
  baseUrl: z.string().url(),
  apiToken: z.string().optional(),
  pageUrls: z.array(z.string().url()),
  mode: cliModeSchema.optional(),
  filters: z.array(filterConfigSchema).optional(),
  transforms: transformConfigSchema.optional(),
  output: outputConfigSchema.optional(),
  monitoring: monitoringConfigSchema.optional(),
});

/** Schema for main configuration. */
export const dexConfigSchema = z.object({
  profiles: z.record(configProfileSchema).optional(),
  default: z.string().optional(),
  baseUrl: z.string().url().optional(),
  apiToken: z.string().optional(),
  pageUrls: z.array(z.string().url()).optional(),
  mode: cliModeSchema.optional(),
  filters: z.array(filterConfigSchema).optional(),
  transforms: transformConfigSchema.optional(),
  output: outputConfigSchema.optional(),
  monitoring: monitoringConfigSchema.optional(),
});
