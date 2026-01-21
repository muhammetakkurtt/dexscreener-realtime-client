import type { LogLevel } from '../types.js';
import type { LogEntry } from './types.js';

/**
 * StructuredLogger provides leveled, structured logging with JSON and text formats.
 */
export class StructuredLogger {
  private level: LogLevel;
  private format: 'text' | 'json';
  private levelPriority: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
  };

  constructor(level: LogLevel = 'info', format: 'text' | 'json' = 'text') {
    this.level = level;
    this.format = format;
  }

  /**
   * Log an error message.
   */
  error(message: string, context?: Record<string, unknown>, error?: Error): void {
    this.log('error', message, context, error);
  }

  /**
   * Log a warning message.
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  /**
   * Log an info message.
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  /**
   * Log a debug message.
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  /**
   * Internal log method that handles level filtering and formatting.
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): void {
    // Filter by log level
    if (this.levelPriority[level] > this.levelPriority[this.level]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error,
    };

    if (this.format === 'json') {
      this.outputJson(entry);
    } else {
      this.outputText(entry);
    }
  }

  /**
   * Output log entry in JSON format.
   */
  private outputJson(entry: LogEntry): void {
    const output: Record<string, unknown> = {
      timestamp: entry.timestamp,
      level: entry.level,
      message: entry.message,
    };

    if (entry.context) {
      output.context = entry.context;
    }

    if (entry.error) {
      output.error = {
        name: entry.error.name,
        message: entry.error.message,
        stack: entry.error.stack,
      };
    }

    console.log(JSON.stringify(output));
  }

  /**
   * Output log entry in human-readable text format.
   */
  private outputText(entry: LogEntry): void {
    const levelStr = entry.level.toUpperCase().padEnd(5);
    let output = `[${entry.timestamp}] ${levelStr} ${entry.message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      output += ` ${JSON.stringify(entry.context)}`;
    }

    if (entry.error) {
      output += `\n  Error: ${entry.error.message}`;
      if (entry.error.stack) {
        output += `\n  Stack: ${entry.error.stack}`;
      }
    }

    console.log(output);
  }
}
