/**
 * PeerCat SDK Types
 */

// ============ Configuration ============

export interface PeerCatConfig {
  /** API key for authentication */
  apiKey: string;
  /** Base URL for the API (default: https://api.peerc.at) */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 60000) */
  timeout?: number;
  /** Number of retry attempts for failed requests (default: 3) */
  maxRetries?: number;
  /** Custom fetch implementation (for Node.js < 18) */
  fetch?: typeof fetch;
}

// ============ Models ============

export type ModelId =
  | 'stable-diffusion-xl'
  | 'stable-diffusion-3'
  | 'stable-diffusion-2'
  | 'imagen-4.0-ultra-generate-001'
  | 'imagen-4.0-generate-001'
  | (string & {});

export interface Model {
  /** Model identifier */
  id: ModelId;
  /** Human-readable name */
  name: string;
  /** Model description */
  description: string;
  /** Model provider */
  provider: string;
  /** Maximum prompt length in characters */
  maxPromptLength: number;
  /** Output image format */
  outputFormat: string;
  /** Output resolution */
  outputResolution: string;
  /** Price in USD */
  priceUsd: number;
}

export interface ModelsResponse {
  models: Model[];
}

// ============ Pricing ============

export interface ModelPrice {
  /** Model identifier */
  model: ModelId;
  /** Price in USD */
  priceUsd: number;
  /** Price in SOL */
  priceSol: number;
  /** Price in SOL including slippage tolerance */
  priceSolWithSlippage: number;
}

export interface PriceResponse {
  /** Current SOL/USD price */
  solPrice: number;
  /** Slippage tolerance (e.g., 0.02 = 2%) */
  slippageTolerance: number;
  /** Timestamp of price update */
  updatedAt: string;
  /** Treasury PDA address to send payments to */
  treasury: string;
  /** Prices for each model */
  models: ModelPrice[];
}

// ============ Generation ============

export interface GenerateParams {
  /** Text prompt for image generation (max 2000 characters) */
  prompt: string;
  /** Model to use (default: stable-diffusion-xl) */
  model?: ModelId;
  /** Mode: 'production' (default) or 'demo' (free, placeholder images) */
  mode?: 'production' | 'demo';
  /** Additional model-specific options */
  options?: Record<string, unknown>;
}

export interface GenerateResult {
  /** Unique generation ID */
  id: string;
  /** URL to the generated image */
  imageUrl: string;
  /** IPFS hash (if uploaded) */
  ipfsHash: string | null;
  /** Model used */
  model: ModelId;
  /** Mode used */
  mode: 'production' | 'demo';
  /** Usage information */
  usage: {
    /** Credits used for this generation */
    creditsUsed: number;
    /** Remaining credit balance */
    balanceRemaining: number;
  };
}

// ============ Balance ============

export interface Balance {
  /** Current credit balance in USD */
  credits: number;
  /** Total amount deposited */
  totalDeposited: number;
  /** Total amount spent */
  totalSpent: number;
  /** Total amount withdrawn */
  totalWithdrawn: number;
  /** Total number of generations */
  totalGenerated: number;
}

// ============ History ============

export interface HistoryParams {
  /** Number of items to return (default: 50, max: 100) */
  limit?: number;
  /** Pagination offset */
  offset?: number;
}

export interface HistoryItem {
  /** Usage record ID */
  id: string;
  /** API endpoint called */
  endpoint: string;
  /** Model used */
  model: string | null;
  /** Credits used */
  creditsUsed: number;
  /** Request ID (for generation requests) */
  requestId: string | null;
  /** Status: pending, completed, refunded */
  status: 'pending' | 'completed' | 'refunded';
  /** Creation timestamp */
  createdAt: string;
  /** Completion timestamp */
  completedAt: string | null;
}

export interface HistoryResponse {
  /** Usage history items */
  items: HistoryItem[];
  /** Pagination info */
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// ============ API Keys ============

export interface CreateKeyParams {
  /** Optional name for the key */
  name?: string;
  /** Message to sign */
  message: string;
  /** Wallet signature (base58) */
  signature: string;
  /** Wallet public key (base58) */
  publicKey: string;
}

export interface ApiKey {
  /** Key ID */
  id: string;
  /** Key name */
  name: string | null;
  /** Key prefix (for display) */
  keyPrefix: string;
  /** Environment: live or test */
  environment: 'live' | 'test';
  /** Rate limit tier */
  rateLimitTier: string;
  /** Creation timestamp */
  createdAt: string;
  /** Last used timestamp */
  lastUsedAt: string | null;
  /** Whether the key has been revoked */
  revoked: boolean;
}

export interface CreateKeyResult {
  /** Key ID */
  id: string;
  /** Full API key (only shown once!) */
  key: string;
  /** Key prefix */
  keyPrefix: string;
  /** Key name */
  name: string | null;
  /** Environment */
  environment: 'live' | 'test';
  /** Creation timestamp */
  createdAt: string;
  /** Warning message */
  warning: string;
}

export interface KeysResponse {
  keys: ApiKey[];
}

// ============ On-Chain Payments ============

export interface SubmitPromptParams {
  /** Text prompt for image generation */
  prompt: string;
  /** Model to use */
  model?: ModelId;
  /** Additional options */
  options?: Record<string, unknown>;
  /** Callback URL for result notification */
  callbackUrl?: string;
}

export interface PromptSubmission {
  /** Submission ID */
  submissionId: string;
  /** Prompt hash (for memo) */
  promptHash: string;
  /** Treasury address to send payment */
  paymentAddress: string;
  /** Required payment amount */
  requiredAmount: {
    sol: number;
    lamports: number;
    usd: number;
  };
  /** Memo to include in transaction */
  memo: string;
  /** Model to use */
  model: ModelId;
  /** Slippage tolerance */
  slippageTolerance: number;
  /** Expiration timestamp */
  expiresAt: string;
  /** Payment instructions */
  instructions: Record<string, string>;
}

export interface OnChainGenerationStatus {
  /** Transaction signature */
  txSignature: string;
  /** Status: pending, processing, completed, failed, refunded */
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  /** Model used */
  model?: ModelId;
  /** Creation timestamp */
  createdAt?: string;
  /** Image URL (when completed) */
  imageUrl?: string;
  /** IPFS hash (when completed) */
  ipfsHash?: string;
  /** Completion timestamp */
  completedAt?: string;
  /** Error message (when failed) */
  error?: string;
  /** Status message */
  message?: string;
}

// ============ Errors ============

export interface ApiErrorResponse {
  error: {
    type: string;
    code: string;
    message: string;
    param: string | null;
  };
}
