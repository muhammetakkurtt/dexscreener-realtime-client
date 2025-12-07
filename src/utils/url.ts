/** Removes trailing slashes from a URL. */
export function sanitizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

/** Builds the SSE endpoint URL from base URL and page URL. */
export function buildSseUrl(baseUrl: string, pageUrl: string): string {
  const sanitizedBase = sanitizeBaseUrl(baseUrl);
  const encodedPageUrl = encodeURIComponent(pageUrl);
  return `${sanitizedBase}/events/dex/pairs?page_url=${encodedPageUrl}`;
}

/** Validates that required URLs are provided and non-empty. */
export function validateUrls(baseUrl: string, pageUrl: string): void {
  if (!baseUrl || baseUrl.trim() === '') {
    throw new Error('baseUrl is required and cannot be empty');
  }
  
  if (!pageUrl || pageUrl.trim() === '') {
    throw new Error('pageUrl is required and cannot be empty');
  }
}
