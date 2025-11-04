/**
 * x402 Server Application
 * TypeScript implementation with x402 middleware using Gill template patterns
 */

import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { getServerContext } from '../lib/get-server-context.js';
import { createX402MiddlewareWithUtils } from '../lib/x402-middleware.js';
import { successResponse, errorResponse } from '../lib/api-response-helpers.js';
import {
  REQUEST_TIMEOUT,
  RETRY_ATTEMPTS,
  REQUEST_BODY_LIMIT,
  PAYMENT_AMOUNTS,
} from '../lib/constants.js';
import {
  generalRateLimit,
  slowDownMiddleware,
  gamingRateLimit
} from '../lib/rate-limiting.js';

// Initialize context
const context = getServerContext();
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

// Rate limiting middleware
app.use(slowDownMiddleware);
app.use(generalRateLimit);

app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  context.log.info(`${req.method} ${req.path}`);
  next();
});

// Create x402 utils instance
const x402Utils = createX402MiddlewareWithUtils(
  {},
  {
    facilitatorUrl: context.config.facilitatorUrl,
    timeout: REQUEST_TIMEOUT,
    retryAttempts: RETRY_ATTEMPTS,
  }
);

// ============================================================================
// ROUTES
// ============================================================================

// Root route
app.get('/', (_req, res) => {
  res.json({
    service: 'x402 Server',
    status: 'running',
    version: '1.0.0',
    revenueSplit: {
      tankBank: '40%',
      developer: '60%',
      description: 'Developers keep 60% of all payments, Tank Bank takes 40% service fee'
    },
    endpoints: {
      health: '/health',
      public: '/public',
      'premium-data': '/api/premium-data',
      'generate-content': '/api/generate-content',
      'download': '/api/download/:fileId',
      'tier-access': '/api/tier/:tier',
      stats: '/stats'
    },
    integration: {
      example: 'Set DEVELOPER_WALLET_ADDRESS environment variable to receive 60% of payments',
      currentDeveloperWallet: process.env.DEVELOPER_WALLET_ADDRESS || 'Not configured - payments go 100% to Tank Bank'
    }
  });
});

// Health check endpoint
app.get('/health', async (_req, res) => {
  try {
    const facilitatorHealth = await x402Utils.healthCheck();
    res.json(
      successResponse({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        facilitator: facilitatorHealth,
      })
    );
  } catch (error) {
    res
      .status(500)
      .json(errorResponse(error instanceof Error ? error.message : 'Unknown error', 'HEALTH_CHECK_FAILED', 500));
  }
});

// Public endpoint (no payment required)
app.get('/public', (_req, res) => {
  res.json(
    successResponse({
      message: 'This is a public endpoint - no payment required',
      timestamp: new Date().toISOString(),
    })
  );
});

// ============================================================================
// PROTECTED ENDPOINTS (x402 Payment Required)
// ============================================================================

// Premium data endpoint - 0.0001 SOL with split payment
// NOTE: In production, developers would set their own developerWallet address
const premiumRouteMw = createX402MiddlewareWithUtils(
  {
    amount: PAYMENT_AMOUNTS.PREMIUM_DATA,
    payTo: context.config.merchantSolanaAddress || context.config.facilitatorPublicKey || '',
    // Developers replace this with their own wallet address for 60% revenue share
    developerWallet: process.env.DEVELOPER_WALLET_ADDRESS || undefined,
    asset: 'SOL',
    network: context.config.solanaNetwork === 'devnet' ? 'base' : 'base',
    description: 'Premium data access - Developer gets 60%, Tank Bank gets 40%',
    mimeType: 'application/json',
    maxTimeoutSeconds: 300,
    outputSchema: {
      input: {
        type: 'http',
        method: 'GET'
      },
      output: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              secret: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
              payment: { type: 'object' }
            }
          }
        }
      }
    },
    extra: {
      category: 'premium-content',
      provider: 'Tank Bank x402',
      apiVersion: '1.0'
    }
  },
  {
    facilitatorUrl: context.config.facilitatorUrl,
    timeout: REQUEST_TIMEOUT,
    retryAttempts: RETRY_ATTEMPTS,
  }
);

app.get('/api/premium-data', gamingRateLimit, premiumRouteMw.middleware, (req, res) => {
  res.set({
    'x-payment-processed': 'true',
    'x-payment-method': 'solana-sol',
    'x-payment-network': context.config.solanaNetwork || 'mainnet-beta',
    'x-payment-transaction': req.payment?.transactionSignature,
  });

  res.json(
    successResponse({
      message: 'Premium data accessed successfully',
      data: {
        secret: 'This is premium content that requires payment',
        timestamp: new Date().toISOString(),
        payment: req.payment,
      },
    })
  );
});

// Generate content endpoint - 0.005 SOL
const generateContentMw = createX402MiddlewareWithUtils(
  {
    amount: PAYMENT_AMOUNTS.GENERATE_CONTENT,
    payTo: context.config.merchantSolanaAddress || context.config.facilitatorPublicKey || '',
    asset: 'SOL',
    network: 'base',
    description: 'AI-powered content generation service with custom prompts',
    mimeType: 'application/json',
    maxTimeoutSeconds: 600,
    outputSchema: {
      input: {
        type: 'http',
        method: 'POST',
        bodyType: 'json',
        bodyFields: {
          prompt: {
            type: 'string',
            required: true,
            description: 'The prompt for content generation'
          }
        }
      },
      output: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              prompt: { type: 'string' },
              generatedContent: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
              payment: { type: 'object' }
            }
          }
        }
      }
    },
    extra: {
      category: 'ai-content',
      provider: 'Tank Bank x402',
      apiVersion: '1.0'
    }
  },
  {
    facilitatorUrl: context.config.facilitatorUrl,
    timeout: REQUEST_TIMEOUT,
    retryAttempts: RETRY_ATTEMPTS,
  }
);

