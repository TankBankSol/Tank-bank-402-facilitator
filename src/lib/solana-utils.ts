/**
 * Solana utilities using Gill SDK
 * Handles Solana operations, signatures, and transactions
 */

import { createSolanaRpc, createSolanaRpcSubscriptions, address } from 'gill';
import type { Address } from 'gill';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

export interface SolanaUtilsConfig {
  rpcEndpoint: string;
  rpcSubscriptionsEndpoint?: string;
}

export interface StructuredData {
  domain: {
    name: string;
    version: string;
    chainId: string;
    verifyingContract: string;
  };
  types: {
    [key: string]: Array<{ name: string; type: string }>;
  };
  primaryType: string;
  message: Record<string, unknown>;
}

export interface X402SOLPaymentTransactionParams {
  fromPublicKey: string;
  toPublicKey: string;
  amount: bigint;
  facilitatorAddress: Address;
  nonce: string;
  resourceId: string;
}

export class SolanaUtils {
  private rpc: ReturnType<typeof createSolanaRpc>;
  private rpcSubscriptions?: ReturnType<typeof createSolanaRpcSubscriptions>;
  private rpcUrl: string;

  constructor(config: SolanaUtilsConfig) {
    this.rpcUrl = config.rpcEndpoint;
    this.rpc = createSolanaRpc(config.rpcEndpoint);
    if (config.rpcSubscriptionsEndpoint) {
      this.rpcSubscriptions = createSolanaRpcSubscriptions(config.rpcSubscriptionsEndpoint);
    }
  }

  /**
   * Get SOL balance for a public key
   */
  async getSOLBalance(publicKey: string): Promise<bigint> {
    try {
      const addr = address(publicKey);
      const balance = await this.rpc.getBalance(addr).send();
      return balance.value;
    } catch (error) {
      console.error('Error getting SOL balance:', error);
      return BigInt(0);
    }
  }

