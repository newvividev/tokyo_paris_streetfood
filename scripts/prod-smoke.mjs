const prodBaseUrl = process.env.PROD_BASE_URL?.trim();

if (!prodBaseUrl) {
  throw new Error('Missing PROD_BASE_URL');
}

process.env.SMOKE_BASE_URL = prodBaseUrl;
process.env.SMOKE_TARGET = 'production';

await import('./browser-smoke.mjs');
