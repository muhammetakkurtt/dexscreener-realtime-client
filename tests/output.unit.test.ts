import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Compressor } from '../src/output/compressor';
import { Batcher } from '../src/output/batcher';
import { Throttler } from '../src/output/throttler';
import { Sampler } from '../src/output/sampler';
import { gunzipSync } from 'zlib';

describe('Compressor', () => {
  describe('compress', () => {
    it('should compress string data', async () => {
      const data = 'Hello, World!';
      const compressed = await Compressor.compress(data);
      
      expect(compressed).toBeInstanceOf(Buffer);
      expect(compressed.length).toBeLessThan(Buffer.from(data).length + 50); // Allow for small data overhead
    });

    it('should compress buffer data', async () => {
      const data = Buffer.from('Hello, World!');
      const compressed = await Compressor.compress(data);
      
      expect(compressed).toBeInstanceOf(Buffer);
    });

    it('should decompress to original data', async () => {
      const original = 'Hello, World! This is a longer string to compress.';
      const compressed = await Compressor.compress(original);
      const decompressed = gunzipSync(compressed).toString('utf-8');
      
      expect(decompressed).toBe(original);
    });
  });

  describe('compressSync', () => {
    it('should compress string data synchronously', () => {
      const data = 'Hello, World!';
      const compressed = Compressor.compressSync(data);
      
      expect(compressed).toBeInstanceOf(Buffer);
    });

    it('should decompress to original data', () => {
      const original = 'Hello, World! This is a longer string to compress.';
      const compressed = Compressor.compressSync(original);
      const decompressed = gunzipSync(compressed).toString('utf-8');
      
      expect(decompressed).toBe(original);
    });
  });
});

describe('Batcher', () => {
  let flushedItems: number[][] = [];
  let batcher: Batcher<number>;

  beforeEach(() => {
    flushedItems = [];
    batcher = new Batcher<number>(
      { maxSize: 3, maxWaitMs: 100 },
      (items) => flushedItems.push([...items])
    );
  });

  afterEach(() => {
    batcher.destroy();
  });

  describe('add', () => {
    it('should accumulate items', () => {
      batcher.add(1);
      batcher.add(2);
      
      expect(batcher.size()).toBe(2);
    });

    it('should flush when maxSize is reached', () => {
      batcher.add(1);
      batcher.add(2);
      batcher.add(3);
      
      expect(flushedItems).toEqual([[1, 2, 3]]);
      expect(batcher.size()).toBe(0);
    });

    it('should flush on timer', async () => {
      batcher.add(1);
      batcher.add(2);
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(flushedItems).toEqual([[1, 2]]);
    });
  });

  describe('flush', () => {
    it('should flush all accumulated items', () => {
      batcher.add(1);
      batcher.add(2);
      batcher.flush();
      
      expect(flushedItems).toEqual([[1, 2]]);
      expect(batcher.size()).toBe(0);
    });

    it('should not flush if no items', () => {
      batcher.flush();
      
      expect(flushedItems).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should clear items without flushing', () => {
      batcher.add(1);
      batcher.add(2);
      batcher.clear();
      
      expect(flushedItems).toEqual([]);
      expect(batcher.size()).toBe(0);
    });
  });
});

