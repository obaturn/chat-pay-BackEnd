const axios = require('axios');
const crypto = require('crypto');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

/**
 * Payment Service
 * Handles all payment operations with Paystack
 */
class PaymentService {
  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY;
    this.publicKey = process.env.PAYSTACK_PUBLIC_KEY;
    this.baseUrl = process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co';
  }

  /**
   * Initialize payment with Paystack
   * @param {string} userId - Sender user ID
   * @param {string} recipientId - Recipient user ID (if internal)
   * @param {number} amount - Amount in NGN
   * @param {string} currency - Currency code
   * @param {string} description - Transaction description
   * @returns {Object} Payment initialization response
   */
  async initializePayment(userId, recipientId, amount, currency = 'NGN', description = '') {
    try {
      const fromUser = await User.findById(userId);
      const toUser = await User.findById(recipientId);

      if (!fromUser || !toUser) {
        throw new Error('User not found');
      }

      // Validate amount
      if (amount < 100) {
        throw new Error('Minimum amount is ₦100');
      }

      // Create transaction record FIRST (status: pending)
      const transaction = await Transaction.create({
        fromUser: userId,
        toUser: recipientId,
        amount: amount,
        currency: currency,
        paymentMethod: 'bank',
        status: 'pending',
        description: description,
        externalReference: `paystack_${Date.now()}`,
        type: 'send'
      });

      // Call Paystack API
      const response = await axios.post(
        `${this.baseUrl}/transaction/initialize`,
        {
          email: fromUser.email,
          amount: amount * 100,  // Convert to kobo
          reference: transaction._id.toString(),
          metadata: {
            transactionId: transaction._id.toString(),
            fromUser: userId,
            toUser: recipientId,
            description: description
          }
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.data.status) {
        throw new Error('Failed to initialize payment with Paystack');
      }

      return {
        success: true,
        authorizationUrl: response.data.data.authorization_url,
        accessCode: response.data.data.access_code,
        reference: response.data.data.reference,
        transactionId: transaction._id.toString(),
        message: 'Payment initialization successful'
      };

    } catch (error) {
      console.error('Payment initialization error:', error.message);
      throw new Error(`Payment initialization failed: ${error.message}`);
    }
  }

  /**
   * Verify payment with Paystack
   * @param {string} reference - Paystack reference
   * @returns {Object} Verification response
   */
  async verifyPayment(reference) {
    try {
      // Call Paystack verification API
      const response = await axios.get(
        `${this.baseUrl}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`
          }
        }
      );

      if (!response.data.status) {
        throw new Error('Payment verification failed');
      }

      const paymentData = response.data.data;

      if (paymentData.status === 'success') {
        // Find the transaction
        const transaction = await Transaction.findById(paymentData.reference);

        if (!transaction) {
          throw new Error('Transaction not found');
        }

        // Check if already completed (idempotency)
        if (transaction.status === 'completed') {
          return {
            success: true,
            message: 'Payment already completed',
            transactionId: transaction._id
          };
        }

        // Update transaction
        transaction.status = 'completed';
        transaction.suiTxHash = paymentData.reference;
        transaction.externalReference = reference;
        transaction.processingFee = {
          amount: (paymentData.amount / 100) * 0.015, // Paystack charges 1.5%
          currency: 'NGN'
        };
        await transaction.save();

        // Update user balances
        await User.findByIdAndUpdate(
          transaction.fromUser,
          { $inc: { balance: -transaction.amount } }
        );

        await User.findByIdAndUpdate(
          transaction.toUser,
          { $inc: { balance: transaction.amount } }
        );

        return {
          success: true,
          transactionId: transaction._id,
          message: 'Payment verified successfully'
        };
      } else {
        // Payment failed
        await Transaction.updateOne(
          { _id: paymentData.reference },
          { status: 'failed' }
        );

        return {
          success: false,
          message: `Payment failed: ${paymentData.gateway_response}`
        };
      }

    } catch (error) {
      console.error('Payment verification error:', error.message);
      throw new Error(`Payment verification failed: ${error.message}`);
    }
  }

  /**
   * Verify webhook signature from Paystack
   * @param {string} body - Request body
   * @param {string} signature - Signature from header
   * @returns {boolean} Is valid signature
   */
  verifyWebhookSignature(body, signature) {
    const hash = crypto
      .createHmac('sha512', this.secretKey)
      .update(JSON.stringify(body))
      .digest('hex');

    return hash === signature;
  }

  /**
   * Handle webhook event from Paystack
   * @param {Object} event - Webhook event
   * @returns {Object} Handler response
   */
  async handleWebhookEvent(event) {
    try {
      if (event.event === 'charge.success') {
        const reference = event.data.reference;
        const transactionId = event.data.metadata.transactionId;

        // Verify payment
        const verified = await this.verifyPayment(reference);

        if (verified.success) {
          return {
            success: true,
            message: 'Payment processed successfully via webhook'
          };
        } else {
          return {
            success: false,
            message: 'Payment verification failed'
          };
        }
      }

      return {
        success: true,
        message: 'Event processed'
      };

    } catch (error) {
      console.error('Webhook handling error:', error.message);
      throw error;
    }
  }

  /**
   * Get transaction status
   * @param {string} transactionId - Transaction ID
   * @returns {Object} Transaction details
   */
  async getTransactionStatus(transactionId) {
    try {
      const transaction = await Transaction.findById(transactionId)
        .populate('fromUser', 'username displayName email')
        .populate('toUser', 'username displayName email');

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      return {
        success: true,
        transaction: transaction
      };

    } catch (error) {
      console.error('Get transaction status error:', error.message);
      throw error;
    }
  }

  /**
   * Get user transaction history
   * @param {string} userId - User ID
   * @param {Object} options - Query options (limit, skip, status, type)
   * @returns {Array} Transactions
   */
  async getUserTransactions(userId, options = {}) {
    try {
      const { limit = 20, skip = 0, status, type } = options;

      const query = {
        $or: [
          { fromUser: userId },
          { toUser: userId }
        ]
      };

      if (status) query.status = status;
      if (type) query.type = type;

      const transactions = await Transaction.find(query)
        .populate('fromUser', 'username displayName profilePicture')
        .populate('toUser', 'username displayName profilePicture')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);

      const total = await Transaction.countDocuments(query);

      return {
        success: true,
        transactions: transactions,
        total: total,
        pages: Math.ceil(total / limit)
      };

    } catch (error) {
      console.error('Get user transactions error:', error.message);
      throw error;
    }
  }

  /**
   * Cancel transaction
   * @param {string} transactionId - Transaction ID
   * @param {string} reason - Cancellation reason
   * @returns {Object} Cancellation response
   */
  async cancelTransaction(transactionId, reason = '') {
    try {
      const transaction = await Transaction.findById(transactionId);

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (transaction.status === 'completed') {
        throw new Error('Cannot cancel completed transaction');
      }

      transaction.status = 'cancelled';
      transaction.description = reason || 'Cancelled by user';
      await transaction.save();

      return {
        success: true,
        message: 'Transaction cancelled successfully',
        transactionId: transaction._id
      };

    } catch (error) {
      console.error('Cancel transaction error:', error.message);
      throw error;
    }
  }
  /**
   * Get list of banks
   * @returns {Array} List of banks
   */
  async getBanks() {
    try {
      const response = await axios.get(`${this.baseUrl}/bank`, {
        headers: { Authorization: `Bearer ${this.secretKey}` }
      });
      return {
        success: true,
        banks: response.data.data
      };
    } catch (error) {
      console.error('Get banks error:', error.message);
      throw new Error(`Failed to fetch banks: ${error.message}`);
    }
  }

  /**
   * Verify bank account number
   * @param {string} accountNumber - Account number
   * @param {string} bankCode - Bank code
   * @returns {Object} Account details
   */
  async verifyAccountNumber(accountNumber, bankCode) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
        {
          headers: { Authorization: `Bearer ${this.secretKey}` }
        }
      );

      return {
        success: true,
        accountName: response.data.data.account_name,
        accountNumber: response.data.data.account_number,
        bankId: response.data.data.bank_id
      };
    } catch (error) {
      console.error('Verify account error:', error.message);
      throw new Error('Could not verify account number. Please check details.');
    }
  }

  /**
   * Create transfer recipient
   * @param {string} name - Account name
   * @param {string} accountNumber - Account number
   * @param {string} bankCode - Bank code
   * @returns {string} Recipient code
   */
  async createTransferRecipient(name, accountNumber, bankCode) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/transferrecipient`,
        {
          type: "nuban",
          name: name,
          account_number: accountNumber,
          bank_code: bankCode,
          currency: "NGN"
        },
        {
          headers: { Authorization: `Bearer ${this.secretKey}` }
        }
      );

      return response.data.data.recipient_code;
    } catch (error) {
      console.error('Create recipient error:', error.message);
      throw new Error(`Failed to create transfer recipient: ${error.message}`);
    }
  }

  /**
   * Initiate transfer to bank
   * @param {string} userId - Sender user ID
   * @param {number} amount - Amount in NGN
   * @param {string} recipientCode - Paystack recipient code
   * @param {string} reason - Transfer reason
   * @returns {Object} Transfer details
   */
  async initiateTransfer(userId, amount, recipientCode, reason) {
    try {
      // Check user balance first
      const user = await User.findById(userId);
      if (user.balance < amount) {
        throw new Error('Insufficient balance');
      }

      // Create transaction record (pending)
      const transaction = await Transaction.create({
        fromUser: userId,
        amount: amount,
        currency: 'NGN',
        paymentMethod: 'bank_transfer',
        status: 'pending',
        description: reason || 'Withdrawal to bank',
        type: 'withdrawal',
        metadata: {
          recipientCode: recipientCode
        }
      });

      // Initiate transfer with Paystack
      const response = await axios.post(
        `${this.baseUrl}/transfer`,
        {
          source: "balance",
          amount: amount * 100, // kobo
          recipient: recipientCode,
          reason: reason,
          reference: transaction._id.toString()
        },
        {
          headers: { Authorization: `Bearer ${this.secretKey}` }
        }
      );

      if (!response.data.status) {
        // Mark as failed locally if immediate failure
        transaction.status = 'failed';
        await transaction.save();
        throw new Error(response.data.message);
      }

      // We do NOT deduct balance yet. We wait for webhook 'transfer.success'.
      // OR we deduct now and refund if failed?
      // Best practice: Deduct NOW (Lock funds). Refund if 'transfer.failed'.
      // This prevents double spending.

      await User.findByIdAndUpdate(userId, { $inc: { balance: -amount } });

      return {
        success: true,
        message: 'Transfer queued successfully',
        reference: response.data.data.reference,
        transactionId: transaction._id
      };

    } catch (error) {
      console.error('Initiate transfer error:', error.message);
      throw new Error(`Transfer failed: ${error.message}`);
    }
  }

  /**
   * Handle transfer webhooks
   * @param {Object} event - Webhook event (transfer.success / transfer.failed)
   */
  async handleTransferWebhook(event) {
    const reference = event.data.reference;
    const transaction = await Transaction.findById(reference);

    if (!transaction) return;

    if (event.event === 'transfer.success') {
      transaction.status = 'completed';
      await transaction.save();
    } else if (event.event === 'transfer.failed') {
      transaction.status = 'failed';
      await transaction.save();

      // Refund user
      await User.findByIdAndUpdate(transaction.fromUser, {
        $inc: { balance: transaction.amount }
      });
    }
  }
}

module.exports = new PaymentService();
