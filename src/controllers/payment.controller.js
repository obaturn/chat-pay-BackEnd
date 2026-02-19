const Transaction = require('../models/Transaction');
const User = require('../models/User');
const paymentService = require('../services/payment.service');

/**
 * Payment Controller
 * Handles all payment-related HTTP requests
 */
class PaymentController {
  /**
   * Initialize payment
   * @route POST /api/payments/initialize
   */
  async initializePayment(req, res) {
    try {
      const { recipientId, amount, currency = 'NGN', description } = req.body;
      const userId = req.user._id;

      // Validation
      if (!recipientId || !amount) {
        return res.status(400).json({
          success: false,
          error: 'Recipient ID and amount are required'
        });
      }

      if (amount < 100) {
        return res.status(400).json({
          success: false,
          error: 'Minimum amount is ₦100'
        });
      }

      // Check if user is trying to pay themselves
      if (userId.toString() === recipientId.toString()) {
        return res.status(400).json({
          success: false,
          error: 'Cannot send payment to yourself'
        });
      }

      // Initialize payment
      const result = await paymentService.initializePayment(
        userId,
        recipientId,
        amount,
        currency,
        description
      );

      return res.status(200).json(result);

    } catch (error) {
      console.error('Initialize payment error:', error.message);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Verify payment
   * @route POST /api/payments/verify
   */
  async verifyPayment(req, res) {
    try {
      const { reference } = req.body;

      if (!reference) {
        return res.status(400).json({
          success: false,
          error: 'Reference is required'
        });
      }

      const result = await paymentService.verifyPayment(reference);

      return res.status(200).json(result);

    } catch (error) {
      console.error('Verify payment error:', error.message);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Paystack webhook endpoint
   * @route POST /api/payments/webhook/paystack
   */
  async handlePaystackWebhook(req, res) {
    try {
      // Verify webhook signature
      const signature = req.headers['x-paystack-signature'];
      const isValid = paymentService.verifyWebhookSignature(req.body, signature);

      if (!isValid) {
        console.warn('Invalid webhook signature');
        return res.status(400).json({
          success: false,
          error: 'Invalid signature'
        });
      }

      // Handle webhook event
      const result = await paymentService.handleWebhookEvent(req.body);

      // Always respond 200 OK so Paystack knows delivery was successful
      return res.status(200).json({
        success: true,
        message: 'Webhook received and processed'
      });

    } catch (error) {
      console.error('Webhook error:', error.message);

      // Still return 200 so Paystack doesn't retry forever
      return res.status(200).json({
        success: false,
        message: 'Webhook processing error'
      });
    }
  }

  /**
   * Get transaction status
   * @route GET /api/payments/:transactionId
   */
  async getTransactionStatus(req, res) {
    try {
      const { transactionId } = req.params;
      const userId = req.user._id;

      const result = await paymentService.getTransactionStatus(transactionId);

      // Verify user has access to this transaction
      const transaction = result.transaction;
      if (
        transaction.fromUser._id.toString() !== userId.toString() &&
        transaction.toUser._id.toString() !== userId.toString()
      ) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized access to transaction'
        });
      }

      return res.status(200).json(result);

    } catch (error) {
      console.error('Get transaction status error:', error.message);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get payment history
   * @route GET /api/payments/history
   */
  async getPaymentHistory(req, res) {
    try {
      const userId = req.user._id;
      const { limit = 20, skip = 0, status, type } = req.query;

      const result = await paymentService.getUserTransactions(userId, {
        limit: parseInt(limit),
        skip: parseInt(skip),
        status,
        type
      });

      return res.status(200).json(result);

    } catch (error) {
      console.error('Get payment history error:', error.message);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Cancel transaction
   * @route POST /api/payments/:transactionId/cancel
   */
  async cancelTransaction(req, res) {
    try {
      const { transactionId } = req.params;
      const { reason } = req.body;
      const userId = req.user._id;

      // Check if user owns the transaction
      const transaction = await Transaction.findById(transactionId);

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: 'Transaction not found'
        });
      }

      if (transaction.fromUser.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Only the sender can cancel a transaction'
        });
      }

      const result = await paymentService.cancelTransaction(transactionId, reason);

      return res.status(200).json(result);

    } catch (error) {
      console.error('Cancel transaction error:', error.message);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get payment stats for user
   * @route GET /api/payments/stats
   */
  async getPaymentStats(req, res) {
    try {
      const userId = req.user._id;
      const { timeframe = 30 } = req.query;

      const stats = await Transaction.getTransactionStats(userId, parseInt(timeframe));

      return res.status(200).json({
        success: true,
        stats: stats
      });

    } catch (error) {
      console.error('Get payment stats error:', error.message);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  /**
   * Get list of banks
   * @route GET /api/payments/banks
   */
  async getBanks(req, res) {
    try {
      const result = await paymentService.getBanks();
      return res.status(200).json(result);
    } catch (error) {
      console.error('Get banks error:', error.message);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Resolve bank account
   * @route POST /api/payments/resolve-account
   */
  async resolveAccount(req, res) {
    try {
      const { accountNumber, bankCode } = req.body;

      if (!accountNumber || !bankCode) {
        return res.status(400).json({
          success: false,
          error: 'Account number and bank code are required'
        });
      }

      const result = await paymentService.verifyAccountNumber(accountNumber, bankCode);
      return res.status(200).json(result);

    } catch (error) {
      console.error('Resolve account error:', error.message);
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Withdraw to bank (Transfer)
   * @route POST /api/payments/withdraw
   */
  async withdraw(req, res) {
    try {
      const { amount, accountNumber, bankCode, accountName, reason } = req.body;
      const userId = req.user._id;

      if (!amount || !accountNumber || !bankCode || !accountName) {
        return res.status(400).json({
          success: false,
          error: 'All fields are required (amount, accountNumber, bankCode, accountName)'
        });
      }

      // 1. Create Recipient
      const recipientCode = await paymentService.createTransferRecipient(
        accountName,
        accountNumber,
        bankCode
      );

      // 2. Initiate Transfer
      const result = await paymentService.initiateTransfer(
        userId,
        amount,
        recipientCode,
        reason
      );

      return res.status(200).json(result);

    } catch (error) {
      console.error('Withdraw error:', error.message);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new PaymentController();
