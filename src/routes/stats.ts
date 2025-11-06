/**
 * Statistics routes
 * Directly consumes the stats module instead of calling its own endpoint
 */

import type { Request, Response } from 'express';
import type { NonceDatabase } from '../lib/nonce-database.js';

export interface StatsRouteContext {
  nonceDb: NonceDatabase;
}

/**
 * Get statistics endpoint
 * Directly consumes the nonce database stats instead of making HTTP call
 */
export function getStatsRoute(context: StatsRouteContext) {
  return async (_req: Request, res: Response) => {
    try {
      const stats = await context.nonceDb.getNonceStats();
      res.json({ data: stats });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };
}

/**
 * Cleanup expired nonces endpoint
 */
export function cleanupNoncesRoute(context: StatsRouteContext) {
  return async (_req: Request, res: Response) => {
    try {
      const cleaned = await context.nonceDb.cleanupExpiredNonces();
      res.json({ data: { cleaned } });
    } catch (error) {
      res
        .status(500)
        .json({ error: error instanceof Error ? error.message : 'Unknown error'});
    }
  };
}
