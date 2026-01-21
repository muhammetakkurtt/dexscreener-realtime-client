import 'dotenv/config';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as fs from 'fs';
import { DexScreenerStream } from './client.js';
import type { CliOutputEvent, DexEvent, StreamContext, LogLevel, FilterConfig, TransformConfig, DexConfig } from './types.js';
import { Compressor } from './output/compressor.js';
import { FileRotator } from './output/rotator.js';
import { Batcher } from './output/batcher.js';
import { Throttler } from './output/throttler.js';
import { Sampler } from './output/sampler.js';
import { ConfigLoader } from './config/loader.js';
import { ConfigValidator } from './config/validator.js';
import { InteractiveWizard } from './cli/wizard.js';
import { ConfigGenerator } from './config/generator.js';
import { ProcessingPipeline } from './pipeline/pipeline.js';
import { MetricsCollector } from './monitoring/metrics.js';
import { HealthChecker } from './monitoring/health.js';
import { StructuredLogger } from './monitoring/logger.js';
import { PerformanceMonitor } from './monitoring/performance.js';
import { AlertMonitor } from './monitoring/alerts.js';
import { StreamController } from './cli/controller.js';
import { ProgressDisplay } from './cli/display.js';
import { DexScreenerError, ConfigurationError, ErrorCode } from './errors/index.js';
import { formatAuthError, formatNetworkError, formatConfigError, formatFileError, formatWebhookError } from './errors/formatter.js';
import type { StreamHealth } from './monitoring/types.js';
import yaml from 'js-yaml';
import inquirer from 'inquirer';
import { createServer } from 'node:http';

const DEFAULT_RETRY_MS = 3000;

/** CLI output modes. */
export type CliMode = 'stdout' | 'jsonl' | 'webhook';

/** Parsed CLI options. */
export interface CliOptions {
  baseUrl: string;
  apiToken: string;
  pageUrl: string[];
  mode: CliMode;
  jsonlPath?: string;
  webhookUrl?: string;
  retryMs: number;
  keepAliveMs?: number;
  compress?: boolean;
  rotateSizeMB?: number;
  rotateInterval?: 'hourly' | 'daily';
  batchSize?: number;
  batchIntervalMs?: number;
  interactive?: boolean;
  profile?: string;
  validate?: boolean;
  init?: boolean;
  sampleRate?: number;
  aggregate?: boolean;
  healthPort?: number;
  metricsPort?: number;
  logLevel?: LogLevel;
  logFormat?: 'text' | 'json';
  perf?: boolean;
  verbose?: boolean;
  quiet?: boolean;
  debug?: boolean;
  filters?: FilterConfig[];
  transforms?: TransformConfig;
  output?: {
    throttling?: {
      maxPerSecond: number;
      dropStrategy: 'oldest' | 'newest' | 'random';
    };
  };
  monitoring?: {
    alerts?: Array<{
      metric: string;
      threshold: number;
      comparison: 'lt' | 'gt' | 'eq';
    }>;
  };
}

