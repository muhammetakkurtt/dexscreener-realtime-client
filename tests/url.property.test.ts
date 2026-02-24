import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  sanitizeBaseUrl,
  normalizeProtocol,
  buildWsUrl,
  buildHealthUrl,
  validateUrls,
} from '../src/utils/url';

// Custom arbitraries for URL generation
const httpProtocol = fc.constantFrom('http://', 'https://');
const wsProtocol = fc.constantFrom('ws://', 'wss://');
const anyProtocol = fc.constantFrom('http://', 'https://', 'ws://', 'wss://');
const domain = fc.domain();
const path = fc.array(fc.stringMatching(/^[a-z0-9-]+$/), { minLength: 0, maxLength: 3 })
  .map(parts => parts.length > 0 ? '/' + parts.join('/') : '');

const httpUrl = fc.tuple(httpProtocol, domain, path)
  .map(([protocol, dom, p]) => `${protocol}${dom}${p}`);

const wsUrl = fc.tuple(wsProtocol, domain, path)
  .map(([protocol, dom, p]) => `${protocol}${dom}${p}`);

const anyUrl = fc.tuple(anyProtocol, domain, path)
  .map(([protocol, dom, p]) => `${protocol}${dom}${p}`);

const authMode = fc.constantFrom('auto', 'header', 'query', 'both') as fc.Arbitrary<'auto' | 'header' | 'query' | 'both'>;
const token = fc.string({ minLength: 10, maxLength: 50 });
const pageUrl = fc.webUrl();

