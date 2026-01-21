import type { DexConfig, ConfigProfile } from '../types.js';

/** Generator options. */
export interface GeneratorOptions {
  format: 'json' | 'yaml';
  includeExamples: boolean;
  includeProfiles: boolean;
}

/** ConfigGenerator class for generating configuration files. */
export class ConfigGenerator {
  /**
   * Generate a configuration file with examples and comments.
   * @param options Generator options
   * @returns Configuration file content as string
   */
  static generate(options: GeneratorOptions): string {
    const config = this.createExampleConfig(options.includeProfiles);

    if (options.format === 'json') {
      return JSON.stringify(config, null, 2);
    } else {
      // For YAML, we'll add comments manually
      return this.generateYamlWithComments(config, options.includeExamples);
    }
  }

  /**
   * Generate a profile configuration.
   * @param name Profile name
   * @param template Template type (dev or prod)
   * @returns Profile configuration
   */
  static generateProfile(name: string, template: 'dev' | 'prod'): ConfigProfile {
    if (template === 'dev') {
      return {
        name,
        baseUrl: 'https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor',
        apiToken: 'apify_api_your_token_here',
        pageUrls: ['https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc'],
        mode: 'stdout',
        monitoring: {
          logLevel: 'debug',
          logFormat: 'text',
        },
      };
    } else {
      return {
        name,
        baseUrl: 'https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor',
        apiToken: 'apify_api_your_token_here',
        pageUrls: [
          'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc',
          'https://dexscreener.com/base?rankBy=trendingScoreH6&order=desc&minLiq=30000',
        ],
        mode: 'jsonl',
        output: {
          compression: { enabled: true },
          rotation: { maxSizeMB: 100, interval: 'daily' },
        },
        monitoring: {
          healthPort: 3000,
          metricsPort: 9090,
          logLevel: 'info',
          logFormat: 'json',
          performance: true,
        },
      };
    }
  }

  /**
   * Create an example configuration object.
   * @param includeProfiles Whether to include profile examples
   * @returns Example configuration
   */
  private static createExampleConfig(includeProfiles: boolean): DexConfig {
    // Minimal, clean config - only essentials
    const config: DexConfig = {
      baseUrl: 'https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor',
      apiToken: 'apify_api_your_token_here',
      pageUrls: ['https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc'],
      mode: 'stdout',
    };

    if (includeProfiles) {
      config.profiles = {
        dev: this.generateProfile('dev', 'dev'),
        prod: this.generateProfile('prod', 'prod'),
      };
      config.default = 'dev';
    }

    return config;
  }

