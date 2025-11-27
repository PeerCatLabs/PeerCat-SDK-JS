/**
 * PeerCat SDK Client
 */

import type {
  PeerCatConfig,
  Model,
  ModelsResponse,
  PriceResponse,
  GenerateParams,
  GenerateResult,
  Balance,
  HistoryParams,
  HistoryResponse,
  CreateKeyParams,
  CreateKeyResult,
  KeysResponse,
  SubmitPromptParams,
  PromptSubmission,
  OnChainGenerationStatus,
  ApiErrorResponse,
} from './types';

import {
  PeerCatError,
  NetworkError,
  TimeoutError,
  RateLimitError,
  parseRateLimitHeaders,
} from './errors';

const DEFAULT_BASE_URL = 'https://api.peerc.at';
const DEFAULT_TIMEOUT = 60000;
const DEFAULT_MAX_RETRIES = 3;

/**
 * PeerCat API Client
 *
 * @example
 * ```typescript
 * import { PeerCat } from '@peercat/sdk';
 *
 * const client = new PeerCat({ apiKey: 'pcat_live_xxx' });
 *
 * // Generate an image
 * const result = await client.generate({
 *   prompt: 'A beautiful sunset over mountains',
 *   model: 'stable-diffusion-xl',
 * });
 *
 * console.log(result.imageUrl);
 * ```
 */
export class PeerCat {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly fetchFn: typeof fetch;

  constructor(config: PeerCatConfig) {
    if (!config.apiKey) {
      throw new Error('API key is required');
    }

    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.fetchFn = config.fetch ?? globalThis.fetch;

    if (!this.fetchFn) {
      throw new Error(
        'fetch is not available. Please provide a fetch implementation or use Node.js 18+'
      );
    }
  }

  // ============ Image Generation ============

  /**
   * Generate an image from a text prompt
   *
   * @param params - Generation parameters
   * @returns Generated image result with URL and usage info
   *
   * @example
   * ```typescript
   * const result = await client.generate({
   *   prompt: 'A futuristic cityscape at night',
   *   model: 'stable-diffusion-xl',
   * });
   * ```
   */
  async generate(params: GenerateParams): Promise<GenerateResult> {
    return this.request<GenerateResult>('POST', '/v1/generate', params);
  }

  // ============ Models & Pricing ============

  /**
   * List available image generation models
   *
   * @returns Array of available models with their details
   */
  async getModels(): Promise<Model[]> {
    const response = await this.request<ModelsResponse>('GET', '/v1/models');
    return response.models;
  }

  /**
   * Get current pricing for all models
   *
   * @returns Price information including SOL/USD rate and model prices
   */
  async getPrices(): Promise<PriceResponse> {
    return this.request<PriceResponse>('GET', '/v1/price');
  }

  // ============ Account ============

  /**
   * Get current credit balance
   *
   * @returns Balance information including credits and usage stats
   */
  async getBalance(): Promise<Balance> {
    return this.request<Balance>('GET', '/v1/balance');
  }

  /**
   * Get usage history
   *
   * @param params - Pagination parameters
   * @returns Usage history with pagination info
   */
  async getHistory(params?: HistoryParams): Promise<HistoryResponse> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));

    const queryString = query.toString();
    const path = queryString ? `/v1/history?${queryString}` : '/v1/history';

    return this.request<HistoryResponse>('GET', path);
  }

  // ============ API Keys ============

  /**
   * Create a new API key (requires wallet signature)
   *
   * @param params - Key creation parameters including wallet signature
   * @returns New API key (only shown once!)
   */
  async createKey(params: CreateKeyParams): Promise<CreateKeyResult> {
    return this.request<CreateKeyResult>('POST', '/v1/keys', params);
  }

  /**
   * List all API keys for the authenticated wallet
   *
   * @returns Array of API keys (without full key values)
   */
  async listKeys(): Promise<KeysResponse> {
    return this.request<KeysResponse>('GET', '/v1/keys');
  }

  /**
   * Revoke an API key
   *
   * @param keyId - ID of the key to revoke
   */
  async revokeKey(keyId: string): Promise<void> {
    await this.request<{ success: boolean }>('DELETE', `/v1/keys/${keyId}`);
  }

  /**
   * Update API key name
   *
   * @param keyId - ID of the key to update
   * @param name - New name for the key
   */
  async updateKeyName(keyId: string, name: string): Promise<void> {
    await this.request<{ success: boolean }>('PATCH', `/v1/keys/${keyId}`, { name });
  }

  // ============ On-Chain Payments ============

  /**
   * Submit a prompt for on-chain payment
   *
   * @param params - Prompt submission parameters
   * @returns Payment details including treasury address and required amount
   */
  async submitPrompt(params: SubmitPromptParams): Promise<PromptSubmission> {
    return this.request<PromptSubmission>('POST', '/v1/prompts', params);
  }

  /**
   * Get status of an on-chain generation by transaction signature
   *
   * @param txSignature - Solana transaction signature
   * @returns Generation status and result (when complete)
   */
  async getOnChainStatus(txSignature: string): Promise<OnChainGenerationStatus> {
    return this.request<OnChainGenerationStatus>(`GET`, `/v1/generate/${txSignature}`);
  }

  // ============ Internal Methods ============

  /**
   * Make an authenticated API request with retry logic
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    // Only set User-Agent in Node.js environments (browsers forbid this header)
    if (typeof window === 'undefined' && typeof globalThis.navigator === 'undefined') {
      headers['User-Agent'] = '@peercat/sdk/0.1.0';
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await this.fetchFn(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Parse rate limit headers (useful for both success and error cases)
        const rateLimitInfo = parseRateLimitHeaders(response.headers);

        // Check response status first, before parsing body
        if (!response.ok) {
          // Try to parse error response as JSON, with fallback for non-JSON bodies
          let errorResponse: ApiErrorResponse;
          try {
            errorResponse = await response.json() as ApiErrorResponse;
          } catch {
            // Non-JSON error body (e.g., HTML error page)
            errorResponse = {
              error: {
                type: 'api_error',
                code: `http_${response.status}`,
                message: `HTTP ${response.status}: ${response.statusText}`,
              },
            };
          }
          throw PeerCatError.fromResponse(errorResponse, response.status, rateLimitInfo);
        }

        // Parse successful response
        return await response.json() as T;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on client errors (4xx) except rate limits
        if (error instanceof PeerCatError && error.status >= 400 && error.status < 500) {
          // Allow retry on rate limit errors
          if (!(error instanceof RateLimitError)) {
            throw error;
          }
        }

        // Handle timeout
        if (error instanceof Error && error.name === 'AbortError') {
          lastError = new TimeoutError(`Request timed out after ${this.timeout}ms`);
        }

        // Handle network errors
        if (error instanceof TypeError && error.message.includes('fetch')) {
          lastError = new NetworkError('Network request failed', error);
        }

        // If we have more retries, wait with exponential backoff
        if (attempt < this.maxRetries) {
          // Use retry-after header if available for rate limit errors
          let delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          if (error instanceof RateLimitError && error.retryAfter) {
            delay = error.retryAfter * 1000; // Convert seconds to ms
          }
          await this.sleep(delay);
        }
      }
    }

    throw lastError ?? new NetworkError('Request failed after retries');
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
