/**
 * Nonce management routes
 */

import type { Request, Response } from 'express';
import type { NonceDatabase } from '../lib/nonce-database.js';

export interface NonceRouteContext {
  nonceDb: NonceDatabase;
}

/**
 * Get nonce status endpoint
 */
export function getNonceRoute(context: NonceRouteContext) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const nonce = req.params.nonce;
      const details = await context.nonceDb.getNonceDetails(nonce);

      if (!details) {
        res.status(404).json({ error: 'Nonce not found'});
        return;
      }

      res.json({ data: details });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error'});
    }
  };
}