describe('Throttler', () => {
  let throttler: Throttler<string>;

  beforeEach(() => {
    throttler = new Throttler<string>({
      maxPerSecond: 2,
      dropStrategy: 'oldest',
    });
  });

  describe('shouldProcess', () => {
    it('should allow items under rate limit', () => {
      expect(throttler.shouldProcess('item1')).toBe(true);
      expect(throttler.shouldProcess('item2')).toBe(true);
    });

    it('should drop items over rate limit', () => {
      throttler.shouldProcess('item1');
      throttler.shouldProcess('item2');
      
      expect(throttler.shouldProcess('item3')).toBe(false);
      expect(throttler.getDroppedCount()).toBe(1);
    });

    it('should reset after time window', async () => {
      throttler.shouldProcess('item1');
      throttler.shouldProcess('item2');
      throttler.shouldProcess('item3'); // Dropped
      
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      expect(throttler.shouldProcess('item4')).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      throttler.shouldProcess('item1');
      throttler.shouldProcess('item2');
      throttler.shouldProcess('item3'); // Dropped
      
      const stats = throttler.getStats();
      expect(stats.processed).toBe(2);
      expect(stats.dropped).toBe(1);
    });
  });

  describe('reset', () => {
    it('should reset all counters', () => {
      throttler.shouldProcess('item1');
      throttler.shouldProcess('item2');
      throttler.shouldProcess('item3'); // Dropped
      
      throttler.reset();
      
      const stats = throttler.getStats();
      expect(stats.processed).toBe(0);
      expect(stats.dropped).toBe(0);
    });
  });

  describe('drop strategies', () => {
    it('should apply oldest drop strategy', () => {
      const oldestThrottler = new Throttler<string>({
        maxPerSecond: 2,
        dropStrategy: 'oldest',
      });

      oldestThrottler.shouldProcess('item1');
      oldestThrottler.shouldProcess('item2');
      oldestThrottler.shouldProcess('item3'); // Should replace item1
      
      expect(oldestThrottler.getDroppedCount()).toBe(1);
    });

    it('should apply newest drop strategy', () => {
      const newestThrottler = new Throttler<string>({
        maxPerSecond: 2,
        dropStrategy: 'newest',
      });

      newestThrottler.shouldProcess('item1');
      newestThrottler.shouldProcess('item2');
      newestThrottler.shouldProcess('item3'); // Should drop item3
      
      expect(newestThrottler.getDroppedCount()).toBe(1);
    });

    it('should apply random drop strategy', () => {
      const randomThrottler = new Throttler<string>({
        maxPerSecond: 2,
        dropStrategy: 'random',
      });

      randomThrottler.shouldProcess('item1');
      randomThrottler.shouldProcess('item2');
      randomThrottler.shouldProcess('item3'); // Should replace random item
      
      expect(randomThrottler.getDroppedCount()).toBe(1);
    });
  });
});

describe('Sampler', () => {
  describe('shouldSample', () => {
    it('should always sample at 100% rate', () => {
      const sampler = new Sampler({ rate: 100 });
      
      for (let i = 0; i < 100; i++) {
        expect(sampler.shouldSample()).toBe(true);
      }
      
      expect(sampler.getActualRate()).toBe(100);
    });

    it('should never sample at 0% rate', () => {
      const sampler = new Sampler({ rate: 0 });
      
      for (let i = 0; i < 100; i++) {
        expect(sampler.shouldSample()).toBe(false);
      }
      
      expect(sampler.getActualRate()).toBe(0);
    });

    it('should sample approximately at configured rate', () => {
      const sampler = new Sampler({ rate: 50 });
      
      for (let i = 0; i < 1000; i++) {
        sampler.shouldSample();
      }
      
      const actualRate = sampler.getActualRate();
      // Allow 10% variance for randomness
      expect(actualRate).toBeGreaterThan(40);
      expect(actualRate).toBeLessThan(60);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      const sampler = new Sampler({ rate: 100 });
      
      sampler.shouldSample();
      sampler.shouldSample();
      sampler.shouldSample();
      
      const stats = sampler.getStats();
      expect(stats.total).toBe(3);
      expect(stats.sampled).toBe(3);
      expect(stats.actualRate).toBe(100);
    });
  });

  describe('reset', () => {
    it('should reset all counters', () => {
      const sampler = new Sampler({ rate: 50 });
      
      for (let i = 0; i < 10; i++) {
        sampler.shouldSample();
      }
      
      sampler.reset();
      
      const stats = sampler.getStats();
      expect(stats.total).toBe(0);
      expect(stats.sampled).toBe(0);
    });
  });

  describe('getConfiguredRate', () => {
    it('should return the configured rate', () => {
      const sampler = new Sampler({ rate: 75 });
      expect(sampler.getConfiguredRate()).toBe(75);
    });

    it('should clamp rate to 0-100 range', () => {
      const sampler1 = new Sampler({ rate: -10 });
      expect(sampler1.getConfiguredRate()).toBe(0);
      
      const sampler2 = new Sampler({ rate: 150 });
      expect(sampler2.getConfiguredRate()).toBe(100);
    });
  });
});
