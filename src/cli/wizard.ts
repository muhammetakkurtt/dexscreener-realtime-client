import inquirer from 'inquirer';
import type { DexConfig, CliMode } from '../types.js';
import { ConfigValidator } from '../config/validator.js';

/** Result from running the interactive wizard. */
export interface WizardResult {
  config: DexConfig;
  saveToFile: boolean;
  filePath?: string;
}

/**
 * InteractiveWizard class for step-by-step CLI configuration.
 * Provides an interactive prompt-based interface for configuring the CLI.
 */
export class InteractiveWizard {
  /**
   * Run the interactive configuration wizard.
   * @returns Promise resolving to wizard result with configuration
   */
  static async run(): Promise<WizardResult> {
    console.log('\n🧙 Welcome to DexScreener Realtime Client Configuration Wizard\n');

    const baseUrl = await this.promptBaseUrl();
    const apiToken = await this.promptApiToken();
    const pageUrls = await this.promptPageUrls();
    const mode = await this.promptOutputMode();
    const { saveToFile, filePath } = await this.promptSaveConfig();

    const config: DexConfig = {
      baseUrl,
      apiToken,
      pageUrls,
      mode,
    };

    console.log('\n✅ Configuration complete!\n');

    return {
      config,
      saveToFile,
      filePath,
    };
  }

  /**
   * Prompt for base URL with validation.
   * @returns Promise resolving to validated base URL
   */
  private static async promptBaseUrl(): Promise<string> {
    const answer = await inquirer.prompt<{ baseUrl: string }>([
      {
        type: 'input',
        name: 'baseUrl',
        message: 'Enter the Apify Standby Actor base URL:',
        default: 'https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor',
        validate: (input: string) => {
          if (!input || input.trim() === '') {
            return 'Base URL is required';
          }
          if (!ConfigValidator.validateUrl(input)) {
            return 'Invalid URL. Must be a valid HTTPS URL (e.g., https://your-actor.apify.actor)';
          }
          return true;
        },
      },
    ]);

    return answer.baseUrl;
  }

  /**
   * Prompt for API token with masked input and format validation.
   * @returns Promise resolving to validated API token
   */
  private static async promptApiToken(): Promise<string> {
    const answer = await inquirer.prompt<{ apiToken: string }>([
      {
        type: 'password',
        name: 'apiToken',
        message: 'Enter your Apify API token:',
        mask: '*',
        validate: (input: string) => {
          if (!input || input.trim() === '') {
            return 'API token is required';
          }
          if (!ConfigValidator.validateToken(input)) {
            return 'Invalid token format. Token must start with "apify_api_"';
          }
          return true;
        },
      },
    ]);

    return answer.apiToken;
  }

  /**
   * Prompt for page URLs allowing multiple URLs.
   * @returns Promise resolving to array of validated page URLs
   */
  private static async promptPageUrls(): Promise<string[]> {
    const urls: string[] = [];
    let addMore = true;

    while (addMore) {
      const answer = await inquirer.prompt<{ pageUrl: string }>([
        {
          type: 'input',
          name: 'pageUrl',
          message: `Enter DexScreener page URL ${urls.length + 1}:`,
          default: urls.length === 0 ? 'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc' : undefined,
          validate: (input: string) => {
            if (!input || input.trim() === '') {
              return 'Page URL is required';
            }
            if (!ConfigValidator.validateUrl(input)) {
              return 'Invalid URL. Must be a valid HTTPS URL (e.g., https://dexscreener.com/solana)';
            }
            return true;
          },
        },
      ]);

      urls.push(answer.pageUrl);

      const continueAnswer = await inquirer.prompt<{ addAnother: boolean }>([
        {
          type: 'confirm',
          name: 'addAnother',
          message: 'Add another page URL?',
          default: false,
        },
      ]);

      addMore = continueAnswer.addAnother;
    }

    return urls;
  }

  /**
   * Prompt for output mode with choices.
   * @returns Promise resolving to selected output mode
   */
  private static async promptOutputMode(): Promise<CliMode> {
    const answer = await inquirer.prompt<{ mode: CliMode }>([
      {
        type: 'list',
        name: 'mode',
        message: 'Select output mode:',
        choices: [
          {
            name: 'stdout - Print events to standard output (console)',
            value: 'stdout' as CliMode,
          },
          {
            name: 'jsonl - Write events to JSONL file',
            value: 'jsonl' as CliMode,
          },
          {
            name: 'webhook - Send events to HTTP webhook endpoint',
            value: 'webhook' as CliMode,
          },
        ],
        default: 'stdout',
      },
    ]);

    return answer.mode;
  }

  /**
   * Prompt to offer saving configuration to file.
   * @returns Promise resolving to save decision and optional file path
   */
  private static async promptSaveConfig(): Promise<{
    saveToFile: boolean;
    filePath?: string;
  }> {
    const saveAnswer = await inquirer.prompt<{ save: boolean }>([
      {
        type: 'confirm',
        name: 'save',
        message: 'Save this configuration to a file?',
        default: true,
      },
    ]);

    if (!saveAnswer.save) {
      return { saveToFile: false };
    }

    const formatAnswer = await inquirer.prompt<{ format: 'json' | 'yaml' }>([
      {
        type: 'list',
        name: 'format',
        message: 'Select configuration file format:',
        choices: [
          { name: 'JSON (.dexrtrc.json)', value: 'json' },
          { name: 'YAML (.dexrtrc.yaml)', value: 'yaml' },
        ],
        default: 'json',
      },
    ]);

    const defaultPath =
      formatAnswer.format === 'json' ? '.dexrtrc.json' : '.dexrtrc.yaml';

    const pathAnswer = await inquirer.prompt<{ filePath: string }>([
      {
        type: 'input',
        name: 'filePath',
        message: 'Enter file path:',
        default: defaultPath,
        validate: (input: string) => {
          if (!input || input.trim() === '') {
            return 'File path is required';
          }
          return true;
        },
      },
    ]);

    return {
      saveToFile: true,
      filePath: pathAnswer.filePath,
    };
  }
}
