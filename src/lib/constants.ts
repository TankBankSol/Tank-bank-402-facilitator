/**
 * Application Constants
 * Configurable via environment variables with sensible defaults
 */

import 'dotenv/config';

/**
 * HTTP Request Configuration
 */
export const REQUEST_TIMEOUT = Number(process.env.REQUEST_TIMEOUT) || 30000; // 30 seconds
export const RETRY_ATTEMPTS = Number(process.env.RETRY_ATTEMPTS) || 3;
export const RETRY_DELAY = Number(process.env.RETRY_DELAY) || 1000; // 1 second
export const REQUEST_BODY_LIMIT = process.env.REQUEST_BODY_LIMIT || '10mb';

/**
 * Background Task Configuration
 */
export const CLEANUP_INTERVAL_HOURS = Number(process.env.CLEANUP_INTERVAL_HOURS) || 1;
export const CLEANUP_INTERVAL_MS = CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000;

/**
 * Solana Network Configuration
 */
export const SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'solana-devnet';
export const USDC_MINT_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const USDC_MINT_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
export const USDC_MINT = SOLANA_NETWORK === 'mainnet-beta' ? USDC_MINT_MAINNET : USDC_MINT_DEVNET;

/**
 * Payment Tier Amounts (in micro USDC - 6 decimals)
 * Example: 1000000 = 1 USDC
 * Using store pricing: customer pays store price + Tank Bank fee
 */
export const TANK_BANK_FEE_USDC = '12500'; // 0.0125 USDC Tank Bank fee
export const PAYMENT_AMOUNTS = {
  PREMIUM_DATA: '87500', // 0.0875 USDC product + 0.0125 fee = 0.10 USDC total
  GENERATE_CONTENT: '18750', // 0.01875 USDC (store gets 0.00625 + Tank Bank gets 0.0125)
  DOWNLOAD_FILE: '37500', // 0.0375 USDC (store gets 0.025 + Tank Bank gets 0.0125)
  TIER_ACCESS: '75000', // 0.075 USDC (store gets 0.0625 + Tank Bank gets 0.0125)
};
