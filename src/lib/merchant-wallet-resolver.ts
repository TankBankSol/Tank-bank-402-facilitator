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
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      merchantWallet?: MerchantWalletInfo;
    }
  }
}

/**
 * Resolves merchant wallet address from multiple sources
 * Requires X-Developer-Wallet header - no fallbacks
 */
export function resolveMerchantWallet(
  req: Request,
  _fallbackAddress?: string
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

  // No fallbacks - header is required
  throw new Error('X-Developer-Wallet header is required. Merchants must specify their wallet address in the request header.');
}

/**
 * Express middleware to resolve and attach merchant wallet info to request
 */
export function merchantWalletMiddleware(fallbackAddress?: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.merchantWallet = resolveMerchantWallet(req, fallbackAddress);
    } catch (error) {
      res.status(400).json({
        error: 'X-Developer-Wallet header required',
        message: 'Merchants must provide their wallet address in the X-Developer-Wallet header',
        required: {
          header: 'X-Developer-Wallet',
          value: 'your_solana_wallet_address'
        }
      });
      return;
    }

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
    let walletInfo;
    try {
      walletInfo = resolveMerchantWallet(req, fallbackAddress);
    } catch (error) {
      res.status(400).json({
        error: 'X-Developer-Wallet header required',
        message: 'Merchants must provide their wallet address in the X-Developer-Wallet header',
        required: {
          header: 'X-Developer-Wallet',
          value: 'your_solana_wallet_address'
        }
      });
      return;
    }

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