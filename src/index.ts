/**
 * PeerCat SDK - Official TypeScript/JavaScript SDK for the PeerCat API
 *
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * import { PeerCat } from '@peercat/sdk';
 *
 * const client = new PeerCat({ apiKey: 'pcat_live_xxx' });
 *
 * // Generate an image
 * const result = await client.generate({
 *   prompt: 'A majestic mountain landscape',
 *   model: 'stable-diffusion-xl',
 * });
 *
 * console.log(result.imageUrl);
 * ```
 */

// Main client
export { PeerCat } from './client';

// Types
export type {
  // Configuration
  PeerCatConfig,

  // Models
  ModelId,
  Model,
  ModelsResponse,

  // Pricing
  ModelPrice,
  PriceResponse,

  // Generation
  GenerateParams,
  GenerateResult,

  // Account
  Balance,
  HistoryParams,
  HistoryItem,
  HistoryResponse,

  // API Keys
  CreateKeyParams,
  ApiKey,
  CreateKeyResult,
  KeysResponse,

  // On-Chain Payments
  SubmitPromptParams,
  PromptSubmission,
  OnChainGenerationStatus,

  // Errors
  ApiErrorResponse,
} from './types';

// Error classes
export {
  PeerCatError,
  AuthenticationError,
  InvalidRequestError,
  InsufficientCreditsError,
  RateLimitError,
  NotFoundError,
  NetworkError,
  TimeoutError,
} from './errors';
