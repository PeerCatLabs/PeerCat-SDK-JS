/**
 * Schema validation tests to ensure SDK types match OpenAPI specification
 *
 * These tests validate that:
 * 1. All required fields are present in response types
 * 2. Field types match the OpenAPI schema
 * 3. Mock data used in tests would be valid API responses
 * 4. SDK correctly handles all specified field types (nullable, optional, enums)
 */

import { describe, it, expect } from 'vitest';
import type {
  Model,
  ModelsResponse,
  Balance,
  GenerateResult,
  PriceResponse,
  ModelPrice,
  HistoryItem,
  HistoryResponse,
  ApiKey,
  CreateKeyResult,
  PromptSubmission,
  OnChainGenerationStatus,
} from './types';

// JSON Schema definitions derived from OpenAPI spec
const schemas = {
  Model: {
    required: ['id', 'name', 'description', 'provider', 'maxPromptLength', 'outputFormat', 'outputResolution', 'priceUsd'],
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      provider: { type: 'string' },
      maxPromptLength: { type: 'number' },
      outputFormat: { type: 'string' },
      outputResolution: { type: 'string' },
      priceUsd: { type: 'number' },
    },
  },
  Balance: {
    required: ['credits', 'totalDeposited', 'totalSpent', 'totalWithdrawn', 'totalGenerated'],
    properties: {
      credits: { type: 'number' },
      totalDeposited: { type: 'number' },
      totalSpent: { type: 'number' },
      totalWithdrawn: { type: 'number' },
      totalGenerated: { type: 'number' },
    },
  },
  GenerateResponse: {
    required: ['id', 'imageUrl', 'model', 'mode', 'usage'],
    properties: {
      id: { type: 'string' },
      imageUrl: { type: 'string' },
      ipfsHash: { type: ['string', 'null'] },
      model: { type: 'string' },
      mode: { type: 'string', enum: ['production', 'demo'] },
      usage: {
        type: 'object',
        required: ['creditsUsed', 'balanceRemaining'],
        properties: {
          creditsUsed: { type: 'number' },
          balanceRemaining: { type: 'number' },
        },
      },
    },
  },
  PriceResponse: {
    required: ['solPrice', 'updatedAt', 'slippageTolerance', 'treasury', 'models'],
    properties: {
      solPrice: { type: 'number' },
      updatedAt: { type: 'string' },
      slippageTolerance: { type: 'number' },
      treasury: { type: 'string' },
      models: { type: 'array' },
    },
  },
  ModelPrice: {
    required: ['model', 'priceUsd', 'priceSol', 'priceSolWithSlippage'],
    properties: {
      model: { type: 'string' },
      priceUsd: { type: 'number' },
      priceSol: { type: 'number' },
      priceSolWithSlippage: { type: 'number' },
    },
  },
  HistoryItem: {
    required: ['id', 'endpoint', 'creditsUsed', 'status', 'createdAt'],
    properties: {
      id: { type: 'string' },
      endpoint: { type: 'string' },
      model: { type: ['string', 'null'] },
      creditsUsed: { type: 'number' },
      requestId: { type: ['string', 'null'] },
      status: { type: 'string', enum: ['pending', 'completed', 'refunded'] },
      createdAt: { type: 'string' },
      completedAt: { type: ['string', 'null'] },
    },
  },
  ApiKey: {
    required: ['id', 'keyPrefix', 'environment', 'rateLimitTier', 'createdAt', 'revoked'],
    properties: {
      id: { type: 'string' },
      name: { type: ['string', 'null'] },
      keyPrefix: { type: 'string' },
      environment: { type: 'string', enum: ['live', 'test'] },
      rateLimitTier: { type: 'string' },
      createdAt: { type: 'string' },
      lastUsedAt: { type: ['string', 'null'] },
      revoked: { type: 'boolean' },
    },
  },
  OnChainGenerationStatus: {
    required: ['txSignature', 'status'],
    properties: {
      txSignature: { type: 'string' },
      status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed', 'refunded'] },
      model: { type: 'string' },
      createdAt: { type: 'string' },
      imageUrl: { type: 'string' },
      ipfsHash: { type: 'string' },
      completedAt: { type: 'string' },
      error: { type: 'string' },
      message: { type: 'string' },
    },
  },
};

