/**
 * Payment settlement routes
 */

import type { Request, Response } from 'express';
import type { Address } from 'gill';
import { PaymentRequest } from '../lib/payment-request.js';
import { SolanaUtils } from '../lib/solana-utils.js';
import type { NonceDatabase } from '../lib/nonce-database.js';

export interface SettleRouteContext {
  solanaUtils: SolanaUtils;
  nonceDb: NonceDatabase;
  facilitatorAddress: Address;
  facilitatorKeypair: any; // Keypair from Gill
  simulateTransactions: boolean;
  config: {
    facilitatorPrivateKey: string;
    solanaNetwork?: string;
  };
}

/**
 * Settle a payment (Step 2 of x402 protocol)
 * 1. Performs the same checks as /verify
 * 2. Submits the Solana transaction to the RPC, using the client's signature
 * 3. Records the Nonce (or Signature) in the database
 * 4. Returns {"status": "settled"}
 */
export function settlePaymentRoute(context: SettleRouteContext) {
  return async (req: Request, res: Response) => {
    const { paymentRequest } = req.body;

    if (!paymentRequest) {
      return res.json({ status: 'error', error: 'Payment request is required' });
    }

    let paymentReq: PaymentRequest | null = null;
    try {
      // Deserialize payment request to get nonce and other details
      paymentReq = PaymentRequest.deserialize(paymentRequest);
      const { payload } = paymentReq;
      const nonce = payload.nonce;

      // Get nonce details for transaction (already stored by verify)
      const nonceDetails = await context.nonceDb.getNonceDetails(nonce);
      if (!nonceDetails) {
        return res.json({ status: 'error', error: 'Nonce not found - please verify payment first' });
      }

      // Check if nonce has already been settled (has transaction signature)
      if (nonceDetails.transactionSignature) {
        return res.json({ status: 'error', error: 'Payment already settled' });
      }

      // Check if nonce has expired
      if (Date.now() > nonceDetails.expiry) {
        return res.json({ status: 'error', error: 'Nonce has expired' });
      }

      // Check for split payment configuration
      if (nonceDetails.splitPaymentData?.enabled) {

        // Validate that the total amount matches expected split payment total
        const expectedTotal = Number(nonceDetails.splitPaymentData.totalAmount);
        const actualAmount = Number(nonceDetails.amount);
        if (actualAmount !== expectedTotal) {
          return res.json({
            status: 'error',
            error: `Amount mismatch. Expected: ${expectedTotal}, Received: ${nonceDetails.amount}`
          });
        }

        // Validate that Tank Bank fee is included and correct
        const tankBankRecipient = nonceDetails.splitPaymentData.recipients.find(
          (recipient: any) => recipient.description === 'Tank Bank processing fee'
        );

        if (!tankBankRecipient) {
          return res.json({
            status: 'error',
            error: 'Tank Bank processing fee is required'
          });
        }

        const expectedTankBankFee = parseInt(process.env.TANK_BANK_FEE_USDC || '12500');
        const actualTankBankFee = Number(tankBankRecipient.amount);
        if (actualTankBankFee !== expectedTankBankFee) {
          return res.json({
            status: 'error',
            error: `Invalid Tank Bank fee. Expected: ${expectedTankBankFee}, Received: ${tankBankRecipient.amount}`
          });
        }
      }

      // Payment setup validated and ready for settlement

      const requiredAmount = BigInt(nonceDetails.amount);

      if (!context.simulateTransactions) {
        // Check SOL balances - use clientPublicKey from PaymentRequest, not stored nonce
        const clientPublicKey = paymentReq.clientPublicKey;
        const clientBalance = await context.solanaUtils.getSOLBalance(clientPublicKey);

        // Balance validation

        if (clientBalance < requiredAmount) {
          return res.json({
            status: 'error',
            error: `Insufficient SOL balance. Required: ${requiredAmount}, Available: ${clientBalance}`,
          });
        }
      } else {
        // Simulation mode: Skipping balance checks
      }

      // Generate simulated or real transaction signature
      let transactionSignature: string;
      if (context.simulateTransactions) {
        transactionSignature = 'x402-demo-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
        // Simulated transaction created
      } else {
        // TRUE x402 ATOMIC SETTLEMENT (Sponsored Transaction)
        // Client must sign the transaction - their funds move instantly (instant finality)
        if (!paymentReq.signedTransaction) {
          throw new Error(
            'Missing signed transaction. TRUE x402 requires client to sign the transaction for instant finality.'
          );
        }

        // Processing sponsored transaction

        try {
          transactionSignature = await context.solanaUtils.submitSponsoredTransaction(
            context.config.facilitatorPrivateKey, // facilitator private key (fee payer)
            paymentReq.signedTransaction // client-signed transaction
          );
          // Settlement completed
        } catch (error) {
          throw new Error(
            `Failed to submit sponsored transaction: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      // Verify the transfer worked by checking balances
      if (!context.simulateTransactions) {
        await context.solanaUtils.getSOLBalance(nonceDetails.recipient);
        // Transfer verification completed
      }

      // 3. Record the Transaction Signature in the database
      await context.nonceDb.updateTransactionSignature(nonce, transactionSignature);

      // Store transaction record
      await context.nonceDb.storeTransaction({
        nonce: nonce,
        transactionSignature: transactionSignature,
        status: 'confirmed',
      });

      // 4. Return {"status": "settled"}
      return res.json({ status: 'settled', transactionSignature: transactionSignature });
    } catch (error) {

      // Store failed transaction
      if (paymentReq && paymentReq.payload) {
        await context.nonceDb.storeTransaction({
          nonce: paymentReq.payload.nonce,
          transactionSignature: null,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      return res.json({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}
