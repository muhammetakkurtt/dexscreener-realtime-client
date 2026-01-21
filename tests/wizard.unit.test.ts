import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InteractiveWizard } from '../src/cli/wizard.js';
import inquirer from 'inquirer';

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

describe('InteractiveWizard', () => {
  beforeEach(() => {
    // Mock console.log to avoid output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('run', () => {
    it('should complete wizard with valid inputs and save to file', async () => {
      // Mock inquirer responses
      const mockPrompt = vi.mocked(inquirer.prompt);
      mockPrompt
        .mockResolvedValueOnce({ baseUrl: 'https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor' })
        .mockResolvedValueOnce({ apiToken: 'apify_api_test123' })
        .mockResolvedValueOnce({ pageUrl: 'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc' })
        .mockResolvedValueOnce({ addAnother: false })
        .mockResolvedValueOnce({ mode: 'stdout' })
        .mockResolvedValueOnce({ save: true })
        .mockResolvedValueOnce({ format: 'json' })
        .mockResolvedValueOnce({ filePath: '.dexrtrc.json' });

      const result = await InteractiveWizard.run();

      expect(result).toBeDefined();
      expect(result.config).toBeDefined();
      expect(result.config.baseUrl).toBe('https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor');
      expect(result.config.apiToken).toBe('apify_api_test123');
      expect(result.config.pageUrls).toEqual(['https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc']);
      expect(result.config.mode).toBe('stdout');
      expect(result.saveToFile).toBe(true);
      expect(result.filePath).toBe('.dexrtrc.json');
    });

    it('should complete wizard with multiple page URLs', async () => {
      const mockPrompt = vi.mocked(inquirer.prompt);
      mockPrompt
        .mockResolvedValueOnce({ baseUrl: 'https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor' })
        .mockResolvedValueOnce({ apiToken: 'apify_api_test456' })
        .mockResolvedValueOnce({ pageUrl: 'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc' })
        .mockResolvedValueOnce({ addAnother: true })
        .mockResolvedValueOnce({ pageUrl: 'https://dexscreener.com/base?rankBy=trendingScoreH6&order=desc' })
        .mockResolvedValueOnce({ addAnother: false })
        .mockResolvedValueOnce({ mode: 'jsonl' })
        .mockResolvedValueOnce({ save: false });

      const result = await InteractiveWizard.run();

      expect(result.config.baseUrl).toBe('https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor');
      expect(result.config.pageUrls).toEqual([
        'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc',
        'https://dexscreener.com/base?rankBy=trendingScoreH6&order=desc',
      ]);
      expect(result.config.mode).toBe('jsonl');
      expect(result.saveToFile).toBe(false);
      expect(result.filePath).toBeUndefined();
    });

    it('should complete wizard with webhook mode', async () => {
      const mockPrompt = vi.mocked(inquirer.prompt);
      mockPrompt
        .mockResolvedValueOnce({ baseUrl: 'https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor' })
        .mockResolvedValueOnce({ apiToken: 'apify_api_webhook' })
        .mockResolvedValueOnce({ pageUrl: 'https://dexscreener.com/ethereum?rankBy=volume&order=desc' })
        .mockResolvedValueOnce({ addAnother: false })
        .mockResolvedValueOnce({ mode: 'webhook' })
        .mockResolvedValueOnce({ save: true })
        .mockResolvedValueOnce({ format: 'yaml' })
        .mockResolvedValueOnce({ filePath: '.dexrtrc.yaml' });

      const result = await InteractiveWizard.run();

      expect(result.config.baseUrl).toBe('https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor');
      expect(result.config.mode).toBe('webhook');
      expect(result.saveToFile).toBe(true);
      expect(result.filePath).toBe('.dexrtrc.yaml');
    });
  });

  describe('validation', () => {
    it('should validate base URL format', async () => {
      const mockPrompt = vi.mocked(inquirer.prompt);
      
      // Get the validation function from the prompt call
      mockPrompt.mockImplementation((async (questions: any) => {
        const question = Array.isArray(questions) ? questions[0] : questions;
        if (question.name === 'baseUrl' && question.validate) {
          // Test invalid URLs
          expect(question.validate('http://example.com')).toBe(
            'Invalid URL. Must be a valid HTTPS URL (e.g., https://your-actor.apify.actor)'
          );
          expect(question.validate('')).toBe('Base URL is required');
          expect(question.validate('not-a-url')).toBe(
            'Invalid URL. Must be a valid HTTPS URL (e.g., https://your-actor.apify.actor)'
          );
          
          // Test valid URL
          expect(question.validate('https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor')).toBe(true);
        }
        return { baseUrl: 'https://muhammetakkurtt--dexscreener-realtime-monitor.apify.actor' };
      }) as any);

      await InteractiveWizard['promptBaseUrl']();
      expect(mockPrompt).toHaveBeenCalled();
    });

    it('should validate API token format', async () => {
      const mockPrompt = vi.mocked(inquirer.prompt);
      
      mockPrompt.mockImplementation((async (questions: any) => {
        const question = Array.isArray(questions) ? questions[0] : questions;
        if (question.name === 'apiToken' && question.validate) {
          // Test invalid tokens
          expect(question.validate('invalid_token')).toBe(
            'Invalid token format. Token must start with "apify_api_"'
          );
          expect(question.validate('')).toBe('API token is required');
          
          // Test valid token
          expect(question.validate('apify_api_test123')).toBe(true);
        }
        return { apiToken: 'apify_api_test123' };
      }) as any);

      await InteractiveWizard['promptApiToken']();
      expect(mockPrompt).toHaveBeenCalled();
    });

    it('should validate page URL format', async () => {
      const mockPrompt = vi.mocked(inquirer.prompt);
      
      mockPrompt.mockImplementation((async (questions: any) => {
        const question = Array.isArray(questions) ? questions[0] : questions;
        if (question.name === 'pageUrl' && question.validate) {
          // Test invalid URLs
          expect(question.validate('http://example.com')).toBe(
            'Invalid URL. Must be a valid HTTPS URL (e.g., https://dexscreener.com/solana)'
          );
          expect(question.validate('')).toBe('Page URL is required');
          
          // Test valid URL
          expect(question.validate('https://dexscreener.com/solana')).toBe(true);
        }
        return { pageUrl: 'https://dexscreener.com/solana' };
      }) as any);

      // Mock the second prompt for addAnother
      mockPrompt.mockResolvedValueOnce({ addAnother: false });

      await InteractiveWizard['promptPageUrls']();
      expect(mockPrompt).toHaveBeenCalled();
    });
  });

  describe('output mode selection', () => {
    it('should provide stdout, jsonl, and webhook choices', async () => {
      const mockPrompt = vi.mocked(inquirer.prompt);
      
      mockPrompt.mockImplementation((async (questions: any) => {
        const question = Array.isArray(questions) ? questions[0] : questions;
        if (question.name === 'mode') {
          expect(question.type).toBe('list');
          expect(question.choices).toBeDefined();
          expect(question.choices.length).toBe(3);
          
          const values = question.choices.map((c: any) => c.value);
          expect(values).toContain('stdout');
          expect(values).toContain('jsonl');
          expect(values).toContain('webhook');
        }
        return { mode: 'stdout' };
      }) as any);

      await InteractiveWizard['promptOutputMode']();
      expect(mockPrompt).toHaveBeenCalled();
    });
  });

  describe('save configuration', () => {
    it('should offer to save configuration', async () => {
      const mockPrompt = vi.mocked(inquirer.prompt);
      
      mockPrompt
        .mockResolvedValueOnce({ save: true })
        .mockResolvedValueOnce({ format: 'json' })
        .mockResolvedValueOnce({ filePath: '.dexrtrc.json' });

      const result = await InteractiveWizard['promptSaveConfig']();
      
      expect(result.saveToFile).toBe(true);
      expect(result.filePath).toBe('.dexrtrc.json');
    });

    it('should handle declining to save', async () => {
      const mockPrompt = vi.mocked(inquirer.prompt);
      mockPrompt.mockResolvedValueOnce({ save: false });

      const result = await InteractiveWizard['promptSaveConfig']();
      
      expect(result.saveToFile).toBe(false);
      expect(result.filePath).toBeUndefined();
    });

    it('should offer JSON and YAML format choices', async () => {
      const mockPrompt = vi.mocked(inquirer.prompt);
      
      mockPrompt
        .mockResolvedValueOnce({ save: true })
        .mockResolvedValueOnce({ format: 'yaml' })
        .mockResolvedValueOnce({ filePath: '.dexrtrc.yaml' });

      const result = await InteractiveWizard['promptSaveConfig']();
      
      expect(result.filePath).toBe('.dexrtrc.yaml');
      expect(result.saveToFile).toBe(true);
    });
  });
});
