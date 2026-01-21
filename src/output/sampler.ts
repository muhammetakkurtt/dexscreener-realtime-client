export interface SamplingConfig {
  rate: number; // 0-100 percentage
}

export class Sampler {
  private rate: number;
  private sampledCount: number = 0;
  private totalCount: number = 0;

  constructor(config: SamplingConfig) {
    // Ensure rate is between 0 and 100
    this.rate = Math.max(0, Math.min(100, config.rate));
  }

  /**
   * Determine if an item should be sampled
   * @returns True if item should be sampled, false otherwise
   */
  shouldSample(): boolean {
    this.totalCount++;

    // Always sample if rate is 100
    if (this.rate >= 100) {
      this.sampledCount++;
      return true;
    }

    // Never sample if rate is 0
    if (this.rate <= 0) {
      return false;
    }

    // Random sampling based on rate
    const shouldSample = Math.random() * 100 < this.rate;
    
    if (shouldSample) {
      this.sampledCount++;
    }

    return shouldSample;
  }

  /**
   * Get the actual sampling rate based on samples taken
   * @returns Actual sampling rate as a percentage
   */
  getActualRate(): number {
    if (this.totalCount === 0) {
      return 0;
    }
    return (this.sampledCount / this.totalCount) * 100;
  }

  /**
   * Get sampling statistics
   * @returns Object with sampled, total, and actual rate
   */
  getStats(): { sampled: number; total: number; actualRate: number } {
    return {
      sampled: this.sampledCount,
      total: this.totalCount,
      actualRate: this.getActualRate()
    };
  }

  /**
   * Reset the sampler state
   */
  reset(): void {
    this.sampledCount = 0;
    this.totalCount = 0;
  }

  /**
   * Get the configured sampling rate
   * @returns Configured rate as a percentage
   */
  getConfiguredRate(): number {
    return this.rate;
  }
}
