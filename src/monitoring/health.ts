import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import type { HealthStatus, StreamHealth } from './types.js';

/**
 * HealthChecker provides an HTTP health check endpoint for monitoring.
 */
export class HealthChecker {
  private server: Server | null = null;
  private port: number;
  private streams: Map<string, StreamHealth> = new Map();
  private startTime: number = Date.now();

  constructor(port: number) {
    this.port = port;
  }

  /**
   * Start the health check HTTP server.
   */
  start(): void {
    if (this.server) {
      return;
    }

    this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (req.url === '/health' && req.method === 'GET') {
        this.handleHealthRequest(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    });

    this.server.listen(this.port);
  }

  /**
   * Stop the health check HTTP server.
   */
  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  /**
   * Update health information for a stream.
   */
  updateStreamHealth(streamId: string, health: StreamHealth): void {
    this.streams.set(streamId, health);
  }

  /**
   * Get current health status.
   */
  getStatus(): HealthStatus {
    const status = this.calculateOverallStatus();
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);

    const streams: Record<string, StreamHealth> = {};
    for (const [streamId, health] of this.streams.entries()) {
      streams[streamId] = health;
    }

    return {
      status,
      streams,
      uptime,
    };
  }

  /**
   * Handle health check request.
   */
  private handleHealthRequest(res: ServerResponse): void {
    const status = this.getStatus();
    const statusCode = status.status === 'unhealthy' ? 503 : 200;

    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status, null, 2));
  }

  /**
   * Calculate overall health status based on stream states.
   */
  private calculateOverallStatus(): 'healthy' | 'degraded' | 'unhealthy' {
    if (this.streams.size === 0) {
      return 'healthy';
    }

    let connectedCount = 0;
    let disconnectedCount = 0;

    for (const health of this.streams.values()) {
      if (health.state === 'connected') {
        connectedCount++;
      } else if (health.state === 'disconnected') {
        disconnectedCount++;
      }
    }

    // All streams connected = healthy
    if (connectedCount === this.streams.size) {
      return 'healthy';
    }

    // All streams disconnected = unhealthy
    if (disconnectedCount === this.streams.size) {
      return 'unhealthy';
    }

    // Mixed states = degraded
    return 'degraded';
  }
}
