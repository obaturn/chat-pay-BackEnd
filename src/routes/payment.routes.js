const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.middleware');
const paymentController = require('../controllers/payment.controller');

/**
 * @route POST /api/payments/initialize
 * @desc Initialize payment with Paystack
 * @access Private
 */
router.post('/initialize', authenticateToken, (req, res) =>
  paymentController.initializePayment(req, res)
);

/**
 * @route POST /api/payments/verify
 * @desc Verify payment from Paystack
 * @access Private
 */
router.post('/verify', authenticateToken, (req, res) =>
  paymentController.verifyPayment(req, res)
);

/**
 * @route POST /api/payments/webhook/paystack
 * @desc Paystack webhook (no auth needed - webhook signature verified instead)
 * @access Public
 */
router.post('/webhook/paystack', (req, res) =>
  paymentController.handlePaystackWebhook(req, res)
);

/**
 * @route GET /api/payments/history
 * @desc Get payment history
 * @access Private
 */
router.get('/history', authenticateToken, (req, res) =>
  paymentController.getPaymentHistory(req, res)
);

/**
 * @route GET /api/payments/stats
 * @desc Get payment statistics
 * @access Private
 */
router.get('/stats', authenticateToken, (req, res) =>
  paymentController.getPaymentStats(req, res)
);

/**
 * @route GET /api/payments/banks
 * @desc Get list of banks
 * @access Private
 */
router.get('/banks', authenticateToken, (req, res) =>
  paymentController.getBanks(req, res)
);

/**
 * @route POST /api/payments/resolve-account
 * @desc Verify bank account details
 * @access Private
 */
router.post('/resolve-account', authenticateToken, (req, res) =>
  paymentController.resolveAccount(req, res)
);

/**
 * @route POST /api/payments/withdraw
 * @desc Withdraw funds to bank account
 * @access Private
 */
router.post('/withdraw', authenticateToken, (req, res) =>
  paymentController.withdraw(req, res)
);

/**
 * @route GET /api/payments/:transactionId
 * @desc Get payment details
 * @access Private
 */
router.get('/:transactionId', authenticateToken, (req, res) =>
  paymentController.getTransactionStatus(req, res)
);

/**
 * @route POST /api/payments/:transactionId/cancel
 * @desc Cancel transaction
 * @access Private
 */
router.post('/:transactionId/cancel', authenticateToken, (req, res) =>
  paymentController.cancelTransaction(req, res)
);

module.exports = router;