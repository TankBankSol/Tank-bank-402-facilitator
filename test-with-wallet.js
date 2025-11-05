/**
 * Real Wallet Payment Test
 * Tests actual Solana transactions with your wallet
 */

import { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import 'dotenv/config';

// Configuration
const DEVELOPER_WALLET = 'HGnfuCrC4RrE3XkExgu4WT5S39teoqFvRuypLc7Jp46k';
const SERVER_URL = 'https://x402-server-ezhy.onrender.com';
const FACILITATOR_URL = 'https://x402-facilitator-hk8k.onrender.com';

// Solana connection
const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed');

async function testWalletSetup() {
  console.log('🔑 WALLET SETUP TEST');
  console.log('===================\n');

  if (!process.env.TEST_WALLET_PRIVATE_KEY) {
    console.log('❌ TEST_WALLET_PRIVATE_KEY not found in environment');
    console.log('   Add your wallet private key to .env file:');
    console.log('   TEST_WALLET_PRIVATE_KEY=your_base58_private_key_here\n');
    return null;
  }

  try {
    // Load wallet from private key
    const wallet = Keypair.fromSecretKey(bs58.decode(process.env.TEST_WALLET_PRIVATE_KEY));
    console.log(`✅ Wallet loaded: ${wallet.publicKey.toString()}`);

    // Check balance
    const balance = await connection.getBalance(wallet.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    console.log(`💰 Balance: ${balance} lamports (${solBalance.toFixed(6)} SOL)`);

    if (balance < 100000) {
      console.log('⚠️  Low balance - you may need more SOL for testing');
    }
    console.log();

    return wallet;
  } catch (error) {
    console.log(`❌ Wallet setup failed: ${error.message}`);
    return null;
  }
}

async function testPaymentRequest() {
  console.log('📝 PAYMENT REQUEST TEST');
  console.log('======================\n');

  try {
    const response = await fetch(`${SERVER_URL}/api/premium-data`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Developer-Wallet': DEVELOPER_WALLET
      }
    });

    if (response.status === 402) {
      const paymentData = await response.json();
      const payment = paymentData.accepts[0];

      console.log('✅ Payment request received:');
      console.log(`   Resource: ${payment.resource}`);
      console.log(`   Amount: ${payment.maxAmountRequired} lamports`);
      console.log(`   Description: ${payment.description}`);
      console.log(`   Network: ${payment.network}`);
      console.log(`   Asset: ${payment.asset}`);

      if (payment.splitPayment.enabled) {
        console.log('\n🔀 Split Payment Details:');
        payment.splitPayment.recipients.forEach((recipient, i) => {
          console.log(`   ${i + 1}. ${recipient.description}:`);
          console.log(`      Address: ${recipient.address}`);
          console.log(`      Amount: ${recipient.amount} lamports (${recipient.percentage}%)`);
        });
      }
      console.log();

      return payment;
    } else {
      console.log(`❌ Unexpected response: ${response.status}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ Payment request failed: ${error.message}`);
    return null;
  }
}

async function createTestTransaction(wallet, payment) {
  console.log('⚡ TRANSACTION CREATION TEST');
  console.log('===========================\n');

  try {
    const transaction = new Transaction();

    if (payment.splitPayment.enabled) {
      console.log('Creating split payment transaction...');

      // Add transfers for each recipient in split payment
      payment.splitPayment.recipients.forEach((recipient, i) => {
        console.log(`   Adding transfer ${i + 1}: ${recipient.amount} lamports → ${recipient.address}`);
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: new PublicKey(recipient.address),
            lamports: parseInt(recipient.amount)
          })
        );
      });
    } else {
      console.log('Creating single payment transaction...');
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: new PublicKey(payment.payTo),
          lamports: parseInt(payment.maxAmountRequired)
        })
      );
    }

    // Get recent blockhash and set fee payer
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;

    console.log('✅ Transaction created successfully');
    console.log(`   Instructions: ${transaction.instructions.length}`);
    console.log(`   Fee Payer: ${wallet.publicKey.toString()}`);
    console.log(`   Recent Blockhash: ${blockhash.slice(0, 8)}...`);
    console.log();

    return transaction;
  } catch (error) {
    console.log(`❌ Transaction creation failed: ${error.message}`);
    return null;
  }
}

