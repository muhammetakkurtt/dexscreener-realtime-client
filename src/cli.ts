import 'dotenv/config';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as fs from 'fs';
import { DexScreenerStream } from './client.js';
import type { CliOutputEvent, DexEvent, StreamContext } from './types.js';

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
      demandOption: true,
      describe: 'Apify Standby Actor base URL',
    })
    .option('api-token', {
      type: 'string',
      describe: 'Apify API token (or set APIFY_TOKEN env var)',
    })
    .option('page-url', {
      type: 'string',
      array: true,
      demandOption: true,
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
    .help()
    .alias('h', 'help')
    .version(false)
    .strict()
    .parseSync();

  const apiToken = parsed['api-token'] || process.env.APIFY_TOKEN || '';

  return {
    baseUrl: parsed['base-url'],
    apiToken,
    pageUrl: parsed['page-url'],
    mode: parsed.mode as CliMode,
    jsonlPath: parsed['jsonl-path'],
    webhookUrl: parsed['webhook-url'],
    retryMs: parsed['retry-ms'],
  };
}

/** Validates CLI options and exits on error. */
export function validateOptions(options: CliOptions): void {
  if (!options.apiToken) {
    console.error('Error: API token is required. Use --api-token or set APIFY_TOKEN environment variable.');
    process.exit(1);
  }

  if (options.mode === 'jsonl' && !options.jsonlPath) {
    console.error('Error: --jsonl-path is required when mode is jsonl');
    process.exit(1);
  }

  if (options.mode === 'webhook' && !options.webhookUrl) {
    console.error('Error: --webhook-url is required when mode is webhook');
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

function handleJsonl(output: CliOutputEvent, filePath: string): void {
  try {
    fs.appendFileSync(filePath, JSON.stringify(output) + '\n');
  } catch (error) {
    console.error(`Error writing to ${filePath}:`, error);
  }
}

async function handleWebhook(output: CliOutputEvent, webhookUrl: string): Promise<void> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(output),
    });

    if (!response.ok) {
      console.error(`Webhook returned non-2xx status: ${response.status}`);
    }
  } catch (error) {
    console.error('Webhook error:', error);
  }
}

function createOutputHandler(options: CliOptions): (output: CliOutputEvent) => void {
  switch (options.mode) {
    case 'stdout':
      return handleStdout;
    case 'jsonl':
      return (output) => handleJsonl(output, options.jsonlPath!);
    case 'webhook':
      return (output) => { handleWebhook(output, options.webhookUrl!); };
  }
}

/** Creates stream instances from CLI options. */
export function createStreams(
  options: CliOptions,
  outputHandler: (output: CliOutputEvent) => void
): DexScreenerStream[] {
  const streams: DexScreenerStream[] = [];

  options.pageUrl.forEach((pageUrl, index) => {
    const streamId = `stream-${index + 1}`;

    const stream = new DexScreenerStream({
      baseUrl: options.baseUrl,
      apiToken: options.apiToken,
      pageUrl,
      streamId,
      retryMs: options.retryMs,
      onBatch: (event: DexEvent, ctx: StreamContext) => {
        const output = createOutputEvent(ctx.streamId || streamId, pageUrl, event);
        outputHandler(output);
      },
      onError: (error: unknown, ctx: StreamContext) => {
        console.error(`[${ctx.streamId || streamId}] Error:`, error);
      },
      onStateChange: (state, ctx) => {
        console.error(`[${ctx.streamId || streamId}] Connection state: ${state}`);
      },
    });

    streams.push(stream);
  });

  return streams;
}

/** CLI entry point. */
export function main(args: string[] = hideBin(process.argv)): void {
  const options = parseArgs(args);
  validateOptions(options);

  const outputHandler = createOutputHandler(options);
  const streams = createStreams(options, outputHandler);

  console.error(`Starting ${streams.length} stream(s)...`);
  options.pageUrl.forEach((url, i) => {
    console.error(`  stream-${i + 1}: ${url}`);
  });

  streams.forEach((stream) => stream.start());

  const shutdown = () => {
    console.error('Shutting down...');
    streams.forEach((stream) => stream.stop());
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

const isMainModule = process.argv[1]?.includes('cli') && !process.argv[1]?.includes('test');
if (isMainModule) {
  main();
}
