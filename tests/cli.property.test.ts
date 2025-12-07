import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createStreams, createOutputEvent, type CliOptions } from '../src/cli.js';
import type { CliOutputEvent } from '../src/types.js';

const pageUrlArb = fc.webUrl();
const pageUrlsArb = fc.array(pageUrlArb, { minLength: 1, maxLength: 10 });

const cliOptionsArb = fc.record({
  baseUrl: fc.webUrl(),
  apiToken: fc.string({ minLength: 10, maxLength: 50 }),
  pageUrl: pageUrlsArb,
  mode: fc.constant('stdout' as const),
  retryMs: fc.integer({ min: 100, max: 60000 }),
});

const dexEventArb = fc.record({
  event_type: fc.constant('pairs'),
  stats: fc.option(fc.record({
    h1: fc.option(fc.record({
      txns: fc.integer({ min: 0, max: 1000000 }),
      volumeUsd: fc.float({ min: 0, max: 1000000000 }),
    }), { nil: undefined }),
  }), { nil: undefined }),
  pairs: fc.array(
    fc.record({
      chainId: fc.constantFrom('solana', 'ethereum', 'bsc', 'base'),
      dexId: fc.constantFrom('raydium', 'uniswap', 'pancakeswap'),
      baseToken: fc.record({
        symbol: fc.string({ minLength: 1, maxLength: 10 }),
        address: fc.string({ minLength: 40, maxLength: 40 }),
      }),
      priceUsd: fc.float({ min: 0, max: 1000000 }).map(n => n.toString()),
    }),
    { minLength: 0, maxLength: 5 }
  ),
});

describe('CLI Stream Count', () => {
  it('should create exactly N streams for N page URLs', () => {
    fc.assert(
      fc.property(cliOptionsArb, (options) => {
        const outputHandler = () => {};
        const streams = createStreams(options, outputHandler);
        expect(streams.length).toBe(options.pageUrl.length);
      }),
      { numRuns: 100 }
    );
  });

  it('should create exactly one stream for single page URL', () => {
    fc.assert(
      fc.property(fc.webUrl(), fc.webUrl(), fc.string({ minLength: 10 }), (baseUrl, pageUrl, apiToken) => {
        const options: CliOptions = {
          baseUrl,
          apiToken,
          pageUrl: [pageUrl],
          mode: 'stdout',
          retryMs: 3000,
        };
        const streams = createStreams(options, () => {});
        expect(streams.length).toBe(1);
      }),
      { numRuns: 100 }
    );
  });
});

describe('CLI Output Structure', () => {
  it('should create output with all required fields', () => {
    const streamIdArb = fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0);
    
    fc.assert(
      fc.property(streamIdArb, pageUrlArb, dexEventArb, (streamId, pageUrl, event) => {
        const output = createOutputEvent(streamId, pageUrl, event);
        
        expect(output).toHaveProperty('streamId');
        expect(output).toHaveProperty('pageUrl');
        expect(output).toHaveProperty('timestamp');
        expect(output).toHaveProperty('event');
        
        expect(typeof output.streamId).toBe('string');
        expect(typeof output.pageUrl).toBe('string');
        expect(typeof output.timestamp).toBe('number');
        expect(typeof output.event).toBe('object');
        
        expect(output.streamId).toBe(streamId);
        expect(output.pageUrl).toBe(pageUrl);
        expect(output.event).toBe(event);
        expect(output.timestamp).toBeGreaterThan(0);
        expect(Number.isInteger(output.timestamp)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('should produce valid JSON when stringified', () => {
    const streamIdArb = fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0);
    
    fc.assert(
      fc.property(streamIdArb, pageUrlArb, dexEventArb, (streamId, pageUrl, event) => {
        const output = createOutputEvent(streamId, pageUrl, event);
        const jsonString = JSON.stringify(output);
        expect(typeof jsonString).toBe('string');
        const parsed = JSON.parse(jsonString);
        expect(parsed.streamId).toBe(output.streamId);
        expect(parsed.pageUrl).toBe(output.pageUrl);
        expect(parsed.timestamp).toBe(output.timestamp);
      }),
      { numRuns: 100 }
    );
  });
});

describe('JSONL Append Behavior', () => {
  let tempDir: string;
  
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-test-'));
  });
  
  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should append new events without overwriting existing content', () => {
    const streamIdArb = fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0 && !s.includes('\n'));
    
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            streamId: streamIdArb,
            pageUrl: fc.webUrl(),
            event: dexEventArb,
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (events) => {
          const filePath = path.join(tempDir, `test-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
          
          for (const { streamId, pageUrl, event } of events) {
            const output = createOutputEvent(streamId, pageUrl, event);
            fs.appendFileSync(filePath, JSON.stringify(output) + '\n');
          }
          
          const content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.trim().split('\n');
          
          expect(lines.length).toBe(events.length);
          
          for (let i = 0; i < lines.length; i++) {
            const parsed = JSON.parse(lines[i]) as CliOutputEvent;
            expect(parsed.streamId).toBe(events[i].streamId);
            expect(parsed.pageUrl).toBe(events[i].pageUrl);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve existing content when appending', () => {
    const streamIdArb = fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0 && !s.includes('\n'));
    
    fc.assert(
      fc.property(
        fc.record({
          streamId: streamIdArb,
          pageUrl: fc.webUrl(),
          event: dexEventArb,
        }),
        fc.record({
          streamId: streamIdArb,
          pageUrl: fc.webUrl(),
          event: dexEventArb,
        }),
        (firstEvent, secondEvent) => {
          const filePath = path.join(tempDir, `test-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
          
          const firstOutput = createOutputEvent(firstEvent.streamId, firstEvent.pageUrl, firstEvent.event);
          fs.appendFileSync(filePath, JSON.stringify(firstOutput) + '\n');
          const contentAfterFirst = fs.readFileSync(filePath, 'utf-8');
          
          const secondOutput = createOutputEvent(secondEvent.streamId, secondEvent.pageUrl, secondEvent.event);
          fs.appendFileSync(filePath, JSON.stringify(secondOutput) + '\n');
          const contentAfterSecond = fs.readFileSync(filePath, 'utf-8');
          
          expect(contentAfterSecond.startsWith(contentAfterFirst)).toBe(true);
          const lines = contentAfterSecond.trim().split('\n');
          expect(lines.length).toBe(2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should create file if it does not exist', () => {
    const streamIdArb = fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0 && !s.includes('\n'));
    
    fc.assert(
      fc.property(
        fc.record({
          streamId: streamIdArb,
          pageUrl: fc.webUrl(),
          event: dexEventArb,
        }),
        (eventData) => {
          const filePath = path.join(tempDir, `new-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
          expect(fs.existsSync(filePath)).toBe(false);
          
          const output = createOutputEvent(eventData.streamId, eventData.pageUrl, eventData.event);
          fs.appendFileSync(filePath, JSON.stringify(output) + '\n');
          
          expect(fs.existsSync(filePath)).toBe(true);
          const content = fs.readFileSync(filePath, 'utf-8');
          const parsed = JSON.parse(content.trim());
          expect(parsed.streamId).toBe(eventData.streamId);
        }
      ),
      { numRuns: 100 }
    );
  });
});
