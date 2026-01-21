export interface BatchConfig {
  maxSize: number; // Max events per batch
  maxWaitMs: number; // Max time to wait before flushing
}

export class Batcher<T> {
  private config: BatchConfig;
  private onFlush: (items: T[]) => void;
  private items: T[] = [];
  private timer: NodeJS.Timeout | null = null;

  constructor(config: BatchConfig, onFlush: (items: T[]) => void) {
    this.config = config;
    this.onFlush = onFlush;
  }

  /**
   * Add an item to the batch
   * @param item - Item to add
   */
  add(item: T): void {
    this.items.push(item);

    // Check if we should flush based on size
    if (this.items.length >= this.config.maxSize) {
      this.flush();
      return;
    }

    // Start timer if not already running
    if (!this.timer) {
      this.startTimer();
    }
  }

  /**
   * Flush all accumulated items
   */
  flush(): void {
    // Clear timer
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    // Skip if no items
    if (this.items.length === 0) {
      return;
    }

    // Call flush callback with items
    const itemsToFlush = [...this.items];
    this.items = [];

    try {
      this.onFlush(itemsToFlush);
    } catch (error) {
      console.error('Batch flush failed:', error);
    }
  }

  /**
   * Clear all accumulated items without flushing
   */
  clear(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.items = [];
  }

  /**
   * Start the flush timer
   */
  private startTimer(): void {
    this.timer = setTimeout(() => {
      this.flush();
    }, this.config.maxWaitMs);
  }

  /**
   * Get the current number of items in the batch
   * @returns Number of items
   */
  size(): number {
    return this.items.length;
  }

  /**
   * Destroy the batcher and cleanup resources
   */
  destroy(): void {
    this.flush();
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
