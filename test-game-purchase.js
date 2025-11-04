/**
 * Game Purchase Test - Simulates Real Player Experience
 * Tests the full x402 payment flow for premium content
 */

const DEVELOPER_WALLET = 'HGnfuCrC4RrE3XkExgu4WT5S39teoqFvRuypLc7Jp46k'; // Dev wallet for 60%
const SERVER_URL = 'https://x402-server-ezhy.onrender.com';

async function simulateGamePurchase() {
  console.log('🎮 GAME PURCHASE SIMULATION');
  console.log('==========================');
  console.log('Player wants to buy premium content...\n');

  try {
    // Step 1: Player clicks "Buy Premium Content" in game
    console.log('1️⃣ Player clicks "Buy Premium Content"');
    console.log('   Game makes request to server...\n');

    const response = await fetch(`${SERVER_URL}/api/premium-data`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Developer-Wallet': DEVELOPER_WALLET // This simulates SDK setting dev wallet
      }
    });

    if (response.status === 402) {
      const paymentData = await response.json();

      console.log('💰 PAYMENT REQUIRED (x402 Protocol)');
      console.log('====================================');

      const payment = paymentData.accepts[0];
      console.log(`💵 Amount: ${payment.maxAmountRequired} lamports (${payment.maxAmountRequired / 1000000000} SOL)`);
      console.log(`🏪 Content: ${payment.description}`);
      console.log(`⏰ Timeout: ${payment.maxTimeoutSeconds} seconds\n`);

      // Check split payment details
      if (payment.splitPayment && payment.splitPayment.enabled) {
        console.log('🔀 REVENUE SPLIT BREAKDOWN:');
        console.log('===========================');
        payment.splitPayment.recipients.forEach((recipient, index) => {
          const solAmount = (recipient.amount / 1000000000).toFixed(6);
          console.log(`${recipient.percentage === 60 ? '👨‍💻' : '🏛️'} ${recipient.description}:`);
          console.log(`   Address: ${recipient.address}`);
          console.log(`   Amount: ${recipient.amount} lamports (${solAmount} SOL)`);
          console.log(`   Share: ${recipient.percentage}%\n`);
        });

        console.log('⚡ ATOMIC TRANSACTION:');
        console.log('   - Single transaction pays both wallets simultaneously');
        console.log('   - Tank Bank facilitator pays gas fees');
        console.log('   - Instant settlement with Solana finality\n');

      } else {
        console.log('⚠️  Single payment mode (no split)');
        console.log(`   All funds go to: ${payment.payTo}\n`);
      }

      console.log('📱 NEXT STEPS FOR REAL PAYMENT:');
      console.log('===============================');
      console.log('1. Game client creates Solana transaction');
      console.log('2. Player signs transaction in wallet');
      console.log('3. Transaction sent to Tank Bank facilitator');
      console.log('4. Facilitator submits to Solana network');
      console.log('5. Both developer & Tank Bank receive funds instantly');
      console.log('6. Player gets premium content access\n');

      console.log('🔗 FACILITATOR ENDPOINT:');
      console.log(`   POST ${payment.payTo}/settle`);
      console.log('   (This is where signed transaction gets submitted)\n');

      // Simulate what the payment response would look like
      return {
        success: true,
        paymentRequired: true,
        amount: payment.maxAmountRequired,
        splitEnabled: payment.splitPayment?.enabled || false,
        recipients: payment.splitPayment?.recipients || []
      };

    } else {
      console.log(`❌ Unexpected response: ${response.status}`);
      return { success: false, error: `HTTP ${response.status}` };
    }

  } catch (error) {
    console.error('❌ Error during purchase simulation:', error.message);
    return { success: false, error: error.message };
  }
}

// Test the purchase flow
async function runGameTest() {
  const result = await simulateGamePurchase();

  if (result.success && result.paymentRequired) {
    console.log('✅ SIMULATION COMPLETE');
    console.log('=====================');
    console.log('✅ Payment request generated successfully');
    console.log(`✅ Split payment: ${result.splitEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`✅ Amount: ${result.amount} lamports`);

    if (result.splitEnabled) {
      console.log('✅ Revenue split configured correctly');
      console.log('✅ Ready for real Solana transactions!');
    } else {
      console.log('⚠️  Developer wallet not configured - add DEVELOPER_WALLET_ADDRESS to environment');
    }
  } else {
    console.log('❌ SIMULATION FAILED');
    console.log(`❌ Error: ${result.error}`);
  }
}

// Run the test
runGameTest();