/** Health status for a stream. */
export type StreamHealth = {
  state: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  lastEventAt?: number;
  eventsReceived: number;
};

/** Overall health status. */
export type HealthStatus = {
  status: 'healthy' | 'degraded' | 'unhealthy';
  streams: Record<string, StreamHealth>;
  uptime: number;
};

/** Log entry structure. */
export type LogEntry = {
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
};

/** Performance statistics. */
export type PerformanceStats = {
  average: number;
  min: number;
  max: number;
  count: number;
};

/** Performance metrics. */
export type PerformanceMetrics = {
  eventProcessing: PerformanceStats;
  memoryUsage: {
    current: number;
    peak: number;
    samples: number;
  };
};
