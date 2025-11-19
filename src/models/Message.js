const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // Message relationship
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true
  },

  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Message type
  type: {
    type: String,
    enum: ['text', 'image', 'file', 'payment_request', 'payment_sent', 'payment_received'],
    default: 'text'
  },

  // Message content
  content: {
    type: String,
    trim: true,
    maxlength: 2000
  },

  // File attachments (for images/files)
  attachments: [{
    filename: String,
    originalName: String,
    mimeType: String,
    size: Number,
    url: String,
    thumbnailUrl: String
  }],

  // Payment data (for payment-related messages)
  paymentData: {
    amount: Number,
    currency: {
      type: String,
      enum: ['SUI', 'USDC', 'NGN', 'USD'],
      default: 'SUI'
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
      default: 'pending'
    },
    transactionHash: String,
    recipientAddress: String,
    description: String,
    dueDate: Date
  },

  // Message metadata
  metadata: {
    edited: { type: Boolean, default: false },
    editedAt: Date,
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    forwardedFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    }
  },

  // Read status
  readBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Reactions
  reactions: [{
    emoji: String,
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Message status
  status: {
    type: String,
    enum: ['sending', 'sent', 'delivered', 'read', 'failed'],
    default: 'sent'
  },

  // For temporary messages (self-destructing)
  expiresAt: Date,

  // Search and indexing
  searchableContent: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
messageSchema.index({ chatId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ 'paymentData.status': 1 });
messageSchema.index({ 'readBy.userId': 1 });
messageSchema.index({ searchableContent: 'text' });
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for read status
messageSchema.virtual('isReadBy').get(function(userId) {
  return this.readBy.some(read => read.userId.equals(userId));
});

// Virtual for reaction count
messageSchema.virtual('reactionCount').get(function() {
  return this.reactions.length;
});

// Instance methods
messageSchema.methods.markAsRead = function(userId) {
  if (!this.isReadBy(userId)) {
    this.readBy.push({ userId, readAt: new Date() });
    return this.save();
  }
  return this;
};

messageSchema.methods.addReaction = function(emoji, userId) {
  // Remove existing reaction from this user
  this.reactions = this.reactions.filter(r => !r.userId.equals(userId));

  // Add new reaction
  this.reactions.push({ emoji, userId, createdAt: new Date() });
  return this.save();
};

messageSchema.methods.removeReaction = function(userId) {
  this.reactions = this.reactions.filter(r => !r.userId.equals(userId));
  return this.save();
};

messageSchema.methods.edit = function(newContent) {
  this.content = newContent;
  this.metadata.edited = true;
  this.metadata.editedAt = new Date();
  this.searchableContent = newContent.toLowerCase();
  return this.save();
};

// Static methods
messageSchema.statics.findChatMessages = function(chatId, options = {}) {
  const { limit = 50, skip = 0, before, after } = options;

  let query = { chatId };

  if (before) {
    query.createdAt = { $lt: before };
  }
  if (after) {
    query.createdAt = { ...query.createdAt, $gt: after };
  }

  return this.find(query)
    .populate('senderId', 'username displayName profilePicture')
    .populate('readBy.userId', 'username')
    .populate('reactions.userId', 'username')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

messageSchema.statics.findPaymentMessages = function(chatId, status = null) {
  const query = { chatId, type: { $in: ['payment_request', 'payment_sent', 'payment_received'] } };

  if (status) {
    query['paymentData.status'] = status;
  }

  return this.find(query)
    .populate('senderId', 'username displayName profilePicture')
    .sort({ createdAt: -1 });
};

messageSchema.statics.markChatAsRead = function(chatId, userId) {
  return this.updateMany(
    { chatId, senderId: { $ne: userId }, 'readBy.userId': { $ne: userId } },
    {
      $push: {
        readBy: { userId, readAt: new Date() }
      }
    }
  );
};

messageSchema.statics.getUnreadCount = function(chatId, userId) {
  return this.countDocuments({
    chatId,
    senderId: { $ne: userId },
    'readBy.userId': { $ne: userId }
  });
};

// Pre-save middleware
messageSchema.pre('save', function(next) {
  // Create searchable content
  if (this.content) {
    this.searchableContent = this.content.toLowerCase();
  }

  // Set expiration for temporary messages
  if (this.expiresAt) {
    // MongoDB will automatically delete expired messages
  }

  next();
});

// Post-save middleware
messageSchema.post('save', async function(doc) {
  // Update chat's last message and activity
  try {
    await mongoose.model('Chat').findByIdAndUpdate(doc.chatId, {
      lastMessage: doc._id,
      lastActivity: new Date(),
      $inc: { messageCount: 1 }
    });
  } catch (error) {
    console.error('Error updating chat after message save:', error);
  }
});

module.exports = mongoose.model('Message', messageSchema);