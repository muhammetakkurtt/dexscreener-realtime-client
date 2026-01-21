import { createWriteStream, statSync, readdirSync, unlinkSync, existsSync } from 'fs';
import { WriteStream } from 'fs';
import { dirname, basename, join } from 'path';

export interface RotationConfig {
  maxSizeMB?: number;
  interval?: 'hourly' | 'daily';
  keepFiles?: number; // Max rotated files to keep
}

export class FileRotator {
  private basePath: string;
  private config: RotationConfig;
  private currentStream: WriteStream | null = null;
  private currentPath: string;
  private currentSize: number = 0;
  private lastRotationTime: number = Date.now();

  constructor(basePath: string, config: RotationConfig) {
    this.basePath = basePath;
    this.config = config;
    this.currentPath = basePath;
    this.initializeStream();
  }

  private initializeStream(): void {
    // Check if file exists and get its size
    if (existsSync(this.currentPath)) {
      try {
        const stats = statSync(this.currentPath);
        this.currentSize = stats.size;
      } catch (error) {
        this.currentSize = 0;
      }
    }

    this.currentStream = createWriteStream(this.currentPath, { flags: 'a' });
  }

  /**
   * Write data to the current file, rotating if necessary
   * @param data - Data to write
   */
  write(data: string): void {
    const dataSize = Buffer.byteLength(data, 'utf-8');

    // Check if rotation is needed
    if (this.shouldRotate(dataSize)) {
      this.rotate();
    }

    // Write data
    if (this.currentStream) {
      this.currentStream.write(data);
      this.currentSize += dataSize;
    }
  }

  /**
   * Get the current file path
   * @returns Current file path
   */
  getCurrentPath(): string {
    return this.currentPath;
  }

  /**
   * Check if rotation should occur
   * @param nextDataSize - Size of data about to be written
   * @returns True if rotation should occur
   */
  private shouldRotate(nextDataSize: number): boolean {
    // Size-based rotation
    if (this.config.maxSizeMB) {
      const maxSizeBytes = this.config.maxSizeMB * 1024 * 1024;
      if (this.currentSize + nextDataSize > maxSizeBytes) {
        return true;
      }
    }

    // Time-based rotation
    if (this.config.interval) {
      const now = Date.now();
      const elapsed = now - this.lastRotationTime;

      if (this.config.interval === 'hourly' && elapsed > 60 * 60 * 1000) {
        return true;
      }

      if (this.config.interval === 'daily' && elapsed > 24 * 60 * 60 * 1000) {
        return true;
      }
    }

    return false;
  }

  /**
   * Rotate the current file
   */
  rotate(): void {
    // Close current stream
    if (this.currentStream) {
      this.currentStream.end();
    }

    // Generate rotated file name with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = dirname(this.basePath);
    const base = basename(this.basePath);
    const rotatedPath = join(dir, `${base}.${timestamp}`);

    // Rename current file to rotated name
    try {
      if (existsSync(this.currentPath)) {
        const fs = require('fs');
        fs.renameSync(this.currentPath, rotatedPath);
        console.log(`File rotated: ${rotatedPath}`);
      }
    } catch (error) {
      console.error('File rotation failed:', error);
    }

    // Reset state
    this.currentSize = 0;
    this.lastRotationTime = Date.now();

    // Create new stream
    this.currentStream = createWriteStream(this.currentPath, { flags: 'a' });

    // Cleanup old files
    this.cleanup();
  }

  /**
   * Clean up old rotated files based on keepFiles config
   */
  cleanup(): void {
    if (!this.config.keepFiles) {
      return;
    }

    try {
      const dir = dirname(this.basePath);
      const base = basename(this.basePath);
      const files = readdirSync(dir);

      // Find all rotated files for this base path
      const rotatedFiles = files
        .filter(f => f.startsWith(base + '.') && f !== base)
        .map(f => ({
          name: f,
          path: join(dir, f),
          time: statSync(join(dir, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time); // Sort by time, newest first

      // Delete files beyond keepFiles limit
      if (rotatedFiles.length > this.config.keepFiles) {
        const filesToDelete = rotatedFiles.slice(this.config.keepFiles);
        for (const file of filesToDelete) {
          try {
            unlinkSync(file.path);
            console.log(`Cleaned up old rotated file: ${file.path}`);
          } catch (error) {
            console.error(`Failed to delete old rotated file ${file.path}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }

  /**
   * Close the file rotator and cleanup resources
   */
  close(): void {
    if (this.currentStream) {
      this.currentStream.end();
      this.currentStream = null;
    }
  }
}
