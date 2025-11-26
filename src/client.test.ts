import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PeerCat } from './client';
import {
  AuthenticationError,
  InsufficientCreditsError,
  InvalidRequestError,
  RateLimitError,
  NetworkError,
  TimeoutError,
} from './errors';

// Mock fetch
const mockFetch = vi.fn();

describe('PeerCat', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should throw if apiKey is not provided', () => {
      expect(() => new PeerCat({ apiKey: '' })).toThrow('API key is required');
    });

    it('should use default baseUrl', () => {
      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch });
      expect(client).toBeDefined();
    });

    it('should strip trailing slash from baseUrl', () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ models: [] }),
      });

      const client = new PeerCat({
        apiKey: 'test',
        baseUrl: 'https://api.example.com/',
        fetch: mockFetch,
      });

      client.getModels();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/v1/models',
        expect.any(Object)
      );
    });
  });

  describe('generate', () => {
    it('should call the generate endpoint', async () => {
      const mockResult = {
        id: 'gen_123',
        imageUrl: 'https://example.com/image.png',
        ipfsHash: null,
        model: 'stable-diffusion-xl',
        mode: 'production',
        usage: { creditsUsed: 0.05, balanceRemaining: 9.95 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResult),
      });

      const client = new PeerCat({ apiKey: 'test_key', fetch: mockFetch });
      const result = await client.generate({ prompt: 'test prompt' });

      expect(result).toEqual(mockResult);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.peerc.at/v1/generate',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test_key',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ prompt: 'test prompt' }),
        })
      );
    });

    it('should support demo mode', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'demo_123',
            mode: 'demo',
            usage: { creditsUsed: 0 },
          }),
      });

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch });
      const result = await client.generate({ prompt: 'test', mode: 'demo' });

      expect(result.mode).toBe('demo');
      expect(result.usage.creditsUsed).toBe(0);
    });
  });

  describe('getModels', () => {
    it('should return models array', async () => {
      const mockModels = [
        { id: 'model-1', name: 'Model 1' },
        { id: 'model-2', name: 'Model 2' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ models: mockModels }),
      });

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch });
      const models = await client.getModels();

      expect(models).toEqual(mockModels);
    });
  });

  describe('getPrices', () => {
    it('should return price information', async () => {
      const mockPrices = {
        solPrice: 150,
        slippageTolerance: 0.02,
        models: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPrices),
      });

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch });
      const prices = await client.getPrices();

      expect(prices.solPrice).toBe(150);
    });
  });

  describe('getBalance', () => {
    it('should return balance information', async () => {
      const mockBalance = {
        credits: 10,
        totalDeposited: 50,
        totalSpent: 40,
        totalWithdrawn: 0,
        totalGenerated: 800,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBalance),
      });

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch });
      const balance = await client.getBalance();

      expect(balance.credits).toBe(10);
    });
  });

  describe('getHistory', () => {
    it('should include pagination params in query string', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: [], pagination: {} }),
      });

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch });
      await client.getHistory({ limit: 10, offset: 20 });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.peerc.at/v1/history?limit=10&offset=20',
        expect.any(Object)
      );
    });
  });

  describe('error handling', () => {
    it('should throw AuthenticationError for 401', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            error: {
              type: 'authentication_error',
              code: 'invalid_api_key',
              message: 'Invalid API key',
              param: null,
            },
          }),
      });

      const client = new PeerCat({ apiKey: 'bad_key', fetch: mockFetch });

      await expect(client.getBalance()).rejects.toThrow(AuthenticationError);
    });

    it('should throw InsufficientCreditsError for 402', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 402,
        json: () =>
          Promise.resolve({
            error: {
              type: 'insufficient_credits',
              code: 'insufficient_balance',
              message: 'Insufficient credits',
              param: null,
            },
          }),
      });

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch });

      await expect(client.generate({ prompt: 'test' })).rejects.toThrow(
        InsufficientCreditsError
      );
    });

    it('should throw InvalidRequestError for 400', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            error: {
              type: 'invalid_request_error',
              code: 'invalid_prompt',
              message: 'Prompt too long',
              param: 'prompt',
            },
          }),
      });

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch });

      await expect(client.generate({ prompt: 'x'.repeat(3000) })).rejects.toThrow(
        InvalidRequestError
      );
    });

    it('should throw RateLimitError for 429', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () =>
          Promise.resolve({
            error: {
              type: 'rate_limit_error',
              code: 'rate_limit_exceeded',
              message: 'Rate limit exceeded',
              param: null,
            },
          }),
      });

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch });

      await expect(client.getBalance()).rejects.toThrow(RateLimitError);
    });

    it('should not retry on 4xx errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            error: {
              type: 'invalid_request_error',
              code: 'bad_request',
              message: 'Bad request',
              param: null,
            },
          }),
      });

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 3 });

      await expect(client.getBalance()).rejects.toThrow(InvalidRequestError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on 5xx errors', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () =>
            Promise.resolve({
              error: {
                type: 'server_error',
                code: 'internal_error',
                message: 'Internal error',
                param: null,
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ credits: 10 }),
        });

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch, maxRetries: 1 });
      const balance = await client.getBalance();

      expect(balance.credits).toBe(10);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('API keys', () => {
    it('should list keys', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ keys: [{ id: 'key_1' }] }),
      });

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch });
      const result = await client.listKeys();

      expect(result.keys).toHaveLength(1);
    });

    it('should revoke a key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch });
      await client.revokeKey('key_123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.peerc.at/v1/keys/key_123',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should update key name', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch });
      await client.updateKeyName('key_123', 'New Name');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.peerc.at/v1/keys/key_123',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'New Name' }),
        })
      );
    });
  });

  describe('on-chain payments', () => {
    it('should submit prompt', async () => {
      const mockSubmission = {
        submissionId: 'sub_123',
        promptHash: 'abc123',
        paymentAddress: '9JKi...',
        requiredAmount: { sol: 0.001, lamports: 1000000, usd: 0.05 },
        memo: 'PCAT:v1:sdxl:abc123',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSubmission),
      });

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch });
      const result = await client.submitPrompt({ prompt: 'test' });

      expect(result.submissionId).toBe('sub_123');
    });

    it('should get on-chain status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            txSignature: 'tx123',
            status: 'completed',
            imageUrl: 'https://...',
          }),
      });

      const client = new PeerCat({ apiKey: 'test', fetch: mockFetch });
      const result = await client.getOnChainStatus('tx123');

      expect(result.status).toBe('completed');
    });
  });
});
