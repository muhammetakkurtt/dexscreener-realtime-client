export interface ThrottleConfig {
  maxPerSecond: number;
  dropStrategy: 'oldest' | 'newest' | 'random';
}

export class Throttler<T> {
  private config: ThrottleConfig;
  private processedCount: number = 0;
  private droppedCount: number = 0;
  private windowStart: number = Date.now();
  private readonly windowMs: number = 1000; // 1 second window
  private itemQueue: T[] = [];

  constructor(config: ThrottleConfig) {
    this.config = config;
  }

  /**
   * Check if an item should be processed based on rate limit
   * @param item - Item to check for processing
   * @returns True if item should be processed, false if it should be dropped
   */
  shouldProcess(item: T): boolean {
    const now = Date.now();
    const elapsed = now - this.windowStart;

    // Reset window if more than 1 second has passed
    if (elapsed >= this.windowMs) {
      this.processedCount = 0;
      this.windowStart = now;
      this.itemQueue = [];
    }

    // Check if we're under the rate limit
    if (this.processedCount < this.config.maxPerSecond) {
      this.processedCount++;
      this.itemQueue.push(item);
      return true;
    }

    // Rate limit exceeded, apply drop strategy
    this.droppedCount++;
    this.applyDropStrategy(item);
    return false;
  }

  /**
   * Apply the configured drop strategy when rate limit is exceeded
   * @param newItem - The new item that would be dropped
   */
  private applyDropStrategy(newItem: T): void {
    if (this.itemQueue.length === 0) {
      return;
    }

    switch (this.config.dropStrategy) {
      case 'oldest':
        // Drop the oldest item (first in queue) and add the new one
        this.itemQueue.shift();
        this.itemQueue.push(newItem);
        break;
      
      case 'newest':
        // Drop the new item (do nothing, it's already not added)
        break;
      
      case 'random':
        // Drop a random item from the queue and add the new one
        const randomIndex = Math.floor(Math.random() * this.itemQueue.length);
        this.itemQueue.splice(randomIndex, 1);
        this.itemQueue.push(newItem);
        break;
    }
  }

  /**
   * Get the number of dropped items
   * @returns Number of dropped items
   */
  getDroppedCount(): number {
    return this.droppedCount;
  }

  /**
   * Reset the throttler state
   */
  reset(): void {
    this.processedCount = 0;
    this.droppedCount = 0;
    this.windowStart = Date.now();
    this.itemQueue = [];
  }

  /**
   * Get current statistics
   * @returns Object with processed and dropped counts
   */
  getStats(): { processed: number; dropped: number } {
    return {
      processed: this.processedCount,
      dropped: this.droppedCount
    };
  }
}
