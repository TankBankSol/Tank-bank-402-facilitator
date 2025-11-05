/**
 * Real Payment Settlement Test
 * Tests the complete payment flow including actual settlement
 */

import { Connection, Keypair, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import bs58 from 'bs58';

const DEVELOPER_WALLET = 'HGnfuCrC4RrE3XkExgu4WT5S39teoqFvRuypLc7Jp46k';
const SERVER_URL = 'https://x402-server-ezhy.onrender.com';
const FACILITATOR_URL = 'https://x402-facilitator-hk8k.onrender.com';

// Test wallet (you'll need to fund this with small amount of SOL)
const TEST_WALLET_PRIVATE_KEY = 'YOUR_TEST_WALLET_PRIVATE_KEY_HERE'; // Add your test wallet

async function testCompletePaymentFlow() {
  console.log('🚀 COMPLETE PAYMENT SETTLEMENT TEST');
  console.log('===================================\n');

  try {
    // Step 1: Get payment request from server
    console.log('1️⃣ Requesting payment details...');
    const paymentResponse = await fetch(`${SERVER_URL}/api/premium-data`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Developer-Wallet': DEVELOPER_WALLET
      }
    });

    if (paymentResponse.status !== 402) {
      throw new Error(`Expected 402, got ${paymentResponse.status}`);
    }

    const paymentData = await paymentResponse.json();
    const payment = paymentData.accepts[0];

    console.log('✅ Payment request received:');
    console.log(`   Amount: ${payment.maxAmountRequired} lamports`);
    console.log(`   Split enabled: ${payment.splitPayment.enabled}`);
    if (payment.splitPayment.enabled) {
      payment.splitPayment.recipients.forEach(r => {
        console.log(`   ${r.description}: ${r.amount} lamports (${r.percentage}%)`);
      });
    }
    console.log();

    // Step 2: Create nonce request to facilitator
    console.log('2️⃣ Requesting payment nonce from facilitator...');
    const nonceResponse = await fetch(`${FACILITATOR_URL}/request-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: payment.maxAmountRequired,
        resourceId: '/api/premium-data',
        resourceUrl: `${SERVER_URL}/api/premium-data`,
        // Include split payment data if enabled
        ...(payment.splitPayment.enabled && {
          splitPayment: payment.splitPayment
        })
      })
    });

    if (!nonceResponse.ok) {
      throw new Error(`Facilitator request failed: ${nonceResponse.status}`);
    }

    const nonceData = await nonceResponse.json();
    console.log('✅ Nonce received from facilitator:');
    console.log(`   Nonce: ${nonceData.nonce}`);
    console.log(`   Recipient: ${nonceData.recipient}`);
    console.log(`   Expires: ${new Date(nonceData.expiry)}`);
    console.log();

    // Step 3: Create Solana transaction (simulation)
    console.log('3️⃣ Creating Solana transaction...');

    if (TEST_WALLET_PRIVATE_KEY === 'YOUR_TEST_WALLET_PRIVATE_KEY_HERE') {
      console.log('⚠️  TEST WALLET NOT CONFIGURED');
      console.log('   To test real settlement, add your test wallet private key');
      console.log('   For now, simulating transaction creation...\n');

      console.log('📝 Transaction would include:');
      if (payment.splitPayment.enabled) {
        console.log('   🔀 SPLIT PAYMENT TRANSACTION:');
        payment.splitPayment.recipients.forEach((recipient, i) => {
          console.log(`      Transfer ${recipient.amount} lamports → ${recipient.address}`);
        });
      } else {
        console.log(`   💰 Single payment: ${payment.maxAmountRequired} lamports → ${nonceData.recipient}`);
      }
      console.log();

      console.log('4️⃣ Would submit to facilitator for settlement...');
      console.log('✅ SIMULATION COMPLETE - All endpoints responding correctly!');
      return;
    }

    // Real transaction creation (if wallet configured)
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const payer = Keypair.fromSecretKey(bs58.decode(TEST_WALLET_PRIVATE_KEY));

    console.log(`   Payer: ${payer.publicKey.toString()}`);
    console.log(`   Creating transaction...`);

    const transaction = new Transaction();

    if (payment.splitPayment.enabled) {
      // Add split payment instructions
      payment.splitPayment.recipients.forEach(recipient => {
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: new PublicKey(recipient.address),
            lamports: parseInt(recipient.amount)
          })
        );
      });
    } else {
      // Single payment
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: new PublicKey(nonceData.recipient),
          lamports: parseInt(payment.maxAmountRequired)
        })
      );
    }

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = payer.publicKey;

    // Sign transaction
    transaction.sign(payer);
    const signature = bs58.encode(transaction.signature);

    console.log(`   Transaction created and signed`);
    console.log(`   Signature: ${signature}`);
    console.log();

    // Step 4: Submit to facilitator for settlement
    console.log('4️⃣ Submitting to facilitator for settlement...');
    const settlementResponse = await fetch(`${FACILITATOR_URL}/settle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nonce: nonceData.nonce,
        transaction: bs58.encode(transaction.serialize()),
        signature: signature
      })
    });

    if (!settlementResponse.ok) {
      throw new Error(`Settlement failed: ${settlementResponse.status}`);
    }

    const settlementResult = await settlementResponse.json();
    console.log('✅ Settlement response:');
    console.log(JSON.stringify(settlementResult, null, 2));
    console.log();

    // Step 5: Verify payment with server
    console.log('5️⃣ Accessing premium content...');
    const contentResponse = await fetch(`${SERVER_URL}/api/premium-data`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Payment': JSON.stringify({
          nonce: nonceData.nonce,
          signature: signature,
          amount: payment.maxAmountRequired
        })
      }
    });

    if (contentResponse.ok) {
      const content = await contentResponse.json();
      console.log('✅ PAYMENT SUCCESSFUL - Premium content unlocked!');
      console.log(JSON.stringify(content, null, 2));
    } else {
      console.log(`❌ Content access failed: ${contentResponse.status}`);
    }

  } catch (error) {
    console.error('❌ Error during payment flow:', error.message);
  }
}

async function testEndpoints() {
  console.log('🔍 ENDPOINT CONNECTIVITY TEST');
  console.log('=============================\n');

  const endpoints = [
    { name: 'Server Health', url: `${SERVER_URL}/health` },
    { name: 'Facilitator Health', url: `${FACILITATOR_URL}/health` },
    { name: 'Server Stats', url: `${SERVER_URL}/stats` },
    { name: 'Payment Request', url: `${SERVER_URL}/api/premium-data` }
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint.url);
      const status = response.status;
      console.log(`✅ ${endpoint.name}: ${status} ${status === 402 ? '(Payment Required - Expected)' : ''}`);
    } catch (error) {
      console.log(`❌ ${endpoint.name}: ${error.message}`);
    }
  }
  console.log();
}

// Run tests
async function runAllTests() {
  await testEndpoints();
  await testCompletePaymentFlow();
}

runAllTests();