/** Parses command line arguments into CLI options. */
export function parseArgs(args: string[]): CliOptions {
  const parsed = yargs(args)
    .scriptName('dexrt')
    .usage('$0 - Stream DexScreener realtime data')
    .usage('')
    .usage('Usage: $0 --base-url <url> --page-url <url> [options]')
    .example(
      '$0 --base-url https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor --page-url "https://dexscreener.com/solana/trending"',
      'Stream to stdout'
    )
    .option('base-url', {
      type: 'string',
      describe: 'Apify Standby Actor base URL',
    })
    .option('api-token', {
      type: 'string',
      describe: 'Apify API token (or set APIFY_TOKEN env var)',
    })
    .option('page-url', {
      type: 'string',
      array: true,
      describe: 'DexScreener page URL(s) to monitor',
    })
    .option('mode', {
      type: 'string',
      choices: ['stdout', 'jsonl', 'webhook'] as const,
      default: 'stdout',
      describe: 'Output mode',
    })
    .option('jsonl-path', {
      type: 'string',
      describe: 'File path for JSONL output (required when mode=jsonl)',
    })
    .option('webhook-url', {
      type: 'string',
      describe: 'Webhook URL for HTTP POST (required when mode=webhook)',
    })
    .option('retry-ms', {
      type: 'number',
      default: DEFAULT_RETRY_MS,
      describe: 'Reconnection delay in milliseconds',
    })
    .option('keep-alive-ms', {
      type: 'number',
      describe: 'Health check interval in milliseconds (default: 120000, set to 0 to disable)',
    })
    .option('compress', {
      type: 'boolean',
      describe: 'Enable gzip compression for JSONL and webhook output',
    })
    .option('rotate-size', {
      type: 'number',
      describe: 'Rotate JSONL file when it exceeds this size in MB',
    })
    .option('rotate-interval', {
      type: 'string',
      choices: ['hourly', 'daily'] as const,
      describe: 'Rotate JSONL file at time intervals',
    })
    .option('batch-size', {
      type: 'number',
      describe: 'Maximum number of events per batch for webhook mode',
    })
    .option('batch-interval', {
      type: 'number',
      describe: 'Maximum time to wait before flushing batch in milliseconds',
    })
    .option('interactive', {
      type: 'boolean',
      describe: 'Launch interactive configuration wizard',
    })
    .option('profile', {
      type: 'string',
      describe: 'Configuration profile to use',
    })
    .option('validate', {
      type: 'boolean',
      describe: 'Validate configuration and exit',
    })
    .option('init', {
      type: 'boolean',
      describe: 'Generate default configuration file',
    })
    .option('sample-rate', {
      type: 'number',
      describe: 'Sample rate percentage (0-100) for event processing',
    })
    .option('aggregate', {
      type: 'boolean',
      describe: 'Output aggregated statistics only (no individual pairs)',
    })
    .option('health-port', {
      type: 'number',
      describe: 'Port for health check HTTP endpoint',
    })
    .option('metrics-port', {
      type: 'number',
      describe: 'Port for Prometheus metrics HTTP endpoint',
    })
    .option('log-level', {
      type: 'string',
      choices: ['error', 'warn', 'info', 'debug'] as const,
      describe: 'Logging level',
    })
    .option('log-format', {
      type: 'string',
      choices: ['text', 'json'] as const,
      describe: 'Log output format',
    })
    .option('perf', {
      type: 'boolean',
      describe: 'Enable performance monitoring',
    })
    .option('verbose', {
      type: 'boolean',
      describe: 'Enable verbose output with detailed information',
    })
    .option('quiet', {
      type: 'boolean',
      describe: 'Suppress all output except errors',
    })
    .option('debug', {
      type: 'boolean',
      describe: 'Enable debug mode with diagnostic information',
    })
    .help()
    .alias('h', 'help')
    .version(false)
    .strict()
    .parseSync();

  const apiToken = parsed['api-token'] || process.env.APIFY_TOKEN || '';
  const baseUrl = parsed['base-url'] || process.env.DEX_ACTOR_BASE || '';

  return {
    baseUrl,
    apiToken,
    pageUrl: parsed['page-url'] || [],
    mode: parsed.mode as CliMode,
    jsonlPath: parsed['jsonl-path'],
    webhookUrl: parsed['webhook-url'],
    retryMs: parsed['retry-ms'],
    keepAliveMs: parsed['keep-alive-ms'],
    compress: parsed.compress,
    rotateSizeMB: parsed['rotate-size'],
    rotateInterval: parsed['rotate-interval'] as 'hourly' | 'daily' | undefined,
    batchSize: parsed['batch-size'],
    batchIntervalMs: parsed['batch-interval'],
    interactive: parsed.interactive,
    profile: parsed.profile,
    validate: parsed.validate,
    init: parsed.init,
    sampleRate: parsed['sample-rate'],
    aggregate: parsed.aggregate,
    healthPort: parsed['health-port'],
    metricsPort: parsed['metrics-port'],
    logLevel: parsed['log-level'] as LogLevel | undefined,
    logFormat: parsed['log-format'] as 'text' | 'json' | undefined,
    perf: parsed.perf,
    verbose: parsed.verbose,
    quiet: parsed.quiet,
    debug: parsed.debug,
  };
}

/**
 * Load configuration from files and merge with CLI arguments.
 * CLI arguments take precedence over config file settings.
 */