describe('sanitizeBaseUrl', () => {
  it('should remove all trailing slashes from any URL', () => {
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

  it('should preserve URLs without trailing slashes', () => {
    fc.assert(
      fc.property(anyUrl, (url) => {
        const result = sanitizeBaseUrl(url);
        expect(result).toBe(url);
      }),
      { numRuns: 100 }
    );
  });
});

describe('normalizeProtocol', () => {
  it('should convert http:// to ws://', () => {
    fc.assert(
      fc.property(httpUrl.filter(u => u.startsWith('http://')), (url) => {
        const result = normalizeProtocol(url);
        expect(result).toMatch(/^ws:\/\//);
        expect(result).toBe(url.replace('http://', 'ws://'));
      }),
      { numRuns: 100 }
    );
  });

  it('should convert https:// to wss://', () => {
    fc.assert(
      fc.property(httpUrl.filter(u => u.startsWith('https://')), (url) => {
        const result = normalizeProtocol(url);
        expect(result).toMatch(/^wss:\/\//);
        expect(result).toBe(url.replace('https://', 'wss://'));
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve ws:// protocol unchanged', () => {
    fc.assert(
      fc.property(wsUrl.filter(u => u.startsWith('ws://')), (url) => {
        const result = normalizeProtocol(url);
        expect(result).toBe(url);
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve wss:// protocol unchanged', () => {
    fc.assert(
      fc.property(wsUrl.filter(u => u.startsWith('wss://')), (url) => {
        const result = normalizeProtocol(url);
        expect(result).toBe(url);
      }),
      { numRuns: 100 }
    );
  });

  it('should be idempotent - normalizing twice yields same result', () => {
    fc.assert(
      fc.property(anyUrl, (url) => {
        const once = normalizeProtocol(url);
        const twice = normalizeProtocol(once);
        expect(twice).toBe(once);
        expect(once).toMatch(/^(ws|wss):\/\//);
      }),
      { numRuns: 100 }
    );
  });
});

describe('buildWsUrl', () => {
  it('should always return a URL starting with ws:// or wss://', () => {
    fc.assert(
      fc.property(anyUrl, pageUrl, (base, page) => {
        const result = buildWsUrl(base, page);
        expect(result).toMatch(/^(ws|wss):\/\//);
      }),
      { numRuns: 100 }
    );
  });

  it('should always include page_url query parameter', () => {
    fc.assert(
      fc.property(anyUrl, pageUrl, (base, page) => {
        const result = buildWsUrl(base, page);
        const url = new URL(result);
        expect(url.searchParams.has('page_url')).toBe(true);
        expect(url.searchParams.get('page_url')).toBe(page);
      }),
      { numRuns: 100 }
    );
  });

  it('should include token in query when authMode is "query"', () => {
    fc.assert(
      fc.property(anyUrl, pageUrl, token, (base, page, tok) => {
        const result = buildWsUrl(base, page, tok, 'query');
        const url = new URL(result);
        expect(url.searchParams.has('token')).toBe(true);
        expect(url.searchParams.get('token')).toBe(tok);
      }),
      { numRuns: 100 }
    );
  });

  it('should include token in query when authMode is "both"', () => {
    fc.assert(
      fc.property(anyUrl, pageUrl, token, (base, page, tok) => {
        const result = buildWsUrl(base, page, tok, 'both');
        const url = new URL(result);
        expect(url.searchParams.has('token')).toBe(true);
        expect(url.searchParams.get('token')).toBe(tok);
      }),
      { numRuns: 100 }
    );
  });

  it('should NOT include token in query when authMode is "auto"', () => {
    fc.assert(
      fc.property(anyUrl, pageUrl, token, (base, page, tok) => {
        const result = buildWsUrl(base, page, tok, 'auto');
        const url = new URL(result);
        expect(url.searchParams.has('token')).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('should NOT include token in query when authMode is "header"', () => {
    fc.assert(
      fc.property(anyUrl, pageUrl, token, (base, page, tok) => {
        const result = buildWsUrl(base, page, tok, 'header');
        const url = new URL(result);
        expect(url.searchParams.has('token')).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('should NOT include token when token is undefined', () => {
    fc.assert(
      fc.property(anyUrl, pageUrl, authMode, (base, page, mode) => {
        const result = buildWsUrl(base, page, undefined, mode);
        const url = new URL(result);
        expect(url.searchParams.has('token')).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('should always end path with /events/dex/pairs', () => {
    fc.assert(
      fc.property(anyUrl, pageUrl, (base, page) => {
        const result = buildWsUrl(base, page);
        const url = new URL(result);
        expect(url.pathname).toMatch(/\/events\/dex\/pairs$/);
      }),
      { numRuns: 100 }
    );
  });

  it('should be idempotent when called on URLs without existing paths', () => {
    // Test idempotency on clean URLs (protocol + host only)
    const cleanUrl = fc.tuple(anyProtocol, domain)
      .map(([protocol, dom]) => `${protocol}${dom}`);
    
    fc.assert(
      fc.property(cleanUrl, pageUrl, token, authMode, (base, page, tok, mode) => {
        const first = buildWsUrl(base, page, tok, mode);
        const url = new URL(first);
        const baseFromFirst = `${url.protocol}//${url.host}`;
        const second = buildWsUrl(baseFromFirst, page, tok, mode);
        expect(second).toBe(first);
      }),
      { numRuns: 100 }
    );
  });

  it('should handle URLs with trailing slashes correctly', () => {
    fc.assert(
      fc.property(anyUrl, fc.integer({ min: 1, max: 5 }), pageUrl, (base, slashes, page) => {
        const baseWithSlashes = base + '/'.repeat(slashes);
        const result = buildWsUrl(baseWithSlashes, page);
        const url = new URL(result);
        expect(url.pathname).toMatch(/\/events\/dex\/pairs$/);
      }),
      { numRuns: 100 }
    );
  });

  it('should convert http protocols to ws protocols', () => {
    fc.assert(
      fc.property(httpUrl, pageUrl, (base, page) => {
        const result = buildWsUrl(base, page);
        if (base.startsWith('http://')) {
          expect(result).toMatch(/^ws:\/\//);
        } else if (base.startsWith('https://')) {
          expect(result).toMatch(/^wss:\/\//);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve ws protocols unchanged', () => {
    fc.assert(
      fc.property(wsUrl, pageUrl, (base, page) => {
        const result = buildWsUrl(base, page);
        if (base.startsWith('ws://')) {
          expect(result).toMatch(/^ws:\/\//);
        } else if (base.startsWith('wss://')) {
          expect(result).toMatch(/^wss:\/\//);
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe('buildHealthUrl', () => {
  it('should convert ws:// to http://', () => {
    fc.assert(
      fc.property(wsUrl.filter(u => u.startsWith('ws://')), (url) => {
        const result = buildHealthUrl(url);
        expect(result).toMatch(/^http:\/\//);
      }),
      { numRuns: 100 }
    );
  });

  it('should convert wss:// to https://', () => {
    fc.assert(
      fc.property(wsUrl.filter(u => u.startsWith('wss://')), (url) => {
        const result = buildHealthUrl(url);
        expect(result).toMatch(/^https:\/\//);
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve http:// protocol unchanged', () => {
    fc.assert(
      fc.property(httpUrl.filter(u => u.startsWith('http://')), (url) => {
        const result = buildHealthUrl(url);
        expect(result).toMatch(/^http:\/\//);
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve https:// protocol unchanged', () => {
    fc.assert(
      fc.property(httpUrl.filter(u => u.startsWith('https://')), (url) => {
        const result = buildHealthUrl(url);
        expect(result).toMatch(/^https:\/\//);
      }),
      { numRuns: 100 }
    );
  });

  it('should always end with /health path', () => {
    fc.assert(
      fc.property(anyUrl, (url) => {
        const result = buildHealthUrl(url);
        const parsed = new URL(result);
        expect(parsed.pathname).toBe('/health');
      }),
      { numRuns: 100 }
    );
  });

  it('should remove any existing path', () => {
    fc.assert(
      fc.property(anyUrl, path, (url, p) => {
        const urlWithPath = url + p;
        const result = buildHealthUrl(urlWithPath);
        const parsed = new URL(result);
        expect(parsed.pathname).toBe('/health');
      }),
      { numRuns: 100 }
    );
  });

  it('should remove any query parameters', () => {
    fc.assert(
      fc.property(anyUrl, fc.string(), fc.string(), (url, key, value) => {
        const urlWithQuery = `${url}?${key}=${value}`;
        const result = buildHealthUrl(urlWithQuery);
        const parsed = new URL(result);
        expect(parsed.search).toBe('');
      }),
      { numRuns: 100 }
    );
  });

  it('should be idempotent - building health URL twice yields same result', () => {
    fc.assert(
      fc.property(anyUrl, (url) => {
        const once = buildHealthUrl(url);
        const twice = buildHealthUrl(once);
        expect(twice).toBe(once);
      }),
      { numRuns: 100 }
    );
  });

  it('should handle URLs with trailing slashes correctly', () => {
    fc.assert(
      fc.property(anyUrl, fc.integer({ min: 1, max: 5 }), (url, slashes) => {
        const urlWithSlashes = url + '/'.repeat(slashes);
        const result = buildHealthUrl(urlWithSlashes);
        const parsed = new URL(result);
        expect(parsed.pathname).toBe('/health');
      }),
      { numRuns: 100 }
    );
  });

  it('should map protocols correctly: ws→http, wss→https', () => {
    fc.assert(
      fc.property(anyUrl, (url) => {
        const result = buildHealthUrl(url);
        if (url.startsWith('ws://')) {
          expect(result).toMatch(/^http:\/\//);
        } else if (url.startsWith('wss://')) {
          expect(result).toMatch(/^https:\/\//);
        } else if (url.startsWith('http://')) {
          expect(result).toMatch(/^http:\/\//);
        } else if (url.startsWith('https://')) {
          expect(result).toMatch(/^https:\/\//);
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe('validateUrls', () => {
  it('should throw error for empty or whitespace-only baseUrl', () => {
    const emptyOrWhitespace = fc.oneof(
      fc.constant(''),
      fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 10 }).map(arr => arr.join(''))
    );
    const validPageUrl = fc.webUrl();

    fc.assert(
      fc.property(emptyOrWhitespace, validPageUrl, (baseUrl, pageUrl) => {
        expect(() => validateUrls(baseUrl, pageUrl)).toThrow('baseUrl is required and cannot be empty');
      }),
      { numRuns: 100 }
    );
  });

  it('should throw error for empty or whitespace-only pageUrl', () => {
    const validBaseUrl = anyUrl;
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

  it('should accept http:// protocol', () => {
    fc.assert(
      fc.property(httpUrl.filter(u => u.startsWith('http://')), pageUrl, (baseUrl, page) => {
        expect(() => validateUrls(baseUrl, page)).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });

  it('should accept https:// protocol', () => {
    fc.assert(
      fc.property(httpUrl.filter(u => u.startsWith('https://')), pageUrl, (baseUrl, page) => {
        expect(() => validateUrls(baseUrl, page)).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });

  it('should accept ws:// protocol', () => {
    fc.assert(
      fc.property(wsUrl.filter(u => u.startsWith('ws://')), pageUrl, (baseUrl, page) => {
        expect(() => validateUrls(baseUrl, page)).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });

  it('should accept wss:// protocol', () => {
    fc.assert(
      fc.property(wsUrl.filter(u => u.startsWith('wss://')), pageUrl, (baseUrl, page) => {
        expect(() => validateUrls(baseUrl, page)).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });

  it('should accept all valid protocols (http, https, ws, wss)', () => {
    fc.assert(
      fc.property(anyUrl, pageUrl, (baseUrl, page) => {
        expect(() => validateUrls(baseUrl, page)).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });

  it('should reject invalid protocols', () => {
    const invalidProtocol = fc.constantFrom('ftp://', 'file://', 'ssh://', 'telnet://');
    const invalidUrl = fc.tuple(invalidProtocol, domain).map(([protocol, dom]) => `${protocol}${dom}`);

    fc.assert(
      fc.property(invalidUrl, pageUrl, (baseUrl, page) => {
        expect(() => validateUrls(baseUrl, page)).toThrow('baseUrl must start with http://, https://, ws://, or wss://');
      }),
      { numRuns: 100 }
    );
  });

  it('should reject URLs without protocol', () => {
    const urlWithoutProtocol = fc.tuple(domain, path).map(([dom, p]) => `${dom}${p}`);

    fc.assert(
      fc.property(urlWithoutProtocol, pageUrl, (baseUrl, page) => {
        expect(() => validateUrls(baseUrl, page)).toThrow('baseUrl must start with http://, https://, ws://, or wss://');
      }),
      { numRuns: 100 }
    );
  });
});

describe('URL Encoding Round-Trip', () => {
  it('should preserve pageUrl through encode/decode round-trip', () => {
    const pageUrlArb = fc.webUrl();

    fc.assert(
      fc.property(anyUrl, pageUrlArb, (baseUrl, page) => {
        const wsUrl = buildWsUrl(baseUrl, page);
        const url = new URL(wsUrl);
        const decoded = url.searchParams.get('page_url');
        expect(decoded).toBe(page);
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
      fc.property(anyUrl, dexScreenerUrl, (baseUrl, page) => {
        const wsUrl = buildWsUrl(baseUrl, page);
        const url = new URL(wsUrl);
        const decoded = url.searchParams.get('page_url');
        
        expect(decoded).toBe(page);
        expect(decoded).toContain('[');
        expect(decoded).toContain(']');
        expect(decoded).toContain('&');
        expect(decoded).toContain('=');
      }),
      { numRuns: 100 }
    );
  });
});
