const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  // Transaction parties
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  toUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // For external transactions (when recipient is not in the system)
  externalRecipient: {
    address: String,
    name: String,
    email: String
  },

  // Transaction details
  amount: {
    type: Number,
    required: true,
    min: 0
  },

  currency: {
    type: String,
    enum: ['SUI', 'USDC', 'NGN', 'USD'],
    required: true,
    default: 'SUI'
  },

  // Transaction type
  type: {
    type: String,
    enum: ['send', 'request', 'receive', 'refund', 'fee'],
    required: true
  },

  // Transaction status
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },

  // Blockchain details
  suiTxHash: {
    type: String,
    trim: true,
    index: true
  },

  blockNumber: Number,
  gasUsed: Number,
  gasPrice: Number,

  // Payment method
  paymentMethod: {
    type: String,
    enum: ['crypto', 'bank', 'card', 'wallet'],
    default: 'crypto'
  },

  // Related chat and message
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat'
  },

  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },

  // Transaction metadata
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },

  category: {
    type: String,
    enum: ['payment', 'refund', 'fee', 'donation', 'purchase', 'transfer'],
    default: 'payment'
  },

  tags: [String],

  // Exchange rates (for multi-currency support)
  exchangeRate: {
    from: String,
    to: String,
    rate: Number,
    timestamp: Date
  },

  // Payment request details (for request transactions)
  paymentRequest: {
    dueDate: Date,
    reminderSent: { type: Boolean, default: false },
    reminderCount: { type: Number, default: 0 }
  },

  // Refund details
  refundReason: String,
  originalTransaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },

  // External payment details (for bank transfers, etc.)
  externalReference: {
    type: String,
    trim: true
  },

  bankDetails: {
    bankName: String,
    accountNumber: String,
    accountName: String,
    reference: String
  },

  // Processing details
  processedBy: {
    type: String,
    enum: ['sui_blockchain', 'bank_api', 'manual', 'system']
  },

  processingFee: {
    amount: Number,
    currency: String
  },

  // Audit trail
  ipAddress: String,
  userAgent: String,
  location: {
    country: String,
    city: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
transactionSchema.index({ fromUser: 1, createdAt: -1 });
transactionSchema.index({ toUser: 1, createdAt: -1 });
transactionSchema.index({ suiTxHash: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ chatId: 1 });
transactionSchema.index({ 'paymentRequest.dueDate': 1 });
transactionSchema.index({ createdAt: -1 });

// Virtual for formatted amount
transactionSchema.virtual('formattedAmount').get(function() {
  return `${this.amount} ${this.currency}`;
});

// Virtual for transaction direction (from user's perspective)
transactionSchema.virtual('direction').get(function() {
  // This would need user context to determine if it's incoming or outgoing
  return this.type === 'receive' ? 'incoming' : 'outgoing';
});

// Instance methods
transactionSchema.methods.markAsCompleted = function(txHash = null) {
  this.status = 'completed';
  if (txHash) this.suiTxHash = txHash;
  return this.save();
};

transactionSchema.methods.markAsFailed = function(reason = null) {
  this.status = 'failed';
  if (reason) this.description = reason;
  return this.save();
};

transactionSchema.methods.createRefund = async function(reason) {
  const refund = new mongoose.model('Transaction')({
    fromUser: this.toUser,
    toUser: this.fromUser,
    amount: this.amount,
    currency: this.currency,
    type: 'refund',
    status: 'pending',
    description: reason,
    originalTransaction: this._id,
    chatId: this.chatId
  });

  await refund.save();
  return refund;
};

transactionSchema.methods.sendReminder = async function() {
  if (this.type === 'request' && this.status === 'pending') {
    this.paymentRequest.reminderCount += 1;
    this.paymentRequest.reminderSent = true;
    return this.save();
  }
  return this;
};

// Static methods
transactionSchema.statics.findUserTransactions = function(userId, options = {}) {
  const { limit = 20, skip = 0, type, status, currency } = options;

  const query = {
    $or: [
      { fromUser: userId },
      { toUser: userId }
    ]
  };

  if (type) query.type = type;
  if (status) query.status = status;
  if (currency) query.currency = currency;

  return this.find(query)
    .populate('fromUser', 'username displayName profilePicture')
    .populate('toUser', 'username displayName profilePicture')
    .populate('chatId', 'name type')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

transactionSchema.statics.getTransactionStats = function(userId, timeframe = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeframe);

  return this.aggregate([
    {
      $match: {
        $or: [{ fromUser: mongoose.Types.ObjectId(userId) }, { toUser: mongoose.Types.ObjectId(userId) }],
        createdAt: { $gte: startDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: {
          currency: '$currency',
          type: {
            $cond: {
              if: { $eq: ['$fromUser', mongoose.Types.ObjectId(userId)] },
              then: 'outgoing',
              else: 'incoming'
            }
          }
        },
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);
};

transactionSchema.statics.findPendingRequests = function(userId) {
  return this.find({
    toUser: userId,
    type: 'request',
    status: 'pending'
  })
  .populate('fromUser', 'username displayName profilePicture')
  .populate('chatId', 'name')
  .sort({ createdAt: -1 });
};

transactionSchema.statics.findOverduePayments = function() {
  return this.find({
    type: 'request',
    status: 'pending',
    'paymentRequest.dueDate': { $lt: new Date() }
  })
  .populate('fromUser', 'username email')
  .populate('toUser', 'username email');
};

// Pre-save middleware
transactionSchema.pre('save', function(next) {
  // Validate transaction logic
  if (this.type === 'send' && !this.toUser && !this.externalRecipient) {
    return next(new Error('Send transactions must have a recipient'));
  }

  if (this.type === 'request' && !this.toUser) {
    return next(new Error('Request transactions must have a recipient'));
  }

  next();
});

// Post-save middleware
transactionSchema.post('save', async function(doc) {
  // Emit real-time updates
  try {
    // This would integrate with Socket.io to notify users
    console.log(`Transaction ${doc._id} saved: ${doc.type} ${doc.amount} ${doc.currency}`);
  } catch (error) {
    console.error('Error in transaction post-save:', error);
  }
});

module.exports = mongoose.model('Transaction', transactionSchema);