export async function loadConfig(cliArgs: CliOptions): Promise<CliOptions> {
  try {
    // Load config from file with profile support
    const config = await ConfigLoader.load({
      profile: cliArgs.profile,
      args: {},
    });

    // Convert DexConfig to CliOptions format and merge
    const merged: CliOptions = {
      // Config file values as base
      baseUrl: config.baseUrl || cliArgs.baseUrl,
      apiToken: config.apiToken || cliArgs.apiToken,
      pageUrl: config.pageUrls || cliArgs.pageUrl,
      mode: config.mode || cliArgs.mode,
      retryMs: cliArgs.retryMs, // CLI default already applied
      
      // CLI args override config file
      jsonlPath: cliArgs.jsonlPath,
      webhookUrl: cliArgs.webhookUrl,
      keepAliveMs: cliArgs.keepAliveMs,
      compress: cliArgs.compress ?? config.output?.compression?.enabled,
      rotateSizeMB: cliArgs.rotateSizeMB ?? config.output?.rotation?.maxSizeMB,
      rotateInterval: cliArgs.rotateInterval ?? config.output?.rotation?.interval,
      batchSize: cliArgs.batchSize ?? config.output?.batching?.maxSize,
      batchIntervalMs: cliArgs.batchIntervalMs ?? config.output?.batching?.maxWaitMs,
      sampleRate: cliArgs.sampleRate ?? config.output?.sampling?.rate,
      
      // Monitoring options
      healthPort: cliArgs.healthPort ?? config.monitoring?.healthPort,
      metricsPort: cliArgs.metricsPort ?? config.monitoring?.metricsPort,
      logLevel: cliArgs.logLevel ?? config.monitoring?.logLevel,
      logFormat: cliArgs.logFormat ?? config.monitoring?.logFormat,
      perf: cliArgs.perf ?? config.monitoring?.performance,
      
      // Data processing
      filters: config.filters,
      transforms: config.transforms,
      aggregate: cliArgs.aggregate,
      
      // Output management
      output: config.output?.throttling ? {
        throttling: config.output.throttling,
      } : undefined,
      
      // Monitoring
      monitoring: config.monitoring?.alerts ? {
        alerts: config.monitoring.alerts,
      } : undefined,
      
      // CLI-only flags
      interactive: cliArgs.interactive,
      profile: cliArgs.profile,
      validate: cliArgs.validate,
      init: cliArgs.init,
      verbose: cliArgs.verbose,
      quiet: cliArgs.quiet,
      debug: cliArgs.debug,
    };

    return merged;
  } catch (error) {
    // If config loading fails, check if it's a profile error
    if (error instanceof Error && error.message.includes('Profile')) {
      const profileError = new ConfigurationError(
        error.message,
        'profile',
        ErrorCode.CONFIG_PROFILE_NOT_FOUND,
        'Check available profiles in your config file or remove the --profile flag'
      );
      throw profileError;
    }
    // For other errors, just use CLI args (allows CLI to work without config file)
    return cliArgs;
  }
}

/**
 * Run interactive wizard and optionally save configuration.
 * @returns CLI options from wizard result
 */
export async function runWizard(): Promise<CliOptions> {
  const result = await InteractiveWizard.run();

  // Save configuration if requested
  if (result.saveToFile && result.filePath) {
    try {
      const ext = result.filePath.toLowerCase();
      let content: string;

      if (ext.endsWith('.json')) {
        content = JSON.stringify(result.config, null, 2);
      } else if (ext.endsWith('.yaml') || ext.endsWith('.yml')) {
        content = yaml.dump(result.config, { indent: 2 });
      } else {
        throw new Error('Unsupported file format. Use .json, .yaml, or .yml extension.');
      }

      fs.writeFileSync(result.filePath, content, 'utf-8');
      console.log(`✅ Configuration saved to ${result.filePath}\n`);
    } catch (error) {
      console.error(`❌ Failed to save configuration: ${error}`);
      console.error('Continuing with configuration in memory...\n');
    }
  }

  // Convert wizard result to CliOptions
  return {
    baseUrl: result.config.baseUrl || '',
    apiToken: result.config.apiToken || '',
    pageUrl: result.config.pageUrls || [],
    mode: result.config.mode || 'stdout',
    retryMs: DEFAULT_RETRY_MS,
    interactive: false,
  };
}