async function simulateTransaction(transaction) {
  console.log('🧪 TRANSACTION SIMULATION');
  console.log('=========================\n');

  try {
    // Simulate transaction to check for errors
    const simulation = await connection.simulateTransaction(transaction);

    if (simulation.value.err) {
      console.log('❌ Transaction simulation failed:');
      console.log(`   Error: ${JSON.stringify(simulation.value.err)}`);
      return false;
    } else {
      console.log('✅ Transaction simulation successful');
      console.log(`   Compute units used: ${simulation.value.unitsConsumed}`);
      if (simulation.value.logs) {
        console.log('   Program logs:');
        simulation.value.logs.slice(0, 3).forEach(log => {
          console.log(`      ${log}`);
        });
      }
      console.log();
      return true;
    }
  } catch (error) {
    console.log(`❌ Simulation error: ${error.message}`);
    return false;
  }
}

async function testFacilitatorSettle(transaction, wallet) {
  console.log('🏛️ FACILITATOR SETTLEMENT TEST');
  console.log('=============================\n');

  try {
    // Sign the transaction
    transaction.sign(wallet);
    const signature = bs58.encode(transaction.signature);
    const serializedTx = bs58.encode(transaction.serialize());

    console.log('Transaction signed:');
    console.log(`   Signature: ${signature}`);
    console.log(`   Serialized length: ${serializedTx.length} chars`);
    console.log();

    // Submit to facilitator
    console.log('Submitting to facilitator...');
    const settleResponse = await fetch(`${FACILITATOR_URL}/settle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction: serializedTx,
        signature: signature,
        // Additional data that facilitator might need
        amount: transaction.instructions.reduce((sum, ix) => {
          // Sum up all transfer amounts
          if (ix.programId.equals(SystemProgram.programId)) {
            const data = ix.data;
            if (data.length >= 12) {
              // SystemProgram transfer instruction data format
              const amount = data.readBigUInt64LE(4);
              return sum + Number(amount);
            }
          }
          return sum;
        }, 0)
      })
    });

    console.log(`Facilitator response: ${settleResponse.status}`);

    if (settleResponse.ok) {
      const result = await settleResponse.json();
      console.log('✅ Settlement response:');
      console.log(JSON.stringify(result, null, 2));
      return { success: true, result, signature };
    } else {
      const error = await settleResponse.text();
      console.log('❌ Settlement failed:');
      console.log(`   Status: ${settleResponse.status}`);
      console.log(`   Error: ${error}`);
      return { success: false, error };
    }
  } catch (error) {
    console.log(`❌ Settlement error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testContentAccess(signature) {
  console.log('\n🎮 CONTENT ACCESS TEST');
  console.log('======================\n');

  try {
    // Try to access premium content with payment proof
    const contentResponse = await fetch(`${SERVER_URL}/api/premium-data`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Payment': JSON.stringify({
          signature: signature,
          timestamp: Date.now()
        })
      }
    });

    console.log(`Content access response: ${contentResponse.status}`);

    if (contentResponse.ok) {
      const content = await contentResponse.json();
      console.log('✅ Premium content unlocked!');
      console.log(JSON.stringify(content, null, 2));
      return true;
    } else {
      const error = await contentResponse.text();
      console.log('❌ Content access failed:');
      console.log(`   Error: ${error}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Content access error: ${error.message}`);
    return false;
  }
}

async function runCompleteTest() {
  console.log('🚀 COMPLETE PAYMENT SYSTEM TEST');
  console.log('================================\n');

  // Test wallet setup
  const wallet = await testWalletSetup();
  if (!wallet) return;

  // Test payment request
  const payment = await testPaymentRequest();
  if (!payment) return;

  // Create transaction
  const transaction = await createTestTransaction(wallet, payment);
  if (!transaction) return;

  // Simulate transaction
  const simulationSuccess = await simulateTransaction(transaction);
  if (!simulationSuccess) {
    console.log('⚠️  Skipping actual settlement due to simulation failure');
    return;
  }

  // Ask for confirmation before real transaction
  console.log('⚠️  READY TO SUBMIT REAL TRANSACTION');
  console.log('   This will spend actual SOL from your wallet');
  console.log('   Continue? (You can stop here and just test simulation)\n');

  // For automated testing, we'll stop here unless explicitly enabled
  if (!process.env.ENABLE_REAL_TRANSACTIONS) {
    console.log('✅ SIMULATION COMPLETE - All systems working!');
    console.log('   To test real transactions, set ENABLE_REAL_TRANSACTIONS=true in .env');
    return;
  }

  // Test facilitator settlement
  const settlement = await testFacilitatorSettle(transaction, wallet);
  if (!settlement.success) return;

  // Test content access
  await testContentAccess(settlement.signature);

  console.log('\n🎉 COMPLETE TEST FINISHED!');
}

// Run the test
runCompleteTest().catch(console.error);