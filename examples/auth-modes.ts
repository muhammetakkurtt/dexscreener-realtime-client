/**
 * Authentication Modes Example
 *
 * This example demonstrates all four authentication modes supported by the SDK:
 * - auto: Tries header first, falls back to query on 4401 (recommended)
 * - header: Token in Authorization header only (most secure)
 * - query: Token in URL query parameter only
 * - both: Token in both header and query (maximum compatibility)
 *
 * How to run:
 * 1. Build the project first: npm run build
 * 2. Copy .env.example to .env and fill in your credentials
 * 3. Run with mode argument: npx tsx examples/auth-modes.ts [auto|header|query|both]
 *    Example: npx tsx examples/auth-modes.ts auto
 *
 * Press Ctrl+C to stop the stream.
 */

import 'dotenv/config';
import { DexScreenerStream } from '../src/index.js';
import type { AuthMode } from '../src/index.js';

const baseUrl = process.env.DEX_ACTOR_BASE;
const apiToken = process.env.APIFY_TOKEN;

if (!baseUrl || !apiToken) {
  console.error('Error: DEX_ACTOR_BASE and APIFY_TOKEN environment variables are required');
  process.exit(1);
}

// Get auth mode from command line argument
const authMode = (process.argv[2] || 'auto') as AuthMode;

if (!['auto', 'header', 'query', 'both'].includes(authMode)) {
  console.error('Invalid auth mode. Use: auto, header, query, or both');
  process.exit(1);
}

console.log(`\n=== Authentication Mode: ${authMode} ===\n`);

// Explain the selected mode
const explanations: Record<AuthMode, string> = {
  auto: `
Auto mode (recommended):
- First attempts authentication with token in Authorization header
- If server responds with 4401, automatically retries with token in query parameter
- Best balance of security and compatibility
- Fallback happens only once per connection cycle
`,
  header: `
Header mode (most secure):
- Sends token only in Authorization: Bearer <token> header
- Token never appears in URL or logs
- No automatic fallback on authentication failure
- Use when you know the server supports header authentication
`,
  query: `
Query mode:
- Sends token as URL query parameter: ?token=<token>
- Token visible in URL (less secure)
- No automatic fallback
- Use when your environment doesn't support custom headers
`,
  both: `
Both mode (maximum compatibility):
- Sends token in both Authorization header AND query parameter
- Redundant but ensures compatibility
- Use behind complex proxy setups or when unsure which method the server requires
`,
};

console.log(explanations[authMode]);

const pageUrl = 'https://dexscreener.com/solana?rankBy=trendingScoreH6&order=desc';

const stream = new DexScreenerStream({
  baseUrl,
  apiToken,
  pageUrl,
  streamId: `auth-${authMode}`,
  authMode, // Use the selected auth mode
  retryMs: 3000,
  keepAliveMs: 120000,
  
  onBatch: (event, { streamId }) => {
    console.log(`[${streamId}] ✓ Received batch with ${event.pairs?.length ?? 0} pairs`);
    
    // Show first pair as example
    if (event.pairs && event.pairs.length > 0) {
      const pair = event.pairs[0];
      const symbol = `${pair.baseToken?.symbol}/${pair.quoteToken?.symbol}`;
      const price = pair.priceUsd ?? 'N/A';
      console.log(`[${streamId}] Example: ${symbol} = $${price}`);
    }
  },
  
  onError: (error, { streamId }) => {
    console.error(`[${streamId}] ✗ Error:`, error);
    
    if (error instanceof Error) {
      if (error.message.includes('4401') || error.message.includes('Authentication failed')) {
        console.error(`\n⚠️  Authentication failed with mode: ${authMode}`);
        console.error('Possible causes:');
        console.error('  - Invalid or expired APIFY_TOKEN');
        console.error('  - Server does not support this authentication method');
        
        if (authMode === 'header') {
          console.error('\n💡 Try using authMode: "auto" for automatic fallback');
        } else if (authMode === 'query') {
          console.error('\n💡 Try using authMode: "header" or "auto" for better security');
        }
      } else if (error.message.includes('4403')) {
        console.error('\n⚠️  Forbidden - token may lack necessary permissions');
      }
    }
  },
  
  onStateChange: (state, { streamId }) => {
    const stateEmoji = {
      disconnected: '⚫',
      connecting: '🟡',
      connected: '🟢',
      reconnecting: '🟠',
    };
    
    console.log(`[${streamId}] ${stateEmoji[state]} Connection state: ${state}`);
    
    if (state === 'connected') {
      console.log(`[${streamId}] ✓ Successfully authenticated using ${authMode} mode`);
    } else if (state === 'disconnected') {
      console.log(`[${streamId}] ⚫ Disconnected - check if authentication failed`);
    }
  },
});

console.log(`Starting stream with authMode: ${authMode}...`);
console.log(`Base URL: ${baseUrl}`);
console.log(`Page URL: ${pageUrl}\n`);

stream.start();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  stream.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  stream.stop();
  process.exit(0);
});
