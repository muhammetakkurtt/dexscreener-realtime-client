import { Counter, Gauge, Histogram, Registry } from 'prom-client';
import type { ConnectionState } from '../types.js';

/**
 * MetricsCollector collects and exposes performance metrics in Prometheus format.
 */
export class MetricsCollector {
  private registry: Registry;
  private eventsReceived: Counter<'streamId'>;
  private pairsProcessed: Counter<'streamId'>;
  private eventProcessingDuration: Histogram<'streamId'>;
  private connectionState: Gauge<'streamId'>;
  private eventsPerSecond: Gauge<'streamId'>;
  private memoryUsage: Gauge;

  constructor() {
    this.registry = new Registry();

    // Counter for total events received per stream
    this.eventsReceived = new Counter({
      name: 'dexscreener_events_received_total',
      help: 'Total number of events received per stream',
      labelNames: ['streamId'],
      registers: [this.registry],
    });

    // Counter for total pairs processed per stream
    this.pairsProcessed = new Counter({
      name: 'dexscreener_pairs_processed_total',
      help: 'Total number of pairs processed per stream',
      labelNames: ['streamId'],
      registers: [this.registry],
    });

    // Histogram for event processing duration
    this.eventProcessingDuration = new Histogram({
      name: 'dexscreener_event_processing_duration_ms',
      help: 'Event processing duration in milliseconds',
      labelNames: ['streamId'],
      buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
      registers: [this.registry],
    });

    // Gauge for connection state (0=disconnected, 1=connecting, 2=connected, 3=reconnecting)
    this.connectionState = new Gauge({
      name: 'dexscreener_connection_state',
      help: 'Current connection state (0=disconnected, 1=connecting, 2=connected, 3=reconnecting)',
      labelNames: ['streamId'],
      registers: [this.registry],
    });

    // Gauge for events per second
    this.eventsPerSecond = new Gauge({
      name: 'dexscreener_events_per_second',
      help: 'Current events per second rate per stream',
      labelNames: ['streamId'],
      registers: [this.registry],
    });

    // Gauge for memory usage
    this.memoryUsage = new Gauge({
      name: 'dexscreener_memory_usage_bytes',
      help: 'Current memory usage in bytes',
      registers: [this.registry],
    });
  }

  /**
   * Record an event with pair count and processing duration.
   */
  recordEvent(streamId: string, pairCount: number, durationMs: number): void {
    this.eventsReceived.inc({ streamId }, 1);
    this.pairsProcessed.inc({ streamId }, pairCount);
    this.eventProcessingDuration.observe({ streamId }, durationMs);
  }

  /**
   * Record connection state change.
   */
  recordConnectionState(streamId: string, state: ConnectionState): void {
    const stateValue = this.connectionStateToNumber(state);
    this.connectionState.set({ streamId }, stateValue);
  }

  /**
   * Update events per second metric.
   */
  updateEventsPerSecond(streamId: string, rate: number): void {
    this.eventsPerSecond.set({ streamId }, rate);
  }

  /**
   * Update memory usage metric.
   */
  updateMemoryUsage(): void {
    const memUsage = process.memoryUsage();
    this.memoryUsage.set(memUsage.heapUsed);
  }

  /**
   * Get Prometheus metrics in text format.
   */
  async getPrometheusMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Convert connection state to numeric value.
   */
  private connectionStateToNumber(state: ConnectionState): number {
    switch (state) {
      case 'disconnected':
        return 0;
      case 'connecting':
        return 1;
      case 'connected':
        return 2;
      case 'reconnecting':
        return 3;
      default:
        return 0;
    }
  }
}
