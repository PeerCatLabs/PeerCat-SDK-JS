# @peercat/sdk

Official TypeScript/JavaScript SDK for the PeerCat AI image generation API.

## Installation

```bash
npm install @peercat/sdk
# or
yarn add @peercat/sdk
# or
pnpm add @peercat/sdk
```

## Quick Start

```typescript
import { PeerCat } from '@peercat/sdk';

const client = new PeerCat({ apiKey: 'pcat_live_xxx' });

// Generate an image
const result = await client.generate({
  prompt: 'A beautiful sunset over mountains',
  model: 'stable-diffusion-xl',
});

console.log(result.imageUrl);
```

## Features

- Full TypeScript support with comprehensive types
- ESM and CommonJS support
- Automatic retries with exponential backoff
- Configurable timeouts
- All API endpoints covered
- On-chain SOL payment support

## Configuration

```typescript
const client = new PeerCat({
  apiKey: 'pcat_live_xxx',      // Required
  baseUrl: 'https://api.peerc.at', // Optional (default)
  timeout: 60000,               // Optional: Request timeout in ms (default: 60000)
  maxRetries: 3,                // Optional: Retry attempts (default: 3)
  fetch: customFetch,           // Optional: Custom fetch for Node.js < 18
});
```

## API Reference

### Image Generation

#### `generate(params)`

Generate an image from a text prompt.

```typescript
const result = await client.generate({
  prompt: 'A futuristic cityscape at night',
  model: 'stable-diffusion-xl',  // Optional (default)
  mode: 'production',            // Optional: 'production' | 'demo'
  options: {},                   // Optional: Model-specific options
});

// Result:
// {
//   id: 'gen_xxx',
//   imageUrl: 'https://...',
//   ipfsHash: 'Qm...',
//   model: 'stable-diffusion-xl',
//   mode: 'production',
//   usage: {
//     creditsUsed: 0.05,
//     balanceRemaining: 9.95
//   }
// }
```

**Demo Mode**: Use `mode: 'demo'` to test without using credits. Returns a placeholder image.

### Models & Pricing

#### `getModels()`

List available models.

```typescript
const models = await client.getModels();
// [
//   {
//     id: 'stable-diffusion-xl',
//     name: 'Stable Diffusion XL',
//     description: '...',
//     priceUsd: 0.05,
//     ...
//   }
// ]
```

#### `getPrices()`

Get current pricing including SOL conversion rates.

```typescript
const prices = await client.getPrices();
// {
//   solPrice: 150.00,
//   slippageTolerance: 0.02,
//   updatedAt: '2024-01-01T00:00:00Z',
//   models: [
//     { model: 'stable-diffusion-xl', priceUsd: 0.05, priceSol: 0.000333, ... }
//   ]
// }
```

### Account

#### `getBalance()`

Get current credit balance.

```typescript
const balance = await client.getBalance();
// {
//   credits: 10.00,
//   totalDeposited: 50.00,
//   totalSpent: 40.00,
//   totalWithdrawn: 0,
//   totalGenerated: 800
// }
```

#### `getHistory(params?)`

Get usage history.

```typescript
const history = await client.getHistory({ limit: 50, offset: 0 });
// {
//   items: [...],
//   pagination: { total: 100, limit: 50, offset: 0, hasMore: true }
// }
```

### API Keys

#### `createKey(params)`

Create a new API key (requires wallet signature).

```typescript
const newKey = await client.createKey({
  name: 'Production App',
  message: 'Create API key for PeerCat',
  signature: 'base58signature...',
  publicKey: 'walletPublicKey...',
});
// Warning: Full key is only returned once!
```

#### `listKeys()`

List all API keys.

```typescript
const keys = await client.listKeys();
```

#### `revokeKey(keyId)`

Revoke an API key.

```typescript
await client.revokeKey('key_xxx');
```

### On-Chain Payments

For direct SOL payments without credits.

#### `submitPrompt(params)`

Submit a prompt and get payment details.

```typescript
const submission = await client.submitPrompt({
  prompt: 'A majestic dragon',
  model: 'stable-diffusion-xl',
  callbackUrl: 'https://myapp.com/webhook', // Optional
});

// {
//   submissionId: 'sub_xxx',
//   promptHash: 'abc123...',
//   paymentAddress: '9JKi...',
//   requiredAmount: { sol: 0.000333, lamports: 333333, usd: 0.05 },
//   memo: 'PCAT:v1:sdxl:abc123...',
//   expiresAt: '2024-01-01T01:00:00Z'
// }
```

#### `getOnChainStatus(txSignature)`

Check generation status after payment.

```typescript
const status = await client.getOnChainStatus('txSignature...');
// {
//   txSignature: '...',
//   status: 'completed', // pending | processing | completed | failed | refunded
//   imageUrl: 'https://...',
//   ipfsHash: 'Qm...'
// }
```

## Error Handling

The SDK throws typed errors for different scenarios:

```typescript
import {
  PeerCat,
  PeerCatError,
  AuthenticationError,
  InsufficientCreditsError,
  RateLimitError,
  InvalidRequestError,
  NotFoundError,
  NetworkError,
  TimeoutError,
} from '@peercat/sdk';

try {
  await client.generate({ prompt: 'test' });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.log('Invalid API key');
  } else if (error instanceof InsufficientCreditsError) {
    console.log('Add more credits');
  } else if (error instanceof RateLimitError) {
    console.log(`Rate limited. Retry after: ${error.retryAfter}s`);
  } else if (error instanceof InvalidRequestError) {
    console.log(`Invalid request: ${error.param}`);
  } else if (error instanceof NetworkError) {
    console.log('Network error, check connection');
  } else if (error instanceof TimeoutError) {
    console.log('Request timed out');
  } else if (error instanceof PeerCatError) {
    console.log(`API error: ${error.code}`);
  }
}
```

## Requirements

- Node.js 16+ (Node.js 18+ recommended for native fetch)
- For Node.js < 18, provide a fetch implementation:

```typescript
import fetch from 'node-fetch';

const client = new PeerCat({
  apiKey: 'pcat_live_xxx',
  fetch: fetch as unknown as typeof globalThis.fetch,
});
```

## License

MIT
