import { gzip, gzipSync } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);

export interface CompressionConfig {
  enabled: boolean;
  level?: number; // 1-9, default 6
}

export class Compressor {
  /**
   * Compress data asynchronously using gzip
   * @param data - String or Buffer to compress
   * @param level - Compression level (1-9, default 6)
   * @returns Compressed Buffer
   */
  static async compress(data: string | Buffer, level: number = 6): Promise<Buffer> {
    try {
      const input = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
      return await gzipAsync(input, { level });
    } catch (error) {
      // Fallback to uncompressed on error
      console.error('Compression failed, falling back to uncompressed:', error);
      return typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
    }
  }

  /**
   * Compress data synchronously using gzip
   * @param data - String or Buffer to compress
   * @param level - Compression level (1-9, default 6)
   * @returns Compressed Buffer
   */
  static compressSync(data: string | Buffer, level: number = 6): Buffer {
    try {
      const input = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
      return gzipSync(input, { level });
    } catch (error) {
      // Fallback to uncompressed on error
      console.error('Compression failed, falling back to uncompressed:', error);
      return typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
    }
  }
}
