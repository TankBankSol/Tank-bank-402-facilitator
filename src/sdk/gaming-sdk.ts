/**
 * Tank Bank x402 Gaming SDK
 * Integration SDK for games to use x402 payment protocol with wallet confirmation
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { AuthorizationPayload, PaymentRequest } from '../lib/payment-request.js';

export interface GameConfig {
  gameId: string;
  gameName: string;
  costToPlay: number; // in lamports
  network: 'mainnet-beta' | 'testnet' | 'devnet';
  facilitatorUrl: string;
  merchantAddress: string;
  rpcUrl: string;
}

export interface WalletProvider {
  publicKey: PublicKey | null;
  connected: boolean;
  signMessage(message: Uint8Array): Promise<Uint8Array>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

export interface GameSession {
  sessionId: string;
  gameId: string;
  playerPublicKey: string;
  paymentAmount: number;
  transactionSignature?: string;
  startTime: Date;
  isActive: boolean;
}

export interface WalletConfirmationModal {
  show(gameConfig: GameConfig, paymentAmount: number): Promise<boolean>;
  hide(): void;
}

export class TankBankGamingSDK {
  private config: GameConfig;
  private connection: Connection;
  private wallet: WalletProvider | null = null;
  private currentSession: GameSession | null = null;
  private confirmationModal: WalletConfirmationModal | null = null;

  constructor(config: GameConfig) {
    this.config = config;
    this.connection = new Connection(config.rpcUrl, 'confirmed');
  }

  /**
   * Set the wallet provider (Phantom, Solflare, etc.)
   */
  setWallet(wallet: WalletProvider): void {
    this.wallet = wallet;
  }

  /**
   * Set custom confirmation modal
   */
  setConfirmationModal(modal: WalletConfirmationModal): void {
    this.confirmationModal = modal;
  }

  /**
   * Check if wallet has sufficient balance to play the game
   */
  async checkBalance(): Promise<{ hasBalance: boolean; currentBalance: number; required: number }> {
    if (!this.wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }

    const balance = await this.connection.getBalance(this.wallet.publicKey);
    const hasBalance = balance >= this.config.costToPlay;

    return {
      hasBalance,
      currentBalance: balance,
      required: this.config.costToPlay
    };
  }

  /**
   * Show wallet confirmation modal for game play
   */
  private async showWalletConfirmation(): Promise<boolean> {
    if (this.confirmationModal) {
      return await this.confirmationModal.show(this.config, this.config.costToPlay);
    }

    // Default confirmation using browser prompt
    const solAmount = (this.config.costToPlay / 1e9).toFixed(4);
    const message = `Do you want to play ${this.config.gameName}?\n\nCost: ${solAmount} SOL\nGame: ${this.config.gameName}\n\nThis will be charged to your wallet.`;

    return confirm(message);
  }

  /**
   * Start a new game session with wallet confirmation and payment
   */
  async startGame(): Promise<GameSession> {
    try {
      // 1. Check wallet connection
      if (!this.wallet) {
        throw new Error('No wallet provider set');
      }

      if (!this.wallet.connected) {
        await this.wallet.connect();
      }

      if (!this.wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      // 2. Check balance
      const balanceCheck = await this.checkBalance();
      if (!balanceCheck.hasBalance) {
        const solRequired = (this.config.costToPlay / 1e9).toFixed(4);
        const solCurrent = (balanceCheck.currentBalance / 1e9).toFixed(4);
        throw new Error(`Insufficient balance. Required: ${solRequired} SOL, Current: ${solCurrent} SOL`);
      }

      // 3. Show wallet confirmation modal
      const confirmed = await this.showWalletConfirmation();
      if (!confirmed) {
        throw new Error('User cancelled game start');
      }

      // 4. Create payment authorization
      const sessionId = this.generateSessionId();
      const nonce = AuthorizationPayload.generateNonce();

      const payload = AuthorizationPayload.create({
        amount: this.config.costToPlay.toString(),
        recipient: this.config.merchantAddress,
        resourceId: `game:${this.config.gameId}:${sessionId}`,
        resourceUrl: `game://${this.config.gameId}/play`,
        nonce,
        expiryHours: 1 // Game session expires in 1 hour
      });

      // 5. Sign the payment authorization
      const payloadHash = new TextEncoder().encode(payload.serialize());
      const signature = await this.wallet.signMessage(payloadHash);

      const paymentRequest = new PaymentRequest({
        payload,
        signature: Buffer.from(signature).toString('base64'),
        clientPublicKey: this.wallet.publicKey.toString()
      });

      // 6. Submit payment to facilitator
      const paymentResponse = await this.submitPayment(paymentRequest);

      // 7. Create game session
      const session: GameSession = {
        sessionId,
        gameId: this.config.gameId,
        playerPublicKey: this.wallet.publicKey.toString(),
        paymentAmount: this.config.costToPlay,
        transactionSignature: paymentResponse.transactionSignature,
        startTime: new Date(),
        isActive: true
      };

      this.currentSession = session;
      return session;

    } catch (error) {
      console.error('Failed to start game:', error);
      throw error;
    }
  }

  /**
   * Submit payment to x402 facilitator
   */
  private async submitPayment(paymentRequest: PaymentRequest): Promise<{ success: boolean; transactionSignature?: string }> {
    const response = await fetch(`${this.config.facilitatorUrl}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: paymentRequest.serialize()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Payment failed: ${error.message || 'Unknown error'}`);
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * End current game session
   */
  async endGame(): Promise<void> {
    if (this.currentSession) {
      this.currentSession.isActive = false;
      this.currentSession = null;
    }
  }

  /**
   * Get current active session
   */
  getCurrentSession(): GameSession | null {
    return this.currentSession;
  }

  /**
   * Check if player is currently in a game
   */
  isGameActive(): boolean {
    return this.currentSession?.isActive ?? false;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load and initialize game with payment verification
   */
  async loadGame(gameContainerElement: HTMLElement, gameUrl: string): Promise<void> {
    if (!this.isGameActive()) {
      throw new Error('No active game session. Please start a game first.');
    }

    // Create iframe for game
    const iframe = document.createElement('iframe');
    iframe.src = gameUrl;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.setAttribute('allowfullscreen', 'true');

    // Add session data to iframe URL
    const urlWithSession = new URL(gameUrl);
    urlWithSession.searchParams.set('sessionId', this.currentSession!.sessionId);
    urlWithSession.searchParams.set('playerKey', this.currentSession!.playerPublicKey);
    urlWithSession.searchParams.set('paymentTx', this.currentSession!.transactionSignature || '');
    iframe.src = urlWithSession.toString();

    // Clear container and add game
    gameContainerElement.innerHTML = '';
    gameContainerElement.appendChild(iframe);

    // Set up message listener for game events
    window.addEventListener('message', this.handleGameMessage.bind(this));
  }

  /**
   * Handle messages from the game iframe
   */
  private handleGameMessage(event: MessageEvent): void {
    if (event.data.type === 'GAME_ENDED') {
      this.endGame();
    } else if (event.data.type === 'GAME_ERROR') {
      console.error('Game error:', event.data.error);
      this.endGame();
    }
  }

  /**
   * Create default wallet confirmation modal
   */
  static createDefaultConfirmationModal(): WalletConfirmationModal {
    return {
      async show(gameConfig: GameConfig, paymentAmount: number): Promise<boolean> {
        return new Promise((resolve) => {
          // Create modal elements
          const modal = document.createElement('div');
          modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            font-family: Arial, sans-serif;
          `;

          const content = document.createElement('div');
          content.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 12px;
            max-width: 400px;
            text-align: center;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
          `;

          const solAmount = (paymentAmount / 1e9).toFixed(4);

          content.innerHTML = `
            <h2 style="margin: 0 0 20px 0; color: #333;">🎮 Start Game</h2>
            <h3 style="margin: 0 0 15px 0; color: #555;">${gameConfig.gameName}</h3>
            <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #007bff;">
              <p style="margin: 0 0 10px 0; font-weight: bold; color: #333;">Payment Required</p>
              <p style="margin: 0; font-size: 18px; color: #007bff; font-weight: bold;">${solAmount} SOL</p>
            </div>
            <p style="margin: 15px 0; color: #666;">This amount will be charged to your wallet to start playing.</p>
            <div style="margin-top: 25px;">
              <button id="confirm-btn" style="
                background: #007bff;
                color: white;
                border: none;
                padding: 12px 24px;
                margin: 0 10px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 16px;
                font-weight: bold;
              ">Confirm & Play</button>
              <button id="cancel-btn" style="
                background: #6c757d;
                color: white;
                border: none;
                padding: 12px 24px;
                margin: 0 10px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 16px;
              ">Cancel</button>
            </div>
          `;

          modal.appendChild(content);
          document.body.appendChild(modal);

          // Add event listeners
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

          // Close on backdrop click
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
}

export default TankBankGamingSDK;