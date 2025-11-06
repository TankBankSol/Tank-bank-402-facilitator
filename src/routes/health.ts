/**
 * Health check routes
 */

import type { Request, Response } from 'express';
import type { Address } from 'gill';

export interface HealthRouteContext {
  facilitatorAddress: Address;
  rpcEndpoint: string;
}

/**
 * Health check endpoint
 */
export function healthCheckRoute(context: HealthRouteContext) {
  return (_req: Request, res: Response) => {
    res.json({
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        facilitator: context.facilitatorAddress.toString(),
      }
    });
  };
}
