import type { AlertConfig } from '../types.js';
import type { StructuredLogger } from './logger.js';

/**
 * AlertMonitor monitors metrics against configured thresholds and logs warnings.
 */
export class AlertMonitor {
  private alerts: AlertConfig[];
  private logger: StructuredLogger;

  constructor(alerts: AlertConfig[], logger: StructuredLogger) {
    this.alerts = alerts;
    this.logger = logger;
  }

  /**
   * Check a metric value against configured thresholds.
   */
  checkMetric(metricName: string, value: number): void {
    for (const alert of this.alerts) {
      if (alert.metric === metricName) {
        const violated = this.checkThreshold(value, alert.threshold, alert.comparison);
        
        if (violated) {
          this.logAlert(metricName, value, alert.threshold, alert.comparison);
        }
      }
    }
  }

  /**
   * Check if a value violates a threshold based on comparison operator.
   */
  private checkThreshold(
    value: number,
    threshold: number,
    comparison: 'lt' | 'gt' | 'eq'
  ): boolean {
    switch (comparison) {
      case 'lt':
        return value < threshold;
      case 'gt':
        return value > threshold;
      case 'eq':
        return value === threshold;
      default:
        return false;
    }
  }

  /**
   * Log an alert when a threshold is violated.
   */
  private logAlert(
    metricName: string,
    value: number,
    threshold: number,
    comparison: 'lt' | 'gt' | 'eq'
  ): void {
    const comparisonStr = this.comparisonToString(comparison);
    const message = `Alert: Metric '${metricName}' threshold violated`;
    
    this.logger.warn(message, {
      metric: metricName,
      value,
      threshold,
      comparison: comparisonStr,
    });
  }

  /**
   * Convert comparison operator to human-readable string.
   */
  private comparisonToString(comparison: 'lt' | 'gt' | 'eq'): string {
    switch (comparison) {
      case 'lt':
        return 'less than';
      case 'gt':
        return 'greater than';
      case 'eq':
        return 'equal to';
      default:
        return 'unknown';
    }
  }
}