  /**
   * Check if a public key is valid
   */
  isValidPublicKey(addr: string): boolean {
    try {
      address(addr);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Verify a signature against a message and public key
   */
  verifySignature(message: string, signature: string, publicKey: string): boolean {
    try {
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = bs58.decode(signature);
      const publicKeyBytes = bs58.decode(publicKey);

      return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Verify a structured data signature (EIP-712 equivalent for Solana)
   */
  verifyStructuredDataSignature(structuredData: StructuredData, signature: string, publicKey: string): boolean {
    try {
      // Convert structured data to string for verification
      const messageString = JSON.stringify(structuredData);
      return this.verifySignature(messageString, signature, publicKey);
    } catch (error) {
      console.error('Structured data signature verification error:', error);
      return false;
    }
  }

  /**
   * Sign a message with a keypair (for testing purposes)
   */
  signMessage(message: string, privateKeyBase58: string): string {
    try {
      const messageBytes = new TextEncoder().encode(message);
      const privateKeyBytes = bs58.decode(privateKeyBase58);

      const signature = nacl.sign.detached(messageBytes, privateKeyBytes);
      return bs58.encode(signature);
    } catch (error) {
      console.error('Message signing error:', error);
      throw new Error(
        `Failed to sign message: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Sign structured data (EIP-712 equivalent) for x402 authorization
   */
  signStructuredData(structuredData: StructuredData, privateKeyBase58: string): string {
    try {
      const messageString = JSON.stringify(structuredData);
      return this.signMessage(messageString, privateKeyBase58);
    } catch (error) {
      console.error('Structured data signing error:', error);
      throw new Error(
        `Failed to sign structured data: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Convert lamports to SOL
   */
  lamportsToSOL(lamports: bigint): number {
    return Number(lamports) / 1_000_000_000;
  }

  /**
   * Convert SOL to lamports
   */
  solToLamports(sol: number): bigint {
    return BigInt(Math.floor(sol * 1_000_000_000));
  }

  /**
   * Get recent blockhash
   */
  async getRecentBlockhash(): Promise<string> {
    const response = await this.rpc.getLatestBlockhash().send();
    return response.value.blockhash;
  }

  /**
   * Get RPC instance for direct access
   */
  getRpc() {
    return this.rpc;
  }

  /**
   * Get RPC subscriptions instance for direct access
   */
  getRpcSubscriptions() {
    return this.rpcSubscriptions;
  }

  /**
   * Create and submit split payment transaction (Tank Bank fee enforcement)
   * Creates USDC transfer transaction with multiple recipients and has client sign it.
   * @param facilitatorPrivateKey - Facilitator private key in base58 format
   * @param clientPublicKey - Client's public key
   * @param recipients - Array of payment recipients with amounts
   * @param usdcMintAddress - USDC token mint address
   * @returns Transaction signature
   */
  async createAndSubmitSplitPayment(
    facilitatorPrivateKey: string,
    clientPublicKey: string,
    recipients: Array<{address: string, amount: number}>,
    usdcMintAddress: string
  ): Promise<string> {
    try {
      // Import required Solana libraries
      const {
        Connection,
        Transaction,
        Keypair,
        PublicKey,
        SystemProgram,
        LAMPORTS_PER_SOL
      } = await import('@solana/web3.js');

      const {
        TOKEN_PROGRAM_ID,
        getAssociatedTokenAddress,
        createTransferInstruction
      } = await import('@solana/spl-token');

      const connection = new Connection(this.rpcUrl, 'confirmed');

      // Create facilitator keypair
      const secretKey = bs58.decode(facilitatorPrivateKey);
      const facilitatorKeypair = Keypair.fromSecretKey(secretKey);

      // Create transaction
      const transaction = new Transaction();

      const clientPubkey = new PublicKey(clientPublicKey);
      const usdcMint = new PublicKey(usdcMintAddress);

      // Get client's USDC token account
      const clientTokenAccount = await getAssociatedTokenAddress(usdcMint, clientPubkey);

      // Add transfer instructions for each recipient
      for (const recipient of recipients) {
        const recipientPubkey = new PublicKey(recipient.address);
        const recipientTokenAccount = await getAssociatedTokenAddress(usdcMint, recipientPubkey);

        // Create transfer instruction
        const transferInstruction = createTransferInstruction(
          clientTokenAccount,
          recipientTokenAccount,
          clientPubkey,
          recipient.amount,
          [],
          TOKEN_PROGRAM_ID
        );

        transaction.add(transferInstruction);
      }

      // Set fee payer and recent blockhash
      transaction.feePayer = facilitatorKeypair.publicKey;
      transaction.recentBlockhash = await this.getRecentBlockhash();

      // This would normally require client signature, but for now simulate
      // In real implementation, this transaction would be sent to client for signing
      throw new Error('Split payment transactions require client signature integration');

    } catch (error) {
      throw new Error(
        `Failed to create split payment: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Submit a sponsored transaction (TRUE x402 instant finality)
   * Client signs the transaction, facilitator adds signature as fee payer.
   * This achieves instant on-chain settlement with NO debt tracking.
   * @param facilitatorPrivateKey - Facilitator private key in base58 format
   * @param serializedTransaction - Base64-encoded transaction signed by client
   * @returns Transaction signature
   */
  async submitSponsoredTransaction(facilitatorPrivateKey: string, serializedTransaction: string): Promise<string> {
    try {
      // Import @solana/web3.js for transaction handling
      const { Connection, Transaction, Keypair } = await import('@solana/web3.js');

      const connection = new Connection(this.rpcUrl, 'confirmed');

      // Create Keypair from private key
      const secretKey = bs58.decode(facilitatorPrivateKey);
      const facilitatorKeypair = Keypair.fromSecretKey(secretKey);

      // Deserialize the transaction
      const transactionBuffer = Buffer.from(serializedTransaction, 'base64');
      const transaction = Transaction.from(transactionBuffer);

      // Add facilitator's signature (fee payer) to the already client-signed transaction
      transaction.partialSign(facilitatorKeypair);

      // Send the transaction (all signatures are already in place)
      const rawTransaction = transaction.serialize();
      const signature = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');

      return signature;
    } catch (error) {
      throw new Error(
        `Failed to submit sponsored transaction: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
