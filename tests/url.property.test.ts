import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { sanitizeBaseUrl, buildSseUrl, validateUrls } from '../src/utils/url';

describe('URL Construction Format', () => {
  it('should construct URLs in the correct format for any valid baseUrl and pageUrl', () => {
    const validBaseUrl = fc.webUrl().map(url => url.replace(/\/+$/, ''));
    const validPageUrl = fc.webUrl();

    fc.assert(
      fc.property(validBaseUrl, validPageUrl, (baseUrl, pageUrl) => {
        const result = buildSseUrl(baseUrl, pageUrl);
        const sanitizedBase = sanitizeBaseUrl(baseUrl);
        const encodedPageUrl = encodeURIComponent(pageUrl);
        
        const expectedUrl = `${sanitizedBase}/events/dex/pairs?page_url=${encodedPageUrl}`;
        expect(result).toBe(expectedUrl);
        expect(result).toContain('/events/dex/pairs?page_url=');
        expect(sanitizedBase).not.toMatch(/\/+$/);
      }),
      { numRuns: 100 }
    );
  });
});

describe('Trailing Slash Sanitization', () => {
  it('should remove all trailing slashes from any baseUrl', () => {
    const baseString = fc.string({ minLength: 1 }).filter(s => s.trim().length > 0 && !s.endsWith('/'));
    const trailingSlashCount = fc.integer({ min: 0, max: 10 });

    fc.assert(
      fc.property(baseString, trailingSlashCount, (base, slashCount) => {
        const urlWithSlashes = base + '/'.repeat(slashCount);
        const result = sanitizeBaseUrl(urlWithSlashes);
        
        expect(result).not.toMatch(/\/+$/);
        expect(result).toBe(base);
      }),
      { numRuns: 100 }
    );
  });

  it('should be idempotent - sanitizing twice yields same result', () => {
    const anyString = fc.string({ minLength: 1 }).filter(s => s.trim().length > 0);

    fc.assert(
      fc.property(anyString, (url) => {
        const once = sanitizeBaseUrl(url);
        const twice = sanitizeBaseUrl(once);
        expect(twice).toBe(once);
      }),
      { numRuns: 100 }
    );
  });
});

describe('URL Encoding Round-Trip', () => {
  it('should preserve pageUrl through encode/decode round-trip', () => {
    const pageUrlArb = fc.string({ minLength: 1 }).filter(s => s.trim().length > 0);

    fc.assert(
      fc.property(pageUrlArb, (pageUrl) => {
        const sseUrl = buildSseUrl('https://example.com', pageUrl);
        const encodedPart = sseUrl.split('page_url=')[1];
        const decoded = decodeURIComponent(encodedPart);
        expect(decoded).toBe(pageUrl);
      }),
      { numRuns: 100 }
    );
  });

  it('should handle DexScreener-style query parameters with brackets', () => {
    const dexScreenerUrl = fc.record({
      chain: fc.constantFrom('solana', 'ethereum', 'bsc', 'base', 'arbitrum'),
      page: fc.constantFrom('trending', 'latest', 'gainers', 'losers'),
      rankByKey: fc.constantFrom('volumeH1', 'volumeH24', 'priceChangeH1', 'liquidity'),
      rankByOrder: fc.constantFrom('asc', 'desc'),
      minLiq: fc.integer({ min: 1000, max: 1000000 })
    }).map(({ chain, page, rankByKey, rankByOrder, minLiq }) => 
      `https://dexscreener.com/${chain}/${page}?rankBy[key]=${rankByKey}&rankBy[order]=${rankByOrder}&minLiq=${minLiq}`
    );

    fc.assert(
      fc.property(dexScreenerUrl, (pageUrl) => {
        const sseUrl = buildSseUrl('https://example.com', pageUrl);
        const encodedPart = sseUrl.split('page_url=')[1];
        const decoded = decodeURIComponent(encodedPart);
        
        expect(decoded).toBe(pageUrl);
        expect(decoded).toContain('[');
        expect(decoded).toContain(']');
        expect(decoded).toContain('&');
        expect(decoded).toContain('=');
      }),
      { numRuns: 100 }
    );
  });
});

describe('Empty URL Validation', () => {
  it('should throw error for empty or whitespace-only baseUrl', () => {
    const emptyOrWhitespace = fc.oneof(
      fc.constant(''),
      fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 10 }).map(arr => arr.join(''))
    );
    const validPageUrl = fc.string({ minLength: 1 }).filter(s => s.trim().length > 0);

    fc.assert(
      fc.property(emptyOrWhitespace, validPageUrl, (baseUrl, pageUrl) => {
        expect(() => validateUrls(baseUrl, pageUrl)).toThrow('baseUrl is required and cannot be empty');
      }),
      { numRuns: 100 }
    );
  });

  it('should throw error for empty or whitespace-only pageUrl', () => {
    const validBaseUrl = fc.string({ minLength: 1 }).filter(s => s.trim().length > 0);
    const emptyOrWhitespace = fc.oneof(
      fc.constant(''),
      fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 10 }).map(arr => arr.join(''))
    );

    fc.assert(
      fc.property(validBaseUrl, emptyOrWhitespace, (baseUrl, pageUrl) => {
        expect(() => validateUrls(baseUrl, pageUrl)).toThrow('pageUrl is required and cannot be empty');
      }),
      { numRuns: 100 }
    );
  });

  it('should not throw for valid non-empty URLs', () => {
    const validUrl = fc.string({ minLength: 1 }).filter(s => s.trim().length > 0);

    fc.assert(
      fc.property(validUrl, validUrl, (baseUrl, pageUrl) => {
        expect(() => validateUrls(baseUrl, pageUrl)).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });
});
