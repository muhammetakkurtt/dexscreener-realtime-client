import type { PerformanceMetrics, PerformanceStats } from './types.js';

/**
 * PerformanceMonitor tracks event processing duration and memory usage.
 */
export class PerformanceMonitor {
  private eventDurations: number[] = [];
  private memorySnapshots: number[] = [];
  private peakMemory: number = 0;
  private monitoringInterval: NodeJS.Timeout | null = null;

  /**
   * Start monitoring memory usage at regular intervals.
   */
  startMemoryMonitoring(intervalMs: number = 5000): void {
    if (this.monitoringInterval) {
      return;
    }

    this.monitoringInterval = setInterval(() => {
      this.sampleMemoryUsage();
    }, intervalMs);
  }

  /**
   * Stop monitoring memory usage.
   */
  stopMemoryMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Track event processing duration.
   */
  trackEventDuration(durationMs: number): void {
    this.eventDurations.push(durationMs);
  }

  /**
   * Sample current memory usage.
   */
  sampleMemoryUsage(): void {
    const memUsage = process.memoryUsage();
    const heapUsed = memUsage.heapUsed;
    
    this.memorySnapshots.push(heapUsed);
    
    if (heapUsed > this.peakMemory) {
      this.peakMemory = heapUsed;
    }
  }

  /**
   * Get current performance metrics.
   */
  getMetrics(): PerformanceMetrics {
    const lastSnapshot = this.memorySnapshots[this.memorySnapshots.length - 1];
    const currentMemory = lastSnapshot !== undefined ? lastSnapshot : 0;

    return {
      eventProcessing: this.calculateStats(this.eventDurations),
      memoryUsage: {
        current: currentMemory,
        peak: this.peakMemory,
        samples: this.memorySnapshots.length,
      },
    };
  }

  /**
   * Reset all collected metrics.
   */
  reset(): void {
    this.eventDurations = [];
    this.memorySnapshots = [];
    this.peakMemory = 0;
  }

  /**
   * Calculate statistics from a set of values.
   */
  private calculateStats(values: number[]): PerformanceStats {
    if (values.length === 0) {
      return {
        average: 0,
        min: 0,
        max: 0,
        count: 0,
      };
    }

    const sum = values.reduce((acc, val) => acc + val, 0);
    const average = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    return {
      average,
      min,
      max,
      count: values.length,
    };
  }
}
