import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import yaml from 'js-yaml';
import type { DexConfig, ConfigProfile } from '../types.js';

/** Configuration source options. */
export interface ConfigSource {
  file?: string;
  env?: string;
  args?: Partial<DexConfig>;
  profile?: string;
}

/** ConfigLoader class for loading and merging configuration. */
export class ConfigLoader {
  /**
   * Search for config files in current directory and home directory.
   * @returns Array of found config file paths
   */
  static searchConfigFiles(): string[] {
    const configNames = ['.dexrtrc.json', '.dexrtrc.yaml', '.dexrtrc.yml'];
    const searchPaths = [
      process.cwd(),
      homedir(),
    ];

    const foundFiles: string[] = [];

    for (const dir of searchPaths) {
      for (const name of configNames) {
        const filePath = join(dir, name);
        if (existsSync(filePath)) {
          foundFiles.push(filePath);
        }
      }
    }

    return foundFiles;
  }

  /**
   * Load configuration from file.
   * @param filePath Path to config file
   * @returns Parsed configuration object
   * @throws Error if file cannot be read or parsed
   */
  static loadFromFile(filePath: string): DexConfig {
    if (!existsSync(filePath)) {
      throw new Error(`Config file not found: ${filePath}`);
    }

    const content = readFileSync(filePath, 'utf-8');
    const ext = filePath.toLowerCase();

    try {
      if (ext.endsWith('.json')) {
        return JSON.parse(content) as DexConfig;
      } else if (ext.endsWith('.yaml') || ext.endsWith('.yml')) {
        return yaml.load(content) as DexConfig;
      } else {
        throw new Error(`Unsupported config file format: ${filePath}`);
      }
    } catch (error) {
      if (error instanceof SyntaxError || (error as any).name === 'YAMLException') {
        throw new Error(`Invalid ${ext.endsWith('.json') ? 'JSON' : 'YAML'} in config file: ${filePath}`);
      }
      throw error;
    }
  }

  /**
   * Load configuration from multiple sources with profile support.
   * @param sources Configuration sources
   * @returns Merged configuration
   */
  static async load(sources: ConfigSource): Promise<DexConfig> {
    let config: DexConfig = {};

    // Load from file if specified, otherwise search for config files
    if (sources.file) {
      config = this.loadFromFile(sources.file);
    } else {
      const foundFiles = this.searchConfigFiles();
      if (foundFiles.length > 0) {
        // Use the first found file (current directory takes precedence)
        const firstFile = foundFiles[0];
        if (firstFile) {
          config = this.loadFromFile(firstFile);
        }
      }
    }

    // Load profile if specified or use default profile
    if (config.profiles) {
      const profileName = sources.profile ?? config.default;
      if (profileName !== undefined) {
        config = this.loadProfile(config, profileName);
      }
    }

    // Merge with CLI arguments if provided
    if (sources.args) {
      config = this.merge(config, sources.args);
    }

    return config;
  }

  /**
   * Load a specific profile from configuration.
   * @param config Base configuration with profiles
   * @param profileName Name of profile to load
   * @returns Configuration with profile merged
   * @throws Error if profile not found
   */
  static loadProfile(config: DexConfig, profileName: string): DexConfig {
    if (!config.profiles || !config.profiles[profileName]) {
      const availableProfiles = config.profiles ? Object.keys(config.profiles) : [];
      throw new Error(
        `Profile "${profileName}" not found. Available profiles: ${availableProfiles.join(', ') || 'none'}`
      );
    }

    const profile = config.profiles[profileName];
    
    // Merge base config with profile (profile takes precedence)
    return this.mergeProfile(config, profile);
  }

  /**
   * Merge base configuration with a profile.
   * @param base Base configuration
   * @param profile Profile to merge
   * @returns Merged configuration
   */
  static mergeProfile(base: DexConfig, profile: ConfigProfile): DexConfig {
    const merged: DexConfig = {
      // Keep profiles and default from base
      profiles: base.profiles,
      default: base.default,
      
      // Profile fields take precedence
      baseUrl: profile.baseUrl,
      apiToken: profile.apiToken ?? base.apiToken,
      pageUrls: profile.pageUrls,
      mode: profile.mode ?? base.mode,
      filters: profile.filters ?? base.filters,
      transforms: profile.transforms ?? base.transforms,
      output: profile.output ?? base.output,
      monitoring: profile.monitoring ?? base.monitoring,
    };

    return merged;
  }

  /**
   * Get list of available profiles from configuration.
   * @param config Configuration object
   * @returns Array of profile names
   */
  static listProfiles(config: DexConfig): string[] {
    return config.profiles ? Object.keys(config.profiles) : [];
  }

  /**
   * Merge base configuration with overrides.
   * @param base Base configuration
   * @param override Override configuration
   * @returns Merged configuration
   */
  static merge(base: DexConfig, override: Partial<DexConfig>): DexConfig {
    const merged: DexConfig = { ...base };

    // Merge top-level primitive fields
    if (override.default !== undefined) merged.default = override.default;
    if (override.baseUrl !== undefined) merged.baseUrl = override.baseUrl;
    if (override.apiToken !== undefined) merged.apiToken = override.apiToken;
    if (override.mode !== undefined) merged.mode = override.mode;

    // Merge arrays
    if (override.pageUrls !== undefined) merged.pageUrls = override.pageUrls;
    if (override.filters !== undefined) merged.filters = override.filters;

    // Merge nested objects
    if (override.transforms !== undefined) {
      merged.transforms = { ...base.transforms, ...override.transforms };
    }
    if (override.output !== undefined) {
      merged.output = { ...base.output, ...override.output };
    }
    if (override.monitoring !== undefined) {
      merged.monitoring = { ...base.monitoring, ...override.monitoring };
    }
    if (override.profiles !== undefined) {
      merged.profiles = { ...base.profiles, ...override.profiles };
    }

    return merged;
  }
}
