/**
 * PeerCat SDK Error Classes
 */

import type { ApiErrorResponse } from './types';

/**
 * Rate limit information from response headers
 */
export interface RateLimitInfo {
  /** Maximum requests allowed in the window */
  limit?: number;
  /** Remaining requests in the current window */
  remaining?: number;
  /** Unix timestamp when the rate limit resets */
  reset?: number;
  /** Seconds to wait before retrying (from Retry-After header) */
  retryAfter?: number;
}

/**
 * Parse rate limit headers from response
 */
export function parseRateLimitHeaders(headers: Headers): RateLimitInfo {
  const info: RateLimitInfo = {};

  const limit = headers.get('X-RateLimit-Limit');
  if (limit) info.limit = parseInt(limit, 10);

  const remaining = headers.get('X-RateLimit-Remaining');
  if (remaining) info.remaining = parseInt(remaining, 10);

  const reset = headers.get('X-RateLimit-Reset');
  if (reset) info.reset = parseInt(reset, 10);

  const retryAfter = headers.get('Retry-After');
  if (retryAfter) info.retryAfter = parseInt(retryAfter, 10);

  return info;
}

/**
 * Base error class for all PeerCat SDK errors
 */
export class PeerCatError extends Error {
  /** Error type from API */
  readonly type: string;
  /** Error code from API */
  readonly code: string;
  /** Parameter that caused the error */
  readonly param: string | null;
  /** HTTP status code */
  readonly status: number;

  constructor(
    message: string,
    type: string,
    code: string,
    param: string | null = null,
    status: number = 500
  ) {
    super(message);
    this.name = 'PeerCatError';
    this.type = type;
    this.code = code;
    this.param = param;
    this.status = status;

    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Create error from API response
   */
  static fromResponse(
    response: ApiErrorResponse,
    status: number,
    rateLimitInfo?: RateLimitInfo
  ): PeerCatError {
    const { type, code, message, param } = response.error;

    // Map to specific error classes based on type
    switch (type) {
      case 'authentication_error':
        return new AuthenticationError(message, code, param);
      case 'invalid_request_error':
        return new InvalidRequestError(message, code, param);
      case 'insufficient_credits':
        return new InsufficientCreditsError(message, code);
      case 'rate_limit_error':
        return new RateLimitError(message, code, rateLimitInfo);
      case 'not_found':
        return new NotFoundError(message, code, param);
      default:
        return new PeerCatError(message, type, code, param, status);
    }
  }
}

/**
 * Authentication error (invalid or missing API key)
 */
export class AuthenticationError extends PeerCatError {
  constructor(message: string, code: string, param: string | null = null) {
    super(message, 'authentication_error', code, param, 401);
    this.name = 'AuthenticationError';
  }
}

/**
 * Invalid request error (bad parameters)
 */
export class InvalidRequestError extends PeerCatError {
  constructor(message: string, code: string, param: string | null = null) {
    super(message, 'invalid_request_error', code, param, 400);
    this.name = 'InvalidRequestError';
  }
}

/**
 * Insufficient credits error
 */
export class InsufficientCreditsError extends PeerCatError {
  constructor(message: string, code: string) {
    super(message, 'insufficient_credits', code, null, 402);
    this.name = 'InsufficientCreditsError';
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends PeerCatError {
  /** Time to wait before retrying (seconds) */
  readonly retryAfter?: number;
  /** Full rate limit information */
  readonly rateLimitInfo?: RateLimitInfo;

  constructor(message: string, code: string, rateLimitInfo?: RateLimitInfo) {
    super(message, 'rate_limit_error', code, null, 429);
    this.name = 'RateLimitError';
    this.rateLimitInfo = rateLimitInfo;
    this.retryAfter = rateLimitInfo?.retryAfter;
  }
}

/**
 * Not found error
 */
export class NotFoundError extends PeerCatError {
  constructor(message: string, code: string, param: string | null = null) {
    super(message, 'not_found', code, param, 404);
    this.name = 'NotFoundError';
  }
}

/**
 * Network error (connection issues)
 */
export class NetworkError extends PeerCatError {
  constructor(message: string, cause?: Error) {
    super(message, 'network_error', 'connection_failed', null, 0);
    this.name = 'NetworkError';
    if (cause) {
      this.cause = cause;
    }
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends PeerCatError {
  constructor(message: string = 'Request timed out') {
    super(message, 'timeout_error', 'timeout', null, 0);
    this.name = 'TimeoutError';
  }
}
