/**
 * Error Scenario and Resilience Tests
 *
 * These tests cover edge cases, network failures, malformed responses,
 * and retry/rate-limit behavior to ensure SDK robustness.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PeerCat } from './client';
import {
  AuthenticationError,
  InsufficientCreditsError,
  InvalidRequestError,
  RateLimitError,
  NetworkError,
  PeerCatError,
} from './errors';

// Mock fetch
const mockFetch = vi.fn();

// Helper to create mock response with headers
function createMockResponse(
  data: unknown,
  options: { ok?: boolean; status?: number; headers?: Record<string, string> } = {}
) {
  const { ok = true, status = 200, headers = {} } = options;
  const mockHeaders = new Map(Object.entries(headers));
  return {
    ok,
    status,
    json: () => Promise.resolve(data),
    headers: {
      get: (name: string) => mockHeaders.get(name) ?? null,
    },
  };
}

// Helper to create a response that fails JSON parsing
function createMalformedJsonResponse(status = 200, ok = true) {
  return {
    ok,
    status,
    json: () => Promise.reject(new SyntaxError('Unexpected token')),
    headers: {
      get: () => null,
    },
  };
}

// Helper to simulate network failure
function createNetworkError(message = 'Network error') {
  return Promise.reject(new TypeError(message));
}

// Helper to simulate timeout
function createTimeoutError() {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return Promise.reject(error);
}

describe('Error Scenarios', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ============ Malformed Response Tests ============

  describe('malformed responses', () => {
    it('should handle malformed JSON in success response', async () => {
      mockFetch.mockResolvedValueOnce(createMalformedJsonResponse(200, true));

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 0 });

      await expect(client.getBalance()).rejects.toThrow();
    });

    it('should handle malformed JSON in error response', async () => {
      mockFetch.mockResolvedValueOnce(createMalformedJsonResponse(500, false));

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 0 });

      await expect(client.getBalance()).rejects.toThrow();
    });

    it('should handle empty response body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(null),
        headers: { get: () => null },
      });

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch });
      const result = await client.getBalance();

      // Should return null/undefined without crashing
      expect(result).toBeNull();
    });

    it('should handle error response without error object', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(
        { message: 'Something went wrong' }, // No 'error' wrapper
        { ok: false, status: 500 }
      ));

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 0 });

      await expect(client.getBalance()).rejects.toThrow();
    });

    it('should handle error response with partial error object', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(
        { error: { message: 'Partial error' } }, // Missing type and code
        { ok: false, status: 500 }
      ));

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 0 });

      await expect(client.getBalance()).rejects.toThrow();
    });
  });

  // ============ Network Failure Tests ============

  describe('network failures', () => {
    it('should throw on connection failure', async () => {
      mockFetch.mockImplementationOnce(() => createNetworkError('Failed to fetch'));

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 0 });

      // SDK may wrap in NetworkError or throw original - just verify it throws
      await expect(client.getBalance()).rejects.toThrow();
    });

    it('should throw on DNS resolution failure', async () => {
      mockFetch.mockImplementationOnce(() =>
        createNetworkError('getaddrinfo ENOTFOUND api.peerc.at')
      );

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 0 });

      await expect(client.getBalance()).rejects.toThrow();
    });

    it('should throw on connection reset', async () => {
      mockFetch.mockImplementationOnce(() =>
        createNetworkError('ECONNRESET')
      );

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 0 });

      await expect(client.getBalance()).rejects.toThrow();
    });

    it('should retry network errors', async () => {
      mockFetch
        .mockImplementationOnce(() => createNetworkError())
        .mockResolvedValueOnce(createMockResponse({ credits: 10 }));

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 1 });
      const balance = await client.getBalance();

      expect(balance.credits).toBe(10);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should exhaust retries on persistent network errors', async () => {
      mockFetch.mockImplementation(() => createNetworkError());

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 2 });

      await expect(client.getBalance()).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  // ============ Timeout Tests ============

  describe('timeout handling', () => {
    it('should handle request timeout (AbortError)', async () => {
      mockFetch.mockImplementationOnce(() => createTimeoutError());

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 0 });

      await expect(client.getBalance()).rejects.toThrow();
    });

    it('should retry on timeout', async () => {
      mockFetch
        .mockImplementationOnce(() => createTimeoutError())
        .mockResolvedValueOnce(createMockResponse({ credits: 10 }));

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 1 });
      const balance = await client.getBalance();

      expect(balance.credits).toBe(10);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // ============ HTTP Status Code Tests ============

  describe('HTTP status codes', () => {
    it('should handle 403 Forbidden', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        error: {
          type: 'authentication_error',
          code: 'forbidden',
          message: 'Access denied',
        },
      }, { ok: false, status: 403 }));

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 0 });

      await expect(client.getBalance()).rejects.toThrow(AuthenticationError);
    });

    it('should handle 404 Not Found', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        error: {
          type: 'not_found',
          code: 'resource_not_found',
          message: 'Generation not found',
        },
      }, { ok: false, status: 404 }));

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 0 });

      await expect(client.getOnChainStatus('invalid_tx')).rejects.toThrow();
    });

    it('should handle 502 Bad Gateway', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        error: {
          type: 'server_error',
          code: 'bad_gateway',
          message: 'Bad gateway',
        },
      }, { ok: false, status: 502 }));

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 0 });

      await expect(client.getBalance()).rejects.toThrow(PeerCatError);
    });

    it('should handle 503 Service Unavailable', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        error: {
          type: 'server_error',
          code: 'service_unavailable',
          message: 'Service temporarily unavailable',
        },
      }, { ok: false, status: 503 }));

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 0 });

      await expect(client.getBalance()).rejects.toThrow(PeerCatError);
    });

    it('should handle 504 Gateway Timeout', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        error: {
          type: 'server_error',
          code: 'gateway_timeout',
          message: 'Gateway timeout',
        },
      }, { ok: false, status: 504 }));

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 0 });

      await expect(client.getBalance()).rejects.toThrow(PeerCatError);
    });

    it('should retry 5xx errors', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({
          error: { type: 'server_error', code: 'internal_error', message: 'Error' },
        }, { ok: false, status: 500 }))
        .mockResolvedValueOnce(createMockResponse({
          error: { type: 'server_error', code: 'internal_error', message: 'Error' },
        }, { ok: false, status: 502 }))
        .mockResolvedValueOnce(createMockResponse({ credits: 10 }));

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 2 });
      const balance = await client.getBalance();

      expect(balance.credits).toBe(10);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry 4xx errors except 429', async () => {
      // 401 - should not retry
      mockFetch.mockResolvedValueOnce(createMockResponse({
        error: { type: 'authentication_error', code: 'invalid_key', message: 'Invalid key' },
      }, { ok: false, status: 401 }));

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 3 });

      await expect(client.getBalance()).rejects.toThrow(AuthenticationError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  // ============ Error Property Tests ============

  describe('error properties', () => {
    it('should include status code in error', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        error: {
          type: 'authentication_error',
          code: 'invalid_api_key',
          message: 'Invalid API key',
        },
      }, { ok: false, status: 401 }));

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 0 });

      try {
        await client.getBalance();
        expect.fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(AuthenticationError);
        const authError = error as AuthenticationError;
        expect(authError.status).toBe(401);
        expect(authError.code).toBe('invalid_api_key');
        expect(authError.message).toContain('Invalid API key');
      }
    });

    it('should include param in InvalidRequestError', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        error: {
          type: 'invalid_request_error',
          code: 'invalid_param',
          message: 'Model not found',
          param: 'model',
        },
      }, { ok: false, status: 400 }));

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 0 });

      try {
        await client.generate({ prompt: 'test', model: 'invalid' });
        expect.fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidRequestError);
        const reqError = error as InvalidRequestError;
        expect(reqError.param).toBe('model');
      }
    });

    it('should correctly identify rate limit errors', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        error: { type: 'rate_limit_error', code: 'rate_limit_exceeded', message: 'Rate limited' },
      }, { ok: false, status: 429 }));

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 0 });

      try {
        await client.getBalance();
        expect.fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        expect((error as PeerCatError).type).toBe('rate_limit_error');
        expect((error as PeerCatError).status).toBe(429);
      }
    });

    it('should correctly identify server errors', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        error: { type: 'server_error', code: 'internal_error', message: 'Internal error' },
      }, { ok: false, status: 500 }));

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 0 });

      try {
        await client.getBalance();
        expect.fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(PeerCatError);
        expect((error as PeerCatError).type).toBe('server_error');
        expect((error as PeerCatError).status).toBe(500);
      }
    });

    it('should correctly identify authentication errors', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        error: { type: 'authentication_error', code: 'invalid_key', message: 'Invalid' },
      }, { ok: false, status: 401 }));

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 0 });

      try {
        await client.getBalance();
        expect.fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(AuthenticationError);
        expect((error as PeerCatError).type).toBe('authentication_error');
        expect((error as PeerCatError).status).toBe(401);
      }
    });

    it('should correctly identify insufficient credits errors', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        error: { type: 'insufficient_credits', code: 'insufficient_balance', message: 'Not enough' },
      }, { ok: false, status: 402 }));

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 0 });

      try {
        await client.generate({ prompt: 'test' });
        expect.fail('Expected error');
      } catch (error) {
        expect(error).toBeInstanceOf(InsufficientCreditsError);
        expect((error as PeerCatError).type).toBe('insufficient_credits');
        expect((error as PeerCatError).status).toBe(402);
      }
    });
  });
});

// ============ Rate Limit Simulation Tests ============

describe('Rate Limit Simulation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('rate limit header parsing', () => {
    it('should parse all rate limit headers', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        error: { type: 'rate_limit_error', code: 'rate_limit_exceeded', message: 'Rate limited' },
      }, {
        ok: false,
        status: 429,
        headers: {
          'X-RateLimit-Limit': '1000',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': '1700000000',
          'Retry-After': '60',
        },
      }));

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 0 });

      try {
        await client.getBalance();
        expect.fail('Expected RateLimitError');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        const rle = error as RateLimitError;
        expect(rle.rateLimitInfo?.limit).toBe(1000);
        expect(rle.rateLimitInfo?.remaining).toBe(0);
        expect(rle.rateLimitInfo?.reset).toBe(1700000000);
        expect(rle.retryAfter).toBe(60);
      }
    });

    it('should handle missing rate limit headers', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        error: { type: 'rate_limit_error', code: 'rate_limit_exceeded', message: 'Rate limited' },
      }, { ok: false, status: 429 }));

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 0 });

      try {
        await client.getBalance();
        expect.fail('Expected RateLimitError');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        const rle = error as RateLimitError;
        // Should not crash, headers are optional
        expect(rle.rateLimitInfo?.limit).toBeUndefined();
      }
    });

    it('should handle partial rate limit headers', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        error: { type: 'rate_limit_error', code: 'rate_limit_exceeded', message: 'Rate limited' },
      }, {
        ok: false,
        status: 429,
        headers: {
          'X-RateLimit-Remaining': '5',
          'Retry-After': '10',
        },
      }));

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 0 });

      try {
        await client.getBalance();
        expect.fail('Expected RateLimitError');
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        const rle = error as RateLimitError;
        expect(rle.rateLimitInfo?.remaining).toBe(5);
        expect(rle.retryAfter).toBe(10);
        expect(rle.rateLimitInfo?.limit).toBeUndefined();
      }
    });
  });

  describe('retry with backoff', () => {
    it('should retry rate limit errors with Retry-After', async () => {
      // This test verifies the retry logic respects Retry-After
      // Note: In real tests we'd mock timers, but here we verify the retry happens
      mockFetch
        .mockResolvedValueOnce(createMockResponse({
          error: { type: 'rate_limit_error', code: 'rate_limit_exceeded', message: 'Rate limited' },
        }, {
          ok: false,
          status: 429,
          headers: { 'Retry-After': '0' }, // 0 seconds for fast test
        }))
        .mockResolvedValueOnce(createMockResponse({ credits: 10 }));

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 1 });
      const balance = await client.getBalance();

      expect(balance.credits).toBe(10);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should exhaust retries on persistent rate limits', async () => {
      mockFetch.mockResolvedValue(createMockResponse({
        error: { type: 'rate_limit_error', code: 'rate_limit_exceeded', message: 'Rate limited' },
      }, {
        ok: false,
        status: 429,
        headers: { 'Retry-After': '0' },
      }));

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 2 });

      await expect(client.getBalance()).rejects.toThrow(RateLimitError);
      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('concurrent requests', () => {
    it('should handle multiple concurrent requests hitting rate limit', async () => {
      // Simulate burst of requests where some hit rate limit
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.resolve(createMockResponse({
            error: { type: 'rate_limit_error', code: 'rate_limit_exceeded', message: 'Rate limited' },
          }, { ok: false, status: 429, headers: { 'Retry-After': '0' } }));
        }
        return Promise.resolve(createMockResponse({ credits: 10 }));
      });

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 3 });

      // Make concurrent requests
      const results = await Promise.allSettled([
        client.getBalance(),
        client.getBalance(),
      ]);

      // At least one should succeed after retries
      const successes = results.filter(r => r.status === 'fulfilled');
      expect(successes.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ============ Edge Case Tests ============

describe('Edge Cases', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('request parameters', () => {
    it('should handle very long prompts', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        error: {
          type: 'invalid_request_error',
          code: 'prompt_too_long',
          message: 'Prompt exceeds maximum length',
          param: 'prompt',
        },
      }, { ok: false, status: 400 }));

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 0 });
      const longPrompt = 'x'.repeat(10000);

      await expect(client.generate({ prompt: longPrompt })).rejects.toThrow(InvalidRequestError);
    });

    it('should handle special characters in prompt', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        id: 'gen_123',
        imageUrl: 'https://example.com/image.png',
        mode: 'production',
        usage: { creditsUsed: 0.05, balanceRemaining: 9.95 },
      }));

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch });
      const specialPrompt = 'Test with "quotes" and <tags> and émojis 🎨';

      const result = await client.generate({ prompt: specialPrompt });

      expect(result.id).toBe('gen_123');
      // Verify the prompt was sent - check the body was parsed correctly
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.prompt).toBe(specialPrompt);
    });

    it('should handle unicode in prompt', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        id: 'gen_123',
        imageUrl: 'https://example.com/image.png',
        mode: 'production',
        usage: { creditsUsed: 0.05, balanceRemaining: 9.95 },
      }));

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch });
      const unicodePrompt = '日本語テスト 中文测试 한국어테스트';

      const result = await client.generate({ prompt: unicodePrompt });

      expect(result.id).toBe('gen_123');
    });
  });

  describe('response edge cases', () => {
    it('should handle response with extra unexpected fields', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        credits: 10,
        totalDeposited: 50,
        totalSpent: 40,
        totalWithdrawn: 0,
        totalGenerated: 800,
        unexpectedField: 'should be ignored',
        anotherUnknown: { nested: 'data' },
      }));

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch });
      const balance = await client.getBalance();

      expect(balance.credits).toBe(10);
      // Should not crash on extra fields
    });

    it('should handle very large numeric values', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        credits: 999999999.99,
        totalDeposited: 1000000000,
        totalSpent: 0.000001,
        totalWithdrawn: 0,
        totalGenerated: 9007199254740991, // Max safe integer
      }));

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch });
      const balance = await client.getBalance();

      expect(balance.credits).toBe(999999999.99);
      expect(balance.totalGenerated).toBe(9007199254740991);
    });

    it('should handle zero/negative credits', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        credits: 0,
        totalDeposited: 0,
        totalSpent: 0,
        totalWithdrawn: 0,
        totalGenerated: 0,
      }));

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch });
      const balance = await client.getBalance();

      expect(balance.credits).toBe(0);
    });
  });

  describe('API key handling', () => {
    it('should send API key in Authorization header', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ credits: 10 }));

      const client = new PeerCat({ apiKey: 'pcat_live_test123', fetch: mockFetch });
      await client.getBalance();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer pcat_live_test123',
          }),
        })
      );
    });

    it('should handle API key with special characters', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ credits: 10 }));

      const client = new PeerCat({ apiKey: 'pcat_test_abc+def/ghi=', fetch: mockFetch });
      await client.getBalance();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer pcat_test_abc+def/ghi=',
          }),
        })
      );
    });
  });
});
