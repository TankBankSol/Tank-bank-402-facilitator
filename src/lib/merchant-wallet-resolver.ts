/**
 * Merchant Wallet Resolver Middleware
 * Dynamically resolves merchant wallet addresses from headers or environment
 */

import type { Request, Response, NextFunction } from 'express';
import { createX402MiddlewareWithUtils } from './x402-middleware.js';

export interface MerchantWalletInfo {
  address: string;
  source: 'header' | 'environment' | 'default';
  fallbackUsed: boolean;
}

// Extend Express Request to include merchant wallet info
declare global {
  namespace Express {
    interface Request {
      merchantWallet?: MerchantWalletInfo;
    }
  }
}

/**
 * Resolves merchant wallet address from multiple sources
 * Priority: X-Developer-Wallet header > MERCHANT_SOLANA_ADDRESS env > facilitator key
 */
export function resolveMerchantWallet(
  req: Request,
  fallbackAddress?: string
): MerchantWalletInfo {
  // Check for header first (highest priority)
  const headerWallet = req.headers['x-developer-wallet'] as string;
  if (headerWallet && headerWallet.trim()) {
    return {
      address: headerWallet.trim(),
      source: 'header',
      fallbackUsed: false
    };
  }

  // Check environment variable (medium priority)
  const envWallet = process.env.MERCHANT_SOLANA_ADDRESS;
  if (envWallet && envWallet.trim()) {
    return {
      address: envWallet.trim(),
      source: 'environment',
      fallbackUsed: false
    };
  }

  // Use fallback address (lowest priority)
  const defaultAddress = fallbackAddress || process.env.FACILITATOR_PUBLIC_KEY || 'MERCHANT_WALLET_NOT_CONFIGURED';
  return {
    address: defaultAddress,
    source: 'default',
    fallbackUsed: true
  };
}

/**
 * Express middleware to resolve and attach merchant wallet info to request
 */
export function merchantWalletMiddleware(fallbackAddress?: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    req.merchantWallet = resolveMerchantWallet(req, fallbackAddress);

    // Log wallet resolution for debugging (remove in production)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Merchant Wallet] ${req.method} ${req.path} - ${req.merchantWallet.source}: ${req.merchantWallet.address.substring(0, 8)}...`);
    }

    next();
  };
}

/**
 * Enhanced x402 middleware factory that uses dynamic merchant wallet resolution
 */
export function createDynamicX402Middleware(config: {
  amount?: string;
  asset?: string;
  network?: string;
  description?: string;
  mimeType?: string;
  maxTimeoutSeconds?: number;
  outputSchema?: any;
  extra?: Record<string, any>;
  facilitatorUrl?: string;
  timeout?: number;
  retryAttempts?: number;
}, fallbackAddress?: string) {

  // Use the imported middleware function

  return (req: Request, res: Response, next: NextFunction): void => {
    // Resolve merchant wallet dynamically
    const walletInfo = resolveMerchantWallet(req, fallbackAddress);

    // Create middleware with resolved wallet address
    const dynamicConfig = {
      ...config,
      payTo: walletInfo.address,
      developerWallet: walletInfo.source === 'header' ? walletInfo.address : undefined
    };

    const middlewareOptions = {
      facilitatorUrl: config.facilitatorUrl,
      timeout: config.timeout,
      retryAttempts: config.retryAttempts
    };

    // Create and execute the x402 middleware
    const x402Middleware = createX402MiddlewareWithUtils(dynamicConfig, middlewareOptions);
    x402Middleware.middleware(req, res, next);
  };
}

/**
 * Utility function to get merchant wallet address from request
 */
export function getMerchantWallet(req: Request, fallbackAddress?: string): string {
  if (req.merchantWallet) {
    return req.merchantWallet.address;
  }
  return resolveMerchantWallet(req, fallbackAddress).address;
}

export default {
  resolveMerchantWallet,
  merchantWalletMiddleware,
  createDynamicX402Middleware,
  getMerchantWallet
};