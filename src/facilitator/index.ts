/**
 * x402 Solana Facilitator Application
 * TypeScript implementation using Gill SDK with Gill template patterns
 */

import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { getFacilitatorContext } from '../lib/get-facilitator-context.js';
import {
  healthCheckRoute,
  verifyPaymentRoute,
  settlePaymentRoute,
  getNonceRoute,
  getStatsRoute,
  cleanupNoncesRoute,
  storeNonceRoute,
} from '../routes/index.js';
import { REQUEST_BODY_LIMIT, CLEANUP_INTERVAL_MS } from '../lib/constants.js';
import {
  generalRateLimit,
  slowDownMiddleware,
  paymentRateLimit,
  settlementRateLimit,
  statsRateLimit,
  nonceRateLimit
  // createWalletRateLimit temporarily disabled for IPv6 compatibility
} from '../lib/rate-limiting.js';

// Initialize context
const context = await getFacilitatorContext();
const app: Express = express();

// Setup middleware
app.use(helmet());

// Trust proxy for rate limiting (required for Render)
app.set('trust proxy', 1);

app.use(cors({
  origin: [
    'https://tankbank.app',
    'https://api.tankbank.app',
    'https://facilitator.tankbank.app',
    // Allow localhost for development
    ...(process.env.NODE_ENV === 'development' ? [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8080'
    ] : [])
  ],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Payment']
}));

// Rate limiting and slow down middleware
app.use(slowDownMiddleware);
app.use(generalRateLimit);

app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  context.log.info(`${req.method} ${req.path}`);
  next();
});

// Setup routes
// Root route
app.get('/', (_req, res) => {
  res.json({
    service: 'x402 Facilitator',
    status: 'running',
    version: '1.0.1',
    endpoints: {
      health: '/health',
      verify: '/verify',
      settle: '/settle',
      nonce: '/nonce/:nonce',
      stats: '/stats',
      storeNonce: '/store-nonce'
    }
  });
});

app.get(
  '/health',
  healthCheckRoute({
    facilitatorAddress: context.facilitatorAddress,
    rpcEndpoint: context.config.solanaRpcUrl,
  })
);

app.post(
  '/verify',
  paymentRateLimit,
  // createWalletRateLimit(150, 60), // Temporarily disabled for IPv6 compatibility
  verifyPaymentRoute({
    solanaUtils: context.solanaUtils,
    nonceDb: context.nonceDb,
    facilitatorAddress: context.facilitatorAddress,
    maxPaymentAmount: context.config.maxPaymentAmount,
  })
);

app.post(
  '/settle',
  settlementRateLimit,
  // createWalletRateLimit(120, 60), // Temporarily disabled for IPv6 compatibility
  settlePaymentRoute({
    solanaUtils: context.solanaUtils,
    nonceDb: context.nonceDb,
    facilitatorAddress: context.facilitatorAddress,
    facilitatorKeypair: context.facilitatorKeypair,
    simulateTransactions: context.config.simulateTransactions,
    config: {
      facilitatorPrivateKey: context.config.facilitatorPrivateKey,
      solanaNetwork: context.config.solanaNetwork,
    },
  })
);

app.get(
  '/nonce/:nonce',
  nonceRateLimit,
  getNonceRoute({
    nonceDb: context.nonceDb,
  })
);

app.get(
  '/stats',
  statsRateLimit,
  getStatsRoute({
    nonceDb: context.nonceDb,
  })
);

app.post(
  '/store-nonce',
  paymentRateLimit,
  storeNonceRoute({
    nonceDb: context.nonceDb,
  })
);

app.post(
  '/cleanup',
  cleanupNoncesRoute({
    nonceDb: context.nonceDb,
  })
);

// Minimal x402 test endpoint for validation debugging
app.get('/minimal-test', (_req, res) => {
  // Return absolute minimal x402 response
  const minimalResponse = {
    x402Version: 1,
    error: 'Payment Required',
    accepts: [{
      scheme: 'exact',
      network: 'base',
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

// Initialize and start the application
async function start() {
  try {
    // Initialize database
    await context.nonceDb.initialize();

    // Start cleanup interval
    setInterval(
      async () => {
        try {
          await context.nonceDb.cleanupExpiredNonces();
        } catch (error) {
          context.log.error('Cleanup error:', error);
        }
      },
      CLEANUP_INTERVAL_MS
    );

    // Start server
    app.listen(context.config.port, () => {
      context.log.info(`Facilitator App running on port ${context.config.port}`);
      context.log.info(`Facilitator Public Key: ${context.facilitatorAddress.toString()}`);
      context.log.info(`Solana RPC: ${context.config.solanaRpcUrl}`);
      context.log.info(`Simulation Mode: ${context.config.simulateTransactions}`);
    });
  } catch (error) {
    context.log.error('Failed to start Facilitator App:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown() {
  context.log.info('Shutting down Facilitator App...');
  await context.nonceDb.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the app
start();

export { app, context };