  /**
   * Generate YAML with comments.
   * @param config Configuration object
   * @param includeExamples Whether to include example comments
   * @returns YAML string with comments
   */
  private static generateYamlWithComments(config: DexConfig, includeExamples: boolean): string {
    const lines: string[] = [];

    if (includeExamples) {
      lines.push('# DexScreener Realtime Client Configuration');
      lines.push('# Edit this file to customize your settings');
      lines.push('');
    }

    if (config.profiles) {
      lines.push('# Configuration profiles for different environments');
      lines.push('profiles:');
      for (const [name, profile] of Object.entries(config.profiles)) {
        lines.push(`  ${name}:`);
        lines.push(`    name: ${name}`);
        lines.push(`    baseUrl: ${profile.baseUrl}`);
        if (profile.apiToken) {
          lines.push(`    apiToken: ${profile.apiToken}`);
        }
        lines.push(`    pageUrls:`);
        profile.pageUrls.forEach(url => {
          lines.push(`      - ${url}`);
        });
        if (profile.mode) {
          lines.push(`    mode: ${profile.mode}`);
        }
        if (profile.monitoring) {
          lines.push(`    monitoring:`);
          if (profile.monitoring.logLevel) {
            lines.push(`      logLevel: ${profile.monitoring.logLevel}`);
          }
          if (profile.monitoring.logFormat) {
            lines.push(`      logFormat: ${profile.monitoring.logFormat}`);
          }
          if (profile.monitoring.healthPort) {
            lines.push(`      healthPort: ${profile.monitoring.healthPort}`);
          }
          if (profile.monitoring.metricsPort) {
            lines.push(`      metricsPort: ${profile.monitoring.metricsPort}`);
          }
          if (profile.monitoring.performance !== undefined) {
            lines.push(`      performance: ${profile.monitoring.performance}`);
          }
        }
        if (profile.output) {
          lines.push(`    output:`);
          if (profile.output.compression) {
            lines.push(`      compression:`);
            lines.push(`        enabled: ${profile.output.compression.enabled}`);
          }
          if (profile.output.rotation) {
            lines.push(`      rotation:`);
            if (profile.output.rotation.maxSizeMB) {
              lines.push(`        maxSizeMB: ${profile.output.rotation.maxSizeMB}`);
            }
            if (profile.output.rotation.interval) {
              lines.push(`        interval: ${profile.output.rotation.interval}`);
            }
          }
        }
      }
      lines.push('');
      if (config.default) {
        lines.push(`# Default profile to use when none is specified`);
        lines.push(`default: ${config.default}`);
        lines.push('');
      }
    }

    // Required fields
    if (includeExamples) {
      lines.push('# Required: Apify Standby Actor base URL');
    }
    lines.push(`baseUrl: ${config.baseUrl}`);
    lines.push('');

    if (includeExamples) {
      lines.push('# Required: API token (or set APIFY_TOKEN environment variable)');
    }
    if (config.apiToken) {
      lines.push(`apiToken: ${config.apiToken}`);
      lines.push('');
    }

    if (includeExamples) {
      lines.push('# Required: DexScreener page URLs to monitor');
    }
    lines.push('pageUrls:');
    config.pageUrls?.forEach(url => {
      lines.push(`  - ${url}`);
    });
    lines.push('');

    if (includeExamples) {
      lines.push('# Output mode: stdout (console), jsonl (file), or webhook (HTTP POST)');
    }
    if (config.mode) {
      lines.push(`mode: ${config.mode}`);
      lines.push('');
    }

    // Add commented examples for advanced features
    if (includeExamples) {
      lines.push('# Optional: Filter trading pairs by criteria');
      lines.push('# filters:');
      lines.push('#   - type: chain');
      lines.push('#     params:');
      lines.push('#       chains: [solana, ethereum]  # Only these chains');
      lines.push('#   - type: liquidity');
      lines.push('#     params:');
      lines.push('#       minUsd: 50000  # Minimum liquidity in USD');
      lines.push('#   - type: volume');
      lines.push('#     params:');
      lines.push('#       period: h24  # m5, h1, h6, h24');
      lines.push('#       minUsd: 100000  # Minimum 24h volume');
      lines.push('');

      lines.push('# Optional: Transform output data');
      lines.push('# transforms:');
      lines.push('#   fields:  # Select only these fields');
      lines.push('#     - chainId');
      lines.push('#     - baseToken.symbol');
      lines.push('#     - priceUsd');
      lines.push('#   aliases:  # Rename fields');
      lines.push('#     priceUsd: price');
      lines.push('');

      lines.push('# Optional: Output management');
      lines.push('# output:');
      lines.push('#   compression:');
      lines.push('#     enabled: true  # Gzip compression for JSONL/webhook');
      lines.push('#   rotation:  # For JSONL mode');
      lines.push('#     maxSizeMB: 100  # Rotate when file exceeds size');
      lines.push('#     interval: daily  # Or: hourly, daily');
      lines.push('#   batching:  # For webhook mode');
      lines.push('#     maxSize: 100  # Events per batch');
      lines.push('#     maxWaitMs: 5000  # Max wait time');
      lines.push('#   sampling:');
      lines.push('#     rate: 50  # Process only 50% of events');
      lines.push('#   throttling:');
      lines.push('#     maxPerSecond: 10  # Rate limit');
      lines.push('#     dropStrategy: oldest  # oldest, newest, random');
      lines.push('');

      lines.push('# Optional: Monitoring and observability');
      lines.push('# monitoring:');
      lines.push('#   healthPort: 3000  # HTTP health check endpoint');
      lines.push('#   metricsPort: 9090  # Prometheus metrics endpoint');
      lines.push('#   logLevel: info  # error, warn, info, debug');
      lines.push('#   logFormat: text  # text or json');
      lines.push('#   performance: true  # Track performance metrics');
      lines.push('#   alerts:  # Alert thresholds');
      lines.push('#     - metric: events_per_second');
      lines.push('#       threshold: 1');
      lines.push('#       comparison: lt  # lt (less than), gt, eq');
    }

    return lines.join('\n');
  }
}
