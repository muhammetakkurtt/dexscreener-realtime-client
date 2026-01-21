import type { DexScreenerStream } from '../client.js';

/**
 * State tracking for stream pause/resume functionality.
 */
export interface StreamControlState {
  paused: boolean;
  pausedAt?: number;
  resumedAt?: number;
}

/**
 * Controls stream lifecycle for pause/resume functionality.
 * Handles SIGUSR1 (pause) and SIGUSR2 (resume) signals on Unix systems.
 */
export class StreamController {
  private streams: DexScreenerStream[];
  private state: StreamControlState;

  constructor(streams: DexScreenerStream[]) {
    this.streams = streams;
    this.state = {
      paused: false,
    };
  }

  /**
   * Pauses all streams by stopping their connections.
   * Tracks the pause timestamp for state reporting.
   */
  pause(): void {
    if (this.state.paused) {
      return; // Already paused
    }

    for (const stream of this.streams) {
      stream.stop();
    }

    this.state = {
      paused: true,
      pausedAt: Date.now(),
      resumedAt: undefined,
    };
  }

  /**
   * Resumes all streams by restarting their connections.
   * Tracks the resume timestamp for state reporting.
   */
  resume(): void {
    if (!this.state.paused) {
      return; // Not paused
    }

    for (const stream of this.streams) {
      stream.start();
    }

    this.state = {
      paused: false,
      pausedAt: this.state.pausedAt,
      resumedAt: Date.now(),
    };
  }

  /**
   * Returns the current pause/resume state.
   */
  getState(): StreamControlState {
    return { ...this.state };
  }

  /**
   * Sets up signal handlers for SIGUSR1 (pause) and SIGUSR2 (resume).
   * Only works on Unix-like systems (Linux, macOS).
   * On Windows, these signals are not available.
   */
  setupSignalHandlers(): void {
    // Check if signals are available (Unix-like systems)
    if (process.platform === 'win32') {
      // Windows doesn't support SIGUSR1/SIGUSR2
      return;
    }

    process.on('SIGUSR1', () => {
      this.pause();
    });

    process.on('SIGUSR2', () => {
      this.resume();
    });
  }
}