// Type guard to check if value matches expected type
function matchesType(value: unknown, expectedType: string | string[]): boolean {
  const types = Array.isArray(expectedType) ? expectedType : [expectedType];

  for (const type of types) {
    if (type === 'null' && value === null) return true;
    if (type === 'string' && typeof value === 'string') return true;
    if (type === 'number' && typeof value === 'number') return true;
    if (type === 'boolean' && typeof value === 'boolean') return true;
    if (type === 'object' && typeof value === 'object' && value !== null) return true;
    if (type === 'array' && Array.isArray(value)) return true;
  }

  return false;
}

// Validate object against schema
function validateSchema(
  obj: Record<string, unknown>,
  schema: { required: string[]; properties: Record<string, { type: string | string[]; enum?: string[] }> }
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required fields
  for (const field of schema.required) {
    if (!(field in obj)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Check field types
  for (const [field, spec] of Object.entries(schema.properties)) {
    if (field in obj) {
      const value = obj[field];

      if (!matchesType(value, spec.type)) {
        errors.push(`Field '${field}' has wrong type. Expected ${JSON.stringify(spec.type)}, got ${typeof value}`);
      }

      // Check enum values
      if (spec.enum && value !== null && !spec.enum.includes(value as string)) {
        errors.push(`Field '${field}' has invalid enum value '${value}'. Expected one of: ${spec.enum.join(', ')}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

describe('Schema Validation Tests', () => {
  describe('Model schema', () => {
    it('should validate a complete Model object', () => {
      const model: Model = {
        id: 'stable-diffusion-xl',
        name: 'Stable Diffusion XL',
        description: 'High quality image generation',
        provider: 'stability',
        maxPromptLength: 2000,
        outputFormat: 'png',
        outputResolution: '1024x1024',
        priceUsd: 0.28,
      };

      const result = validateSchema(model as unknown as Record<string, unknown>, schemas.Model);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect missing required fields', () => {
      const incompleteModel = {
        id: 'test',
        name: 'Test',
        // missing other required fields
      };

      const result = validateSchema(incompleteModel, schemas.Model);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: description');
      expect(result.errors).toContain('Missing required field: provider');
    });
  });

  describe('Balance schema', () => {
    it('should validate a complete Balance object', () => {
      const balance: Balance = {
        credits: 10.50,
        totalDeposited: 50.00,
        totalSpent: 39.50,
        totalWithdrawn: 0.00,
        totalGenerated: 100,
      };

      const result = validateSchema(balance as unknown as Record<string, unknown>, schemas.Balance);
      expect(result.valid).toBe(true);
    });

    it('should reject wrong types', () => {
      const invalidBalance = {
        credits: '10.50', // should be number
        totalDeposited: 50.00,
        totalSpent: 39.50,
        totalWithdrawn: 0.00,
        totalGenerated: 100,
      };

      const result = validateSchema(invalidBalance, schemas.Balance);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("'credits'"))).toBe(true);
    });
  });

  describe('GenerateResponse schema', () => {
    it('should validate production mode response', () => {
      const response: GenerateResult = {
        id: 'gen_123',
        imageUrl: 'https://cdn.peerc.at/images/gen_123.png',
        ipfsHash: 'QmXyz123',
        model: 'stable-diffusion-xl',
        mode: 'production',
        usage: {
          creditsUsed: 0.28,
          balanceRemaining: 9.72,
        },
      };

      const result = validateSchema(response as unknown as Record<string, unknown>, schemas.GenerateResponse);
      expect(result.valid).toBe(true);
    });

    it('should validate demo mode response with null ipfsHash', () => {
      const response: GenerateResult = {
        id: 'demo_123',
        imageUrl: 'https://cdn.peerc.at/demo/placeholder.png',
        ipfsHash: null,
        model: 'stable-diffusion-xl',
        mode: 'demo',
        usage: {
          creditsUsed: 0,
          balanceRemaining: 10,
        },
      };

      const result = validateSchema(response as unknown as Record<string, unknown>, schemas.GenerateResponse);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid mode enum', () => {
      const response = {
        id: 'gen_123',
        imageUrl: 'https://cdn.peerc.at/images/gen_123.png',
        ipfsHash: null,
        model: 'stable-diffusion-xl',
        mode: 'invalid_mode', // Invalid enum value
        usage: {
          creditsUsed: 0,
          balanceRemaining: 10,
        },
      };

      const result = validateSchema(response, schemas.GenerateResponse);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('invalid enum value'))).toBe(true);
    });
  });

  describe('PriceResponse schema', () => {
    it('should validate complete PriceResponse with treasury', () => {
      const response: PriceResponse = {
        solPrice: 185.50,
        updatedAt: '2024-01-15T12:00:00Z',
        slippageTolerance: 0.05,
        treasury: '9JKi6Tr7JdsTJw1zNedF5vML9GpPnjHD9DWuZq1oE6nV',
        models: [
          {
            model: 'stable-diffusion-xl',
            priceUsd: 0.28,
            priceSol: 0.00151,
            priceSolWithSlippage: 0.00159,
          },
        ],
      };

      const result = validateSchema(response as unknown as Record<string, unknown>, schemas.PriceResponse);
      expect(result.valid).toBe(true);
    });

    it('should detect missing treasury field (OpenAPI compliance)', () => {
      const response = {
        solPrice: 185.50,
        updatedAt: '2024-01-15T12:00:00Z',
        slippageTolerance: 0.05,
        // treasury is missing - this would fail OpenAPI validation
        models: [],
      };

      const result = validateSchema(response, schemas.PriceResponse);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: treasury');
    });
  });

  describe('ModelPrice schema', () => {
    it('should validate ModelPrice', () => {
      const price: ModelPrice = {
        model: 'stable-diffusion-xl',
        priceUsd: 0.28,
        priceSol: 0.00151,
        priceSolWithSlippage: 0.00159,
      };

      const result = validateSchema(price as unknown as Record<string, unknown>, schemas.ModelPrice);
      expect(result.valid).toBe(true);
    });
  });

  describe('HistoryItem schema', () => {
    it('should validate completed history item', () => {
      const item: HistoryItem = {
        id: 'use_123',
        endpoint: '/v1/generate',
        model: 'stable-diffusion-xl',
        creditsUsed: 0.28,
        requestId: 'gen_123',
        status: 'completed',
        createdAt: '2024-01-15T10:00:00Z',
        completedAt: '2024-01-15T10:00:05Z',
      };

      const result = validateSchema(item as unknown as Record<string, unknown>, schemas.HistoryItem);
      expect(result.valid).toBe(true);
    });

    it('should validate pending history item with null optional fields', () => {
      const item: HistoryItem = {
        id: 'use_456',
        endpoint: '/v1/generate',
        model: null,
        creditsUsed: 0,
        requestId: null,
        status: 'pending',
        createdAt: '2024-01-15T10:00:00Z',
        completedAt: null,
      };

      const result = validateSchema(item as unknown as Record<string, unknown>, schemas.HistoryItem);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid status enum', () => {
      const item = {
        id: 'use_123',
        endpoint: '/v1/generate',
        model: null,
        creditsUsed: 0.28,
        requestId: null,
        status: 'cancelled', // Invalid enum value
        createdAt: '2024-01-15T10:00:00Z',
        completedAt: null,
      };

      const result = validateSchema(item, schemas.HistoryItem);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('invalid enum value'))).toBe(true);
    });
  });

  describe('ApiKey schema', () => {
    it('should validate complete ApiKey', () => {
      const key: ApiKey = {
        id: 'key_123',
        name: 'Production Key',
        keyPrefix: 'pcat_live_xx',
        environment: 'live',
        rateLimitTier: 'standard',
        createdAt: '2024-01-15T10:00:00Z',
        lastUsedAt: '2024-01-15T12:00:00Z',
        revoked: false,
      };

      const result = validateSchema(key as unknown as Record<string, unknown>, schemas.ApiKey);
      expect(result.valid).toBe(true);
    });

    it('should validate ApiKey with null optional fields', () => {
      const key: ApiKey = {
        id: 'key_123',
        name: null,
        keyPrefix: 'pcat_test_xx',
        environment: 'test',
        rateLimitTier: 'free',
        createdAt: '2024-01-15T10:00:00Z',
        lastUsedAt: null,
        revoked: false,
      };

      const result = validateSchema(key as unknown as Record<string, unknown>, schemas.ApiKey);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid environment enum', () => {
      const key = {
        id: 'key_123',
        name: null,
        keyPrefix: 'pcat_dev_xx',
        environment: 'development', // Invalid - only 'live' or 'test' allowed
        rateLimitTier: 'standard',
        createdAt: '2024-01-15T10:00:00Z',
        lastUsedAt: null,
        revoked: false,
      };

      const result = validateSchema(key, schemas.ApiKey);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('invalid enum value'))).toBe(true);
    });
  });

  describe('OnChainGenerationStatus schema', () => {
    it('should validate completed on-chain generation', () => {
      const status: OnChainGenerationStatus = {
        txSignature: 'txSig123abc',
        status: 'completed',
        model: 'stable-diffusion-xl',
        createdAt: '2024-01-15T10:00:00Z',
        imageUrl: 'https://cdn.peerc.at/images/gen_123.png',
        ipfsHash: 'QmXyz123',
        completedAt: '2024-01-15T10:00:10Z',
      };

      const result = validateSchema(status as unknown as Record<string, unknown>, schemas.OnChainGenerationStatus);
      expect(result.valid).toBe(true);
    });

    it('should validate pending on-chain generation', () => {
      const status: OnChainGenerationStatus = {
        txSignature: 'txSig456def',
        status: 'pending',
      };

      const result = validateSchema(status as unknown as Record<string, unknown>, schemas.OnChainGenerationStatus);
      expect(result.valid).toBe(true);
    });

    it('should validate all status enum values', () => {
      const statuses = ['pending', 'processing', 'completed', 'failed', 'refunded'];

      for (const s of statuses) {
        const status = { txSignature: 'tx123', status: s };
        const result = validateSchema(status, schemas.OnChainGenerationStatus);
        expect(result.valid).toBe(true);
      }
    });
  });
});

describe('Contract Tests - SDK Types Match OpenAPI', () => {
  it('GenerateResult has all fields from OpenAPI GenerateResponse', () => {
    // This compile-time check ensures the SDK type has all required fields
    const response: GenerateResult = {
      id: 'required',
      imageUrl: 'required',
      ipfsHash: null, // nullable
      model: 'required',
      mode: 'production',
      usage: {
        creditsUsed: 0,
        balanceRemaining: 0,
      },
    };

    // All fields must be assignable
    expect(response.id).toBeDefined();
    expect(response.imageUrl).toBeDefined();
    expect(response.model).toBeDefined();
    expect(response.mode).toBeDefined();
    expect(response.usage).toBeDefined();
    expect(response.usage.creditsUsed).toBeDefined();
    expect(response.usage.balanceRemaining).toBeDefined();
  });

  it('PriceResponse includes treasury field (OpenAPI compliance)', () => {
    // This test verifies our fix - treasury is now required
    const response: PriceResponse = {
      solPrice: 185.50,
      slippageTolerance: 0.05,
      updatedAt: '2024-01-15T12:00:00Z',
      treasury: 'required', // Must be present per OpenAPI spec
      models: [],
    };

    expect(response.treasury).toBeDefined();
  });

  it('Mode enum only allows production or demo', () => {
    const validModes: Array<'production' | 'demo'> = ['production', 'demo'];

    for (const mode of validModes) {
      const response: GenerateResult = {
        id: 'test',
        imageUrl: 'test',
        ipfsHash: null,
        model: 'test',
        mode,
        usage: { creditsUsed: 0, balanceRemaining: 0 },
      };
      expect(response.mode).toBe(mode);
    }
  });

  it('HistoryItem status enum matches OpenAPI', () => {
    const validStatuses: Array<'pending' | 'completed' | 'refunded'> = [
      'pending',
      'completed',
      'refunded',
    ];

    for (const status of validStatuses) {
      const item: HistoryItem = {
        id: 'test',
        endpoint: '/test',
        model: null,
        creditsUsed: 0,
        requestId: null,
        status,
        createdAt: '2024-01-15T10:00:00Z',
        completedAt: null,
      };
      expect(item.status).toBe(status);
    }
  });

  it('ApiKey environment enum matches OpenAPI', () => {
    const validEnvironments: Array<'live' | 'test'> = ['live', 'test'];

    for (const env of validEnvironments) {
      const key: ApiKey = {
        id: 'test',
        name: null,
        keyPrefix: 'test',
        environment: env,
        rateLimitTier: 'standard',
        createdAt: '2024-01-15T10:00:00Z',
        lastUsedAt: null,
        revoked: false,
      };
      expect(key.environment).toBe(env);
    }
  });

  it('OnChainGenerationStatus status enum matches OpenAPI', () => {
    const validStatuses: Array<'pending' | 'processing' | 'completed' | 'failed' | 'refunded'> = [
      'pending',
      'processing',
      'completed',
      'failed',
      'refunded',
    ];

    for (const status of validStatuses) {
      const s: OnChainGenerationStatus = {
        txSignature: 'test',
        status,
      };
      expect(s.status).toBe(status);
    }
  });
});
