# Tank Bank x402 Developer Integration Guide

## Revenue Sharing: 40% Tank Bank / 60% Developer

Tank Bank's x402 facilitator automatically splits payments:
- **Developer receives**: 60% of all payments
- **Tank Bank receives**: 40% service fee
- **Transaction type**: Single atomic transaction (both recipients paid simultaneously)

## Quick Integration

### 1. Install x402 Middleware
```bash
npm install @tankbank/x402-middleware
```

### 2. Basic Setup
```javascript
import { createX402MiddlewareWithUtils } from '@tankbank/x402-middleware';

const x402Middleware = createX402MiddlewareWithUtils({
  amount: '100000', // 0.0001 SOL in lamports
  developerWallet: 'YOUR_WALLET_ADDRESS_HERE', // You get 60% here
  asset: 'SOL',
  network: 'mainnet-beta',
  description: 'Premium game content'
}, {
  facilitatorUrl: 'https://facilitator.tankbank.app'
});

// Apply to protected routes
app.get('/api/premium-content', x402Middleware.middleware, (req, res) => {
  // Payment verified and settled - both wallets funded atomically
  res.json({
    success: true,
    data: 'Premium content here',
    payment: req.payment // Payment details
  });
});
```

### 3. Payment Amounts (Gaming Optimized)
```javascript
const PAYMENT_AMOUNTS = {
  GAME_ACTION: '50000',    // 0.00005 SOL (~$0.0125)
  PREMIUM_CONTENT: '100000', // 0.0001 SOL (~$0.025)
  SPECIAL_DOWNLOAD: '200000', // 0.0002 SOL (~$0.05)
  PREMIUM_TIER: '500000'   // 0.0005 SOL (~$0.125)
};
```

### 4. Environment Variables
```env
DEVELOPER_WALLET_ADDRESS=your_solana_wallet_address_here
FACILITATOR_URL=https://facilitator.tankbank.app
```

## Payment Flow

1. **Player** hits protected endpoint
2. **Server** returns 402 Payment Required with split payment details
3. **Client** creates atomic transaction with multiple recipients:
   - 60% → Developer wallet
   - 40% → Tank Bank wallet
4. **Facilitator** processes transaction (pays gas fees)
5. **Both wallets** receive funds simultaneously

## Example Game Integration

```javascript
// Pixel Defense Game Example
import { createX402MiddlewareWithUtils } from '@tankbank/x402-middleware';

// Power-up purchase endpoint
const powerUpMiddleware = createX402MiddlewareWithUtils({
  amount: '50000', // 0.00005 SOL
  developerWallet: process.env.DEVELOPER_WALLET_ADDRESS,
  description: 'Power-up purchase - 60% to developer, 40% to Tank Bank'
});

app.post('/api/buy-powerup', powerUpMiddleware.middleware, (req, res) => {
  // Payment complete - developer got 60%, Tank Bank got 40%
  const { powerupType } = req.body;

  res.json({
    success: true,
    powerup: powerupType,
    payment: {
      total: '50000',
      developerShare: '30000', // 60%
      tankBankFee: '20000'     // 40%
    }
  });
});
```

## Revenue Tracking

Track your earnings in real-time:
- **Your wallet balance**: Check Solana explorer
- **Transaction history**: All payments visible on-chain
- **Revenue analytics**: Built into Tank Bank dashboard (coming soon)

## Support

- **Documentation**: [Tank Bank Docs](https://docs.tankbank.app)
- **Discord**: [Tank Bank Community](https://discord.gg/tankbank)
- **Issues**: [GitHub Issues](https://github.com/TankBankSol/Tank-bank-402-facilitator/issues)

## Live Example

Test the split payment system:
```
GET https://api.tankbank.app/api/premium-data
```

Returns 402 with split payment details showing your 60/40 revenue share.