/**
 * Generate a default configuration file.
 * Prompts for format and checks for existing files.
 */
export async function generateConfig(): Promise<void> {
  console.log('\n📝 Configuration File Generator\n');

  // Prompt for format
  const formatAnswer = await inquirer.prompt<{ format: 'json' | 'yaml' }>([
    {
      type: 'list',
      name: 'format',
      message: 'Select configuration file format:',
      choices: [
        { name: 'JSON (.dexrtrc.json)', value: 'json' },
        { name: 'YAML (.dexrtrc.yaml)', value: 'yaml' },
      ],
      default: 'json',
    },
  ]);

  const defaultPath = formatAnswer.format === 'json' ? '.dexrtrc.json' : '.dexrtrc.yaml';

  // Check if file already exists
  if (fs.existsSync(defaultPath)) {
    const overwriteAnswer = await inquirer.prompt<{ overwrite: boolean }>([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `File ${defaultPath} already exists. Overwrite?`,
        default: false,
      },
    ]);

    if (!overwriteAnswer.overwrite) {
      console.log('❌ Configuration generation cancelled.\n');
      process.exit(0);
    }
  }

  // Generate configuration
  const content = ConfigGenerator.generate({
    format: formatAnswer.format,
    includeExamples: true,
    includeProfiles: true,
  });

  // Write to file
  try {
    fs.writeFileSync(defaultPath, content, 'utf-8');
    console.log(`\n✅ Configuration file generated: ${defaultPath}`);
    console.log('📖 Edit the file to customize your configuration.\n');
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Failed to write configuration file: ${error}\n`);
    process.exit(1);
  }
}

/** Validates CLI options and exits on error. */
export function validateOptions(options: CliOptions): void {
  // Convert CliOptions to DexConfig for validation
  const config: DexConfig = {
    baseUrl: options.baseUrl,
    apiToken: options.apiToken,
    pageUrls: options.pageUrl,
    mode: options.mode,
    filters: options.filters,
    transforms: options.transforms,
    output: {
      compression: options.compress ? { enabled: true } : undefined,
      rotation: options.rotateSizeMB || options.rotateInterval ? {
        maxSizeMB: options.rotateSizeMB,
        interval: options.rotateInterval,
      } : undefined,
      batching: options.batchSize && options.batchIntervalMs ? {
        maxSize: options.batchSize,
        maxWaitMs: options.batchIntervalMs,
      } : undefined,
      sampling: options.sampleRate !== undefined ? { rate: options.sampleRate } : undefined,
    },
    monitoring: {
      healthPort: options.healthPort,
      metricsPort: options.metricsPort,
      logLevel: options.logLevel,
      logFormat: options.logFormat,
      performance: options.perf,
    },
  };

  // Validate configuration
  const result = ConfigValidator.validateConfig(config);
  
  if (!result.valid) {
    console.error('Configuration validation failed:\n');
    result.errors.forEach((error) => {
      const path = error.path.join('.');
      console.error(`  [${path}] ${error.message}`);
      if (error.suggestion) {
        console.error(`    Suggestion: ${error.suggestion}`);
      }
    });
    console.error('');
    process.exit(1);
  }

  // Additional CLI-specific validations
  if (!options.apiToken) {
    const error = formatConfigError('apiToken', 'API token is required');
    console.error(error.toString());
    process.exit(1);
  }

  if (!options.baseUrl) {
    const error = formatConfigError('baseUrl', 'Base URL is required');
    console.error(error.toString());
    process.exit(1);
  }

  if (!options.pageUrl || options.pageUrl.length === 0) {
    const error = formatConfigError('pageUrl', 'At least one page URL is required');
    console.error(error.toString());
    process.exit(1);
  }

  if (options.mode === 'jsonl' && !options.jsonlPath) {
    const error = formatConfigError('jsonlPath', '--jsonl-path is required when mode is jsonl');
    console.error(error.toString());
    process.exit(1);
  }

  if (options.mode === 'webhook' && !options.webhookUrl) {
    const error = formatConfigError('webhookUrl', '--webhook-url is required when mode is webhook');
    console.error(error.toString());
    process.exit(1);
  }

  // Validate file paths
  if (options.jsonlPath && !ConfigValidator.validateFilePath(options.jsonlPath)) {
    const error = formatFileError(options.jsonlPath, 'write', 'Directory does not exist or is not writable');
    console.error(error.toString());
    process.exit(1);
  }
}

/** Creates an output event with metadata. */
export function createOutputEvent(streamId: string, pageUrl: string, event: DexEvent): CliOutputEvent {
  return {
    streamId,
    pageUrl,
    timestamp: Date.now(),
    event,
  };
}

function handleStdout(output: CliOutputEvent): void {
  console.log(JSON.stringify(output));
}

function handleJsonl(output: CliOutputEvent, filePath: string, options: CliOptions, rotator?: FileRotator): void {
  try {
    const jsonLine = JSON.stringify(output) + '\n';
    
    // Use file rotator if configured
    if (rotator) {
      rotator.write(jsonLine);
      return;
    }

    // Handle compression if enabled
    if (options.compress) {
      const compressed = Compressor.compressSync(jsonLine);
      const compressedPath = filePath.endsWith('.gz') ? filePath : `${filePath}.gz`;
      fs.appendFileSync(compressedPath, compressed);
    } else {
      fs.appendFileSync(filePath, jsonLine);
    }
  } catch (error) {
    const formattedError = formatFileError(filePath, 'write', error as Error);
    console.error(formattedError.toString());
  }
}

async function handleWebhook(
  output: CliOutputEvent, 
  webhookUrl: string, 
  options: CliOptions
): Promise<void> {
  try {
    const body = JSON.stringify(output);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    // Handle compression if enabled
    let requestBody: string | Buffer = body;
    if (options.compress) {
      requestBody = await Compressor.compress(body);
      headers['Content-Encoding'] = 'gzip';
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: requestBody,
    });

    if (!response.ok) {
      const responseBody = await response.text().catch(() => '');
      const error = formatWebhookError(webhookUrl, response.status, responseBody);
      console.error(error.toString());
    }
  } catch (error) {
    const formattedError = formatNetworkError(webhookUrl, error as Error);
    console.error(formattedError.toString());
  }
}

function createOutputHandler(options: CliOptions): {
  handler: (output: CliOutputEvent) => void;
  cleanup?: () => void;
} {
  let rotator: FileRotator | undefined;
  let batcher: Batcher<CliOutputEvent> | undefined;

  switch (options.mode) {
    case 'stdout':
      return { handler: handleStdout };

    case 'jsonl': {
      const filePath = options.jsonlPath!;
      
      // Setup file rotation if configured
      if (options.rotateSizeMB || options.rotateInterval) {
        const actualPath = options.compress && !filePath.endsWith('.gz') 
          ? `${filePath}.gz` 
          : filePath;
        
        rotator = new FileRotator(actualPath, {
          maxSizeMB: options.rotateSizeMB,
          interval: options.rotateInterval,
        });

        return {
          handler: (output) => {
            const jsonLine = JSON.stringify(output) + '\n';
            if (options.compress) {
              const compressed = Compressor.compressSync(jsonLine);
              rotator!.write(compressed.toString('binary'));
            } else {
              rotator!.write(jsonLine);
            }
          },
          cleanup: () => rotator?.close(),
        };
      }

      return {
        handler: (output) => handleJsonl(output, filePath, options, rotator),
      };
    }

    case 'webhook': {
      const webhookUrl = options.webhookUrl!;

      // Setup batching if configured
      if (options.batchSize && options.batchIntervalMs) {
        batcher = new Batcher<CliOutputEvent>(
          {
            maxSize: options.batchSize,
            maxWaitMs: options.batchIntervalMs,
          },
          async (items) => {
            // Send batch as array
            try {
              const body = JSON.stringify(items);
              const headers: Record<string, string> = { 'Content-Type': 'application/json' };

              let requestBody: string | Buffer = body;
              if (options.compress) {
                requestBody = await Compressor.compress(body);
                headers['Content-Encoding'] = 'gzip';
              }

              const response = await fetch(webhookUrl, {
                method: 'POST',
                headers,
                body: requestBody,
              });

              if (!response.ok) {
                console.error(`Webhook batch returned non-2xx status: ${response.status}`);
              }
            } catch (error) {
              console.error('Webhook batch error:', error);
            }
          }
        );

        return {
          handler: (output) => batcher!.add(output),
          cleanup: () => batcher?.destroy(),
        };
      }

      return {
        handler: (output) => { handleWebhook(output, webhookUrl, options); },
      };
    }
  }
}

/** Creates stream instances from CLI options. */
export function createStreams(
  options: CliOptions,
  outputHandler: (output: CliOutputEvent) => void,
  pipeline?: ProcessingPipeline,
  healthChecker?: HealthChecker,
  metricsCollector?: MetricsCollector,
  logger?: StructuredLogger,
  perfMonitor?: PerformanceMonitor,
  progressDisplay?: ProgressDisplay,
  displayMetrics?: {
    totalEvents: { value: number };
    totalPairs: { value: number };
    totalDataBytes: { value: number };
    startTime: number;
    connectionStates: Record<string, string>;
  }
): DexScreenerStream[] {
  const streams: DexScreenerStream[] = [];

  // Create throttler if configured
  const throttler = options.output?.throttling ? new Throttler<CliOutputEvent>({
    maxPerSecond: options.output.throttling.maxPerSecond,
    dropStrategy: options.output.throttling.dropStrategy,
  }) : undefined;

  // Create sampler if configured
  const sampler = options.sampleRate !== undefined ? new Sampler({
    rate: options.sampleRate,
  }) : undefined;

  // Track events per stream for health checker
  const streamEventCounts = new Map<string, number>();

  options.pageUrl.forEach((pageUrl, index) => {
    const streamId = `stream-${index + 1}`;
    streamEventCounts.set(streamId, 0);

    const stream = new DexScreenerStream({
      baseUrl: options.baseUrl,
      apiToken: options.apiToken,
      pageUrl,
      streamId,
      retryMs: options.retryMs,
      keepAliveMs: options.keepAliveMs,
      onBatch: (event: DexEvent, ctx: StreamContext) => {
        const batchStartTime = Date.now();
        const currentStreamId = ctx.streamId || streamId;
        
        // Track performance
        if (perfMonitor) {
          perfMonitor.trackEventDuration(0);
        }
        
        // Update metrics
        if (metricsCollector) {
          const pairCount = event.pairs?.length || 0;
          metricsCollector.recordEvent(currentStreamId, pairCount, 0);
        }

        // Update display metrics
        if (displayMetrics) {
          // Rough estimate: ~500 bytes per pair + 200 bytes overhead
          const pairCount = event.pairs?.length || 0;
          const estimatedBytes = (pairCount * 500) + 200;
          
          // Increment totals
          displayMetrics.totalEvents.value++;
          displayMetrics.totalPairs.value += pairCount;
          displayMetrics.totalDataBytes.value += estimatedBytes;
          
          // Calculate metrics
          const uptimeSeconds = Math.floor((Date.now() - displayMetrics.startTime) / 1000);
          const eventsPerSecond = uptimeSeconds > 0 ? displayMetrics.totalEvents.value / uptimeSeconds : 0;
          const dataRateMBps = uptimeSeconds > 0 ? (displayMetrics.totalDataBytes.value / uptimeSeconds) / (1024 * 1024) : 0;
          
          if (progressDisplay) {
            progressDisplay.update({
              eventsPerSecond,
              dataRateMBps,
              totalEvents: displayMetrics.totalEvents.value,
              totalPairs: displayMetrics.totalPairs.value,
              uptimeSeconds,
              connectionStates: displayMetrics.connectionStates as any,
            });
          }
        }

        // Update health checker with cumulative event count
        if (healthChecker) {
          const currentCount = streamEventCounts.get(currentStreamId) || 0;
          const newCount = currentCount + 1;
          streamEventCounts.set(currentStreamId, newCount);
          
          const health: StreamHealth = {
            state: 'connected',
            lastEventAt: Date.now(),
            eventsReceived: newCount,
          };
          healthChecker.updateStreamHealth(currentStreamId, health);
        }

        // Apply sampling first
        if (sampler && !sampler.shouldSample()) {
          return; // Skip this event
        }

        let processedEvent = event;

        // Apply processing pipeline if configured
        if (pipeline) {
          const result = pipeline.process(event, ctx.streamId || streamId);

          // Skip output if all pairs were filtered out
          if (result.filtered) {
            return;
          }

          // Use aggregated output if aggregation is enabled
          if (result.aggregated) {
            // Create a special output event with aggregated stats
            const aggregatedOutput: CliOutputEvent = {
              streamId: ctx.streamId || streamId,
              pageUrl,
              timestamp: Date.now(),
              event: {
                stats: result.aggregated.eventStats,
                pairs: [], // No pairs in aggregated mode
                aggregated: result.aggregated, // Include aggregated stats
              } as any,
            };

            // Apply throttling
            if (throttler && !throttler.shouldProcess(aggregatedOutput)) {
              return; // Skip this event due to throttling
            }

            outputHandler(aggregatedOutput);
            
            // Record processing duration
            const duration = Date.now() - batchStartTime;
            if (metricsCollector) {
              metricsCollector.recordEvent(ctx.streamId || streamId, 0, duration);
            }
            if (perfMonitor) {
              perfMonitor.trackEventDuration(duration);
            }
            return;
          }

          // Use transformed pairs if transformation is enabled
          if (result.transformed && result.transformed.length > 0) {
            processedEvent = {
              ...event,
              pairs: result.transformed as any[],
            };
          }
        }

        const output = createOutputEvent(ctx.streamId || streamId, pageUrl, processedEvent);

        // Apply throttling
        if (throttler && !throttler.shouldProcess(output)) {
          return; // Skip this event due to throttling
        }

        outputHandler(output);
        
        // Record processing duration
        const duration = Date.now() - batchStartTime;
        if (metricsCollector) {
          metricsCollector.recordEvent(ctx.streamId || streamId, event.pairs?.length || 0, duration);
        }
        if (perfMonitor) {
          perfMonitor.trackEventDuration(duration);
        }
      },
      onError: (error: unknown, ctx: StreamContext) => {
        // Check if it's an authentication error
        if (error instanceof Error && (error.message.includes('401') || error.message.includes('auth') || error.message.includes('token'))) {
          const authError = formatAuthError(options.apiToken);
          if (progressDisplay) {
            progressDisplay.showError(authError.message);
          }
          if (logger) {
            logger.error(authError.message, { streamId: ctx.streamId || streamId, code: authError.code });
          } else {
            console.error(authError.toString());
          }
        } else {
          const errorMsg = error instanceof Error ? error.message : String(error);
          if (progressDisplay) {
            progressDisplay.showError(`Stream error: ${errorMsg}`);
          }
          if (logger) {
            logger.error(`Stream error`, { streamId: ctx.streamId || streamId }, error instanceof Error ? error : undefined);
          } else {
            console.error(`[${ctx.streamId || streamId}] Error:`, error);
          }
        }
      },
      onStateChange: (state, ctx) => {
        const currentStreamId = ctx.streamId || streamId;
        
        // Update connection state for display
        if (displayMetrics) {
          displayMetrics.connectionStates[currentStreamId] = state;
        }
        
        // Update health checker - preserve event count
        if (healthChecker) {
          const currentCount = streamEventCounts.get(currentStreamId) || 0;
          const health: StreamHealth = {
            state,
            lastEventAt: Date.now(),
            eventsReceived: currentCount,
          };
          healthChecker.updateStreamHealth(currentStreamId, health);
        }

        // Update metrics
        if (metricsCollector) {
          metricsCollector.recordConnectionState(currentStreamId, state);
        }

        if (logger) {
          logger.info(`Connection state: ${state}`, { streamId: currentStreamId });
        } else {
          console.error(`[${currentStreamId}] Connection state: ${state}`);
        }
      },
    });

    streams.push(stream);
  });

  return streams;
}

/** CLI entry point. */
export async function main(args: string[] = hideBin(process.argv)): Promise<void> {
  try {
    let options = parseArgs(args);

    // Handle --init flag for config generation
    if (options.init) {
      await generateConfig();
      return;
    }

    // Handle --interactive flag for wizard mode
    if (options.interactive) {
      options = await runWizard();
    } else {
      // Load config from files and merge with CLI args
      options = await loadConfig(options);
    }

    // Handle --validate flag
    if (options.validate) {
      validateOptions(options);
      console.log('✅ Configuration is valid\n');
      process.exit(0);
    }

    // Validate options
    validateOptions(options);

    // Initialize monitoring components
    const logger = new StructuredLogger(
      options.logLevel || 'info',
      options.logFormat || 'text'
    );

    // Create progress display based on mode
    const displayMode = options.quiet ? 'quiet' : options.verbose ? 'verbose' : 'normal';
    const progressDisplay = new ProgressDisplay(displayMode);
    
    // Track metrics for display
    const startTime = Date.now();
    const connectionStates: Record<string, string> = {};

    const metricsCollector = options.metricsPort ? new MetricsCollector() : undefined;
    const healthChecker = options.healthPort ? new HealthChecker(options.healthPort) : undefined;
    const perfMonitor = options.perf ? new PerformanceMonitor() : undefined;
    const alertMonitor = options.monitoring?.alerts && options.monitoring.alerts.length > 0
      ? new AlertMonitor(options.monitoring.alerts, logger)
      : undefined;

    // Start monitoring services
    if (healthChecker) {
      healthChecker.start();
      logger.info(`Health check endpoint started on port ${options.healthPort}`);
    }

    if (metricsCollector && options.metricsPort) {
      // Start metrics HTTP server
      const metricsServer = createServer(async (req, res) => {
        if (req.url === '/metrics' && req.method === 'GET') {
          const metrics = await metricsCollector.getPrometheusMetrics();
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end(metrics);
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
        }
      });
      metricsServer.listen(options.metricsPort);
      logger.info(`Metrics endpoint started on port ${options.metricsPort}`);
    }

    if (perfMonitor) {
      perfMonitor.startMemoryMonitoring();
      logger.info('Performance monitoring enabled');
      
      // Log performance metrics periodically
      setInterval(() => {
        const metrics = perfMonitor.getMetrics();
        logger.info('Performance metrics', {
          eventProcessing: metrics.eventProcessing,
          memoryUsage: metrics.memoryUsage,
        });
        
        // Check alerts if configured
        if (alertMonitor) {
          alertMonitor.checkMetric('event_processing_avg', metrics.eventProcessing.average);
          alertMonitor.checkMetric('memory_usage', metrics.memoryUsage.current);
        }
      }, 60000); // Every 60 seconds
    }

    // Create processing pipeline if filters or transforms are configured
    const pipeline = (options.filters && options.filters.length > 0) || options.transforms || options.aggregate
      ? new ProcessingPipeline({
          filters: options.filters,
          transforms: options.transforms,
          aggregate: options.aggregate,
        })
      : undefined;

    const { handler: outputHandler, cleanup } = createOutputHandler(options);
    
    // Create display metrics tracker
    const displayMetricsTracker = {
      totalEvents: { value: 0 },
      totalPairs: { value: 0 },
      totalDataBytes: { value: 0 },
      startTime,
      connectionStates,
    };
    
    const streams = createStreams(
      options, 
      outputHandler, 
      pipeline, 
      healthChecker, 
      metricsCollector, 
      logger, 
      perfMonitor,
      progressDisplay,
      displayMetricsTracker
    );

    // Setup stream controller for pause/resume
    const streamController = new StreamController(streams);
    streamController.setupSignalHandlers();

    // Start progress display
    progressDisplay.start();

    logger.info(`Starting ${streams.length} stream(s)...`);
    options.pageUrl.forEach((url, i) => {
      logger.info(`  stream-${i + 1}: ${url}`);
    });

    streams.forEach((stream) => stream.start());

    const shutdown = () => {
      logger.info('Shutting down...');
      progressDisplay.stop();
      streams.forEach((stream) => stream.stop());
      if (cleanup) {
        cleanup();
      }
      if (healthChecker) {
        healthChecker.stop();
      }
      if (perfMonitor) {
        perfMonitor.stopMemoryMonitoring();
      }
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    // Handle errors with detailed messages
    if (error instanceof DexScreenerError) {
      console.error(error.toString());
    } else if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
      if (error.stack) {
        console.error(error.stack);
      }
    } else {
      console.error(`Unknown error: ${String(error)}`);
    }
    process.exit(1);
  }
}

const isMainModule = process.argv[1]?.includes('cli') && !process.argv[1]?.includes('test');
if (isMainModule) {
  main();
}


