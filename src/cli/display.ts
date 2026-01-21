import chalk from 'chalk';
import ora, { Ora } from 'ora';
import type { DisplayMetrics } from '../types.js';

/**
 * Display mode for CLI visual feedback.
 */
export type DisplayMode = 'normal' | 'verbose' | 'quiet';

/**
 * ProgressDisplay provides real-time visual feedback for CLI operations.
 * 
 * Features:
 * - Progress spinners with ora
 * - Colored output (red errors, yellow warnings, green success)
 * - Real-time metrics display (EPS, data rate, uptime, totals)
 * - Support for normal, verbose, and quiet modes
 */
export class ProgressDisplay {
  private mode: DisplayMode;
  private spinner: Ora | null = null;
  private updateInterval: NodeJS.Timeout | null = null;
  private currentMetrics: DisplayMetrics | null = null;

  constructor(mode: DisplayMode = 'normal') {
    this.mode = mode;
  }

  /**
   * Start the progress display.
   */
  start(): void {
    
    if (this.mode === 'quiet') {
      // Quiet mode: no visual feedback except errors
      return;
    }

    // Create spinner for normal and verbose modes
    this.spinner = ora({
      text: chalk.blue('Initializing stream...'),
      color: 'blue',
    }).start();

    // Update display every second in normal/verbose mode
    this.updateInterval = setInterval(() => {
      if (this.currentMetrics) {
        this.updateDisplay();
      }
    }, 1000);
  }

  /**
   * Update the display with new metrics.
   */
  update(metrics: DisplayMetrics): void {
    this.currentMetrics = metrics;
    
    if (this.mode !== 'quiet' && this.spinner) {
      this.updateDisplay();
    }
  }

  /**
   * Stop the progress display.
   */
  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  /**
   * Display an error message.
   */
  showError(message: string): void {
    // Always show errors, even in quiet mode
    if (this.spinner) {
      this.spinner.fail(chalk.red(`✖ ${message}`));
      // Restart spinner after showing error
      this.spinner = ora().start();
    } else {
      console.error(chalk.red(`✖ ${message}`));
    }
  }

  /**
   * Display a warning message.
   */
  showWarning(message: string): void {
    if (this.mode === 'quiet') {
      return;
    }

    if (this.spinner) {
      const currentText = this.spinner.text;
      this.spinner.warn(chalk.yellow(`⚠ ${message}`));
      // Restart spinner with previous text
      this.spinner = ora({ text: currentText }).start();
    } else {
      console.warn(chalk.yellow(`⚠ ${message}`));
    }
  }

  /**
   * Display a success message.
   */
  showSuccess(message: string): void {
    if (this.mode === 'quiet') {
      return;
    }

    if (this.spinner) {
      this.spinner.succeed(chalk.green(`✓ ${message}`));
      // Restart spinner
      this.spinner = ora().start();
    } else {
      console.log(chalk.green(`✓ ${message}`));
    }
  }

  /**
   * Update the spinner text with current metrics.
   */
  private updateDisplay(): void {
    if (!this.currentMetrics || !this.spinner) {
      return;
    }

    const { eventsPerSecond, dataRateMBps, totalEvents, totalPairs, uptimeSeconds, connectionStates } = this.currentMetrics;

    // Format uptime
    const uptime = this.formatUptime(uptimeSeconds);

    // Format data rate
    const dataRate = this.formatDataRate(dataRateMBps);

    // Count connection states
    const states = Object.values(connectionStates);
    const connected = states.filter(s => s === 'connected').length;
    const total = states.length;

    // Build status text
    let statusText = '';

    if (this.mode === 'verbose') {
      // Verbose mode: show detailed information
      statusText = [
        chalk.blue('Streaming'),
        chalk.gray('│'),
        chalk.cyan(`${eventsPerSecond.toFixed(1)} EPS`),
        chalk.gray('│'),
        chalk.cyan(dataRate),
        chalk.gray('│'),
        chalk.green(`${totalEvents} events`),
        chalk.gray('│'),
        chalk.green(`${totalPairs} pairs`),
        chalk.gray('│'),
        chalk.magenta(`↑ ${uptime}`),
        chalk.gray('│'),
        this.formatConnectionStatus(connected, total),
      ].join(' ');

      // Add per-stream details in verbose mode
      if (Object.keys(connectionStates).length > 1) {
        const streamDetails = Object.entries(connectionStates)
          .map(([streamId, state]) => {
            const stateColor = this.getStateColor(state);
            return `${chalk.gray(streamId)}: ${stateColor(state)}`;
          })
          .join(', ');
        statusText += chalk.gray(` [${streamDetails}]`);
      }
    } else {
      // Normal mode: show essential metrics
      statusText = [
        chalk.blue('Streaming'),
        chalk.gray('│'),
        chalk.cyan(`${eventsPerSecond.toFixed(1)} EPS`),
        chalk.gray('│'),
        chalk.green(`${totalEvents} events`),
        chalk.gray('│'),
        chalk.green(`${totalPairs} pairs`),
        chalk.gray('│'),
        chalk.magenta(`↑ ${uptime}`),
        chalk.gray('│'),
        this.formatConnectionStatus(connected, total),
      ].join(' ');
    }

    this.spinner.text = statusText;
  }

  /**
   * Format uptime in human-readable format.
   */
  private formatUptime(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${minutes}m ${secs}s`;
    } else if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    } else {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      return `${days}d ${hours}h`;
    }
  }

  /**
   * Format data rate in human-readable format.
   */
  private formatDataRate(mbps: number): string {
    if (mbps < 0.001) {
      return `${(mbps * 1024 * 1024).toFixed(0)} B/s`;
    } else if (mbps < 1) {
      return `${(mbps * 1024).toFixed(1)} KB/s`;
    } else {
      return `${mbps.toFixed(2)} MB/s`;
    }
  }

  /**
   * Format connection status with color.
   */
  private formatConnectionStatus(connected: number, total: number): string {
    if (connected === total) {
      return chalk.green(`${connected}/${total} connected`);
    } else if (connected === 0) {
      return chalk.red(`${connected}/${total} connected`);
    } else {
      return chalk.yellow(`${connected}/${total} connected`);
    }
  }

  /**
   * Get color function for connection state.
   */
  private getStateColor(state: string): (text: string) => string {
    switch (state) {
      case 'connected':
        return chalk.green;
      case 'connecting':
      case 'reconnecting':
        return chalk.yellow;
      case 'disconnected':
        return chalk.red;
      default:
        return chalk.gray;
    }
  }
}