app.post('/api/generate-content', gamingRateLimit, generateContentMw.middleware, (req, res): void => {
  const { prompt } = req.body;

  if (!prompt) {
    res.status(400).json(errorResponse('Prompt is required', 'MISSING_PROMPT', 400));
    return;
  }

  res.json(
    successResponse({
      message: 'Content generated successfully',
      data: {
        prompt: prompt,
        generatedContent: `AI-generated content for: "${prompt}"`,
        timestamp: new Date().toISOString(),
        payment: req.payment,
      },
    })
  );
});

// File download endpoint - 0.02 SOL
const downloadMw = createX402MiddlewareWithUtils(
  {
    amount: PAYMENT_AMOUNTS.DOWNLOAD_FILE,
    payTo: context.config.merchantSolanaAddress || context.config.facilitatorPublicKey || '',
    asset: 'SOL',
    network: 'base',
    description: 'Secure file download with time-limited access tokens',
    mimeType: 'application/json',
    maxTimeoutSeconds: 300,
    outputSchema: {
      input: {
        type: 'http',
        method: 'GET',
        queryParams: {
          fileId: {
            type: 'string',
            required: true,
            description: 'Unique identifier for the file to download'
          }
        }
      },
      output: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              fileId: { type: 'string' },
              downloadUrl: { type: 'string' },
              expiresAt: { type: 'string', format: 'date-time' },
              payment: { type: 'object' }
            }
          }
        }
      }
    },
    extra: {
      category: 'file-access',
      provider: 'Tank Bank x402',
      apiVersion: '1.0'
    }
  },
  {
    facilitatorUrl: context.config.facilitatorUrl,
    timeout: REQUEST_TIMEOUT,
    retryAttempts: RETRY_ATTEMPTS,
  }
);

app.get('/api/download/:fileId', downloadMw.middleware, (req, res) => {
  const { fileId } = req.params;

  res.json(
    successResponse({
      message: 'File download authorized',
      data: {
        fileId: fileId,
        // TODO: Implement actual file download URL generation
        downloadUrl: `/files/${fileId}`,
        expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
        payment: req.payment,
      },
    })
  );
});

// Tier-based access endpoint - 0.05 SOL
const tierMw = createX402MiddlewareWithUtils(
  {
    amount: PAYMENT_AMOUNTS.TIER_ACCESS,
    payTo: context.config.merchantSolanaAddress || context.config.facilitatorPublicKey || '',
    asset: 'SOL',
    network: 'base',
    description: 'Premium tier access with enhanced features and capabilities',
    mimeType: 'application/json',
    maxTimeoutSeconds: 300,
    outputSchema: {
      input: {
        type: 'http',
        method: 'GET',
        queryParams: {
          tier: {
            type: 'string',
            required: true,
            enum: ['basic', 'premium', 'enterprise'],
            description: 'Access tier level'
          }
        }
      },
      output: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              tier: { type: 'string' },
              features: { type: 'array', items: { type: 'string' } },
              payment: { type: 'object' }
            }
          }
        }
      }
    },
    extra: {
      category: 'tier-access',
      provider: 'Tank Bank x402',
      apiVersion: '1.0'
    }
  },
  {
    facilitatorUrl: context.config.facilitatorUrl,
    timeout: REQUEST_TIMEOUT,
    retryAttempts: RETRY_ATTEMPTS,
  }
);

app.get('/api/tier/:tier', tierMw.middleware, (req, res) => {
  const { tier } = req.params;
  const payment = req.payment;

  res.json(
    successResponse({
      message: `Access granted to ${tier} tier`,
      data: {
        tier: tier,
        features: [`${tier} tier features enabled`],
        payment: payment,
      },
    })
  );
});

// Stats endpoint - public
app.get('/stats', async (_req, res) => {
  try {
    // Get facilitator stats
    const statsResponse = await fetch(`${context.config.facilitatorUrl}/stats`);
    const stats = await statsResponse.json();
    res.json(successResponse(stats));
  } catch (error) {
    res
      .status(500)
      .json(errorResponse(error instanceof Error ? error.message : 'Failed to get stats', 'STATS_ERROR', 500));
  }
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json(errorResponse('The requested resource was not found', 'NOT_FOUND', 404));
});

// ============================================================================
// START SERVER
// ============================================================================

async function start() {
  try {
    app.listen(context.config.port, () => {
      context.log.info(`Server App running on port ${context.config.port}`);
      context.log.info(`Facilitator URL: ${context.config.facilitatorUrl}`);
      context.log.info('');
      context.log.info('Available endpoints:');
      context.log.info('  GET  /health - Health check');
      context.log.info('  GET  /public - Public endpoint (no payment)');
      context.log.info('  GET  /api/premium-data - Premium data (payment required)');
      context.log.info('  POST /api/generate-content - Generate content (payment required)');
      context.log.info('  GET  /api/download/:fileId - Download file (payment required)');
      context.log.info('  GET  /api/tier/:tier - Tier-based access (payment required)');
      context.log.info('  GET  /stats - Payment statistics');
    });
  } catch (error) {
    context.log.error('Failed to start Server App:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown() {
  context.log.info('Shutting down Server App...');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the app
start();

export { app, context };
