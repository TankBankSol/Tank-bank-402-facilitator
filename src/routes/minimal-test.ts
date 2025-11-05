/**
 * Minimal x402 Test Endpoint
 * Returns the most basic valid x402 response possible
 */

import { Router } from 'express';

const router = Router();

router.get('/minimal-test', (req, res) => {
  // Return absolute minimal x402 response
  const minimalResponse = {
    x402Version: 1,
    error: 'Payment Required',
    accepts: [{
      scheme: 'exact' as const,
      network: 'base' as const,
      maxAmountRequired: '1000000',
      resource: '/minimal-test',
      description: 'Minimal test payment',
      mimeType: 'application/json',
      payTo: 'BjbMd9zdg1k9ziSjkWMSq3cZwQVTMZxuC7uFPtBGrMKE',
      maxTimeoutSeconds: 300,
      asset: 'SOL'
    }]
  };

  res.status(402).json(minimalResponse);
});

export { router as minimalTestRouter };