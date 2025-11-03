/**
 * Pixel Defense Game Integration
 * Specific implementation for Pixel Defense browser game with x402 payment
 */

import TankBankGamingSDK, { GameConfig, WalletProvider } from './gaming-sdk.js';

export interface PixelDefenseConfig {
  gameUrl: string;
  costToPlay: number; // in lamports (e.g., 0.01 SOL = 10000000 lamports)
  facilitatorUrl: string;
  merchantAddress: string;
  network: 'mainnet-beta' | 'testnet' | 'devnet';
  rpcUrl: string;
}

export class PixelDefenseIntegration {
  private sdk: TankBankGamingSDK;
  private config: PixelDefenseConfig;

  constructor(config: PixelDefenseConfig) {
    this.config = config;

    const gameConfig: GameConfig = {
      gameId: 'pixel-defense',
      gameName: 'Pixel Defense',
      costToPlay: config.costToPlay,
      network: config.network,
      facilitatorUrl: config.facilitatorUrl,
      merchantAddress: config.merchantAddress,
      rpcUrl: config.rpcUrl
    };

    this.sdk = new TankBankGamingSDK(gameConfig);

    // Set up custom confirmation modal for Pixel Defense
    this.sdk.setConfirmationModal(this.createPixelDefenseModal());
  }

  /**
   * Set wallet provider (Phantom, Solflare, etc.)
   */
  setWallet(wallet: WalletProvider): void {
    this.sdk.setWallet(wallet);
  }

  /**
   * Start Pixel Defense game with payment confirmation
   */
  async startGame(containerElement: HTMLElement): Promise<void> {
    try {
      // Show loading state
      this.showLoadingState(containerElement);

      // Start game session with payment
      const session = await this.sdk.startGame();
      console.log('Game session started:', session);

      // Load the game
      await this.sdk.loadGame(containerElement, this.config.gameUrl);

      // Add game-specific UI enhancements
      this.addPixelDefenseUI(containerElement);

    } catch (error) {
      this.showErrorState(containerElement, error as Error);
      throw error;
    }
  }

  /**
   * Check if player can play (has sufficient balance)
   */
  async canPlay(): Promise<{ canPlay: boolean; reason?: string }> {
    try {
      const balanceCheck = await this.sdk.checkBalance();

      if (!balanceCheck.hasBalance) {
        const solRequired = (this.config.costToPlay / 1e9).toFixed(4);
        const solCurrent = (balanceCheck.currentBalance / 1e9).toFixed(4);

        return {
          canPlay: false,
          reason: `Insufficient balance. Required: ${solRequired} SOL, Current: ${solCurrent} SOL`
        };
      }

      return { canPlay: true };
    } catch (error) {
      return {
        canPlay: false,
        reason: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * End current game session
   */
  async endGame(): Promise<void> {
    await this.sdk.endGame();
  }

  /**
   * Get current game session info
   */
  getCurrentSession() {
    return this.sdk.getCurrentSession();
  }

  /**
   * Create Pixel Defense themed confirmation modal
   */
  private createPixelDefenseModal() {
    return {
      async show(gameConfig: any, paymentAmount: number): Promise<boolean> {
        return new Promise((resolve) => {
          const modal = document.createElement('div');
          modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            font-family: 'Courier New', monospace;
          `;

          const content = document.createElement('div');
          content.style.cssText = `
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border: 2px solid #00ff00;
            padding: 40px;
            border-radius: 15px;
            max-width: 500px;
            text-align: center;
            box-shadow: 0 0 30px rgba(0, 255, 0, 0.3);
            color: #00ff00;
          `;

          const solAmount = (paymentAmount / 1e9).toFixed(4);

          content.innerHTML = `
            <div style="margin-bottom: 20px;">
              <h1 style="margin: 0; font-size: 28px; text-shadow: 0 0 10px #00ff00;">
                🛡️ PIXEL DEFENSE 🛡️
              </h1>
              <div style="margin: 10px 0; height: 2px; background: #00ff00; opacity: 0.7;"></div>
            </div>

            <div style="margin: 30px 0; padding: 20px; background: rgba(0, 255, 0, 0.1); border: 1px solid #00ff00; border-radius: 8px;">
              <h2 style="margin: 0 0 15px 0; color: #ffff00; text-shadow: 0 0 5px #ffff00;">⚡ PAYMENT REQUIRED ⚡</h2>
              <div style="font-size: 24px; font-weight: bold; margin: 10px 0; text-shadow: 0 0 8px #00ff00;">
                ${solAmount} SOL
              </div>
              <div style="font-size: 14px; opacity: 0.8;">
                Defend your base • Earn rewards • Climb leaderboards
              </div>
            </div>

            <div style="margin: 20px 0; font-size: 14px; opacity: 0.9; line-height: 1.5;">
              <p>🎯 Tower Defense Action</p>
              <p>💰 Play-to-Earn Rewards</p>
              <p>🏆 Global Leaderboards</p>
            </div>

            <div style="margin-top: 30px;">
              <button id="confirm-btn" style="
                background: linear-gradient(45deg, #00ff00, #00cc00);
                color: #000;
                border: none;
                padding: 15px 30px;
                margin: 0 10px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 16px;
                font-weight: bold;
                font-family: 'Courier New', monospace;
                text-transform: uppercase;
                box-shadow: 0 0 15px rgba(0, 255, 0, 0.4);
                transition: all 0.3s ease;
              " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                🚀 Start Defense
              </button>
              <button id="cancel-btn" style="
                background: linear-gradient(45deg, #ff4444, #cc0000);
                color: white;
                border: none;
                padding: 15px 30px;
                margin: 0 10px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 16px;
                font-family: 'Courier New', monospace;
                text-transform: uppercase;
                box-shadow: 0 0 15px rgba(255, 68, 68, 0.4);
                transition: all 0.3s ease;
              " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                ✖️ Cancel
              </button>
            </div>

            <div style="margin-top: 20px; font-size: 11px; opacity: 0.6;">
              Powered by Tank Bank x402 Protocol
            </div>
          `;

          modal.appendChild(content);
          document.body.appendChild(modal);

          const confirmBtn = content.querySelector('#confirm-btn');
          const cancelBtn = content.querySelector('#cancel-btn');

          confirmBtn?.addEventListener('click', () => {
            document.body.removeChild(modal);
            resolve(true);
          });

          cancelBtn?.addEventListener('click', () => {
            document.body.removeChild(modal);
            resolve(false);
          });

          modal.addEventListener('click', (e) => {
            if (e.target === modal) {
              document.body.removeChild(modal);
              resolve(false);
            }
          });
        });
      },

      hide(): void {
        const modal = document.querySelector('[style*="z-index: 10000"]');
        if (modal) {
          modal.remove();
        }
      }
    };
  }

  /**
   * Show loading state while game starts
   */
  private showLoadingState(container: HTMLElement): void {
    container.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: 100%;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        color: #00ff00;
        font-family: 'Courier New', monospace;
      ">
        <div style="font-size: 48px; margin-bottom: 20px;">🛡️</div>
        <h2 style="margin: 0 0 20px 0; text-shadow: 0 0 10px #00ff00;">INITIALIZING DEFENSE SYSTEMS</h2>
        <div style="display: flex; gap: 5px; margin-bottom: 20px;">
          <div class="loading-dot" style="width: 10px; height: 10px; background: #00ff00; border-radius: 50%; animation: pulse 1.5s infinite;"></div>
          <div class="loading-dot" style="width: 10px; height: 10px; background: #00ff00; border-radius: 50%; animation: pulse 1.5s infinite 0.2s;"></div>
          <div class="loading-dot" style="width: 10px; height: 10px; background: #00ff00; border-radius: 50%; animation: pulse 1.5s infinite 0.4s;"></div>
        </div>
        <p style="opacity: 0.8;">Processing payment...</p>
        <style>
          @keyframes pulse {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 1; }
          }
        </style>
      </div>
    `;
  }

  /**
   * Show error state
   */
  private showErrorState(container: HTMLElement, error: Error): void {
    container.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: 100%;
        background: linear-gradient(135deg, #2e1a1a 0%, #3e1616 100%);
        color: #ff4444;
        font-family: 'Courier New', monospace;
        text-align: center;
        padding: 20px;
      ">
        <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
        <h2 style="margin: 0 0 20px 0; text-shadow: 0 0 10px #ff4444;">DEFENSE SYSTEM ERROR</h2>
        <p style="margin: 0 0 20px 0; max-width: 400px; line-height: 1.5;">${error.message}</p>
        <button onclick="location.reload()" style="
          background: linear-gradient(45deg, #ff4444, #cc0000);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
          font-family: 'Courier New', monospace;
          text-transform: uppercase;
        ">
          🔄 Retry
        </button>
      </div>
    `;
  }

  /**
   * Add Pixel Defense specific UI enhancements
   */
  private addPixelDefenseUI(container: HTMLElement): void {
    // Add game info overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: #00ff00;
      padding: 10px;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      border: 1px solid #00ff00;
      z-index: 1000;
    `;

    const session = this.getCurrentSession();
    if (session) {
      overlay.innerHTML = `
        <div><strong>PIXEL DEFENSE</strong></div>
        <div>Session: ${session.sessionId.slice(-8)}</div>
        <div>Payment: ✅ Confirmed</div>
        <div>Started: ${session.startTime.toLocaleTimeString()}</div>
      `;
    }

    container.style.position = 'relative';
    container.appendChild(overlay);

    // Add end game button
    const endGameBtn = document.createElement('button');
    endGameBtn.innerHTML = '🚪 End Game';
    endGameBtn.style.cssText = `
      position: absolute;
      top: 10px;
      left: 10px;
      background: rgba(255, 68, 68, 0.9);
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      z-index: 1000;
    `;

    endGameBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to end the game?')) {
        await this.endGame();
        container.innerHTML = `
          <div style="
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100%;
            background: #1a1a2e;
            color: #00ff00;
            font-family: 'Courier New', monospace;
          ">
            <h2>Game Ended - Thank you for playing!</h2>
          </div>
        `;
      }
    });

    container.appendChild(endGameBtn);
  }
}

export default PixelDefenseIntegration;