const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  // Chat participants
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],

  // Chat type
  type: {
    type: String,
    enum: ['direct', 'group'],
    default: 'direct'
  },

  // Group chat specific fields
  name: {
    type: String,
    trim: true,
    maxlength: 100,
    required: function() {
      return this.type === 'group';
    }
  },

  description: {
    type: String,
    trim: true,
    maxlength: 500
  },

  avatar: {
    type: String,
    trim: true
  },

  // Group admin (for group chats)
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return this.type === 'group';
    }
  },

  // Chat settings
  settings: {
    isPublic: {
      type: Boolean,
      default: false
    },
    allowInvites: {
      type: Boolean,
      default: true
    },
    muteNotifications: {
      type: Boolean,
      default: false
    }
  },

  // Last message reference
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },

  // Message count
  messageCount: {
    type: Number,
    default: 0
  },

  // Pinned messages
  pinnedMessages: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  }],

  // Chat status
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted'],
    default: 'active'
  },

  // Activity tracking
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
chatSchema.index({ participants: 1 });
chatSchema.index({ type: 1 });
chatSchema.index({ status: 1 });
chatSchema.index({ lastActivity: -1 });
chatSchema.index({ 'participants': 1, 'type': 1 });

// Virtual for chat display name
chatSchema.virtual('displayName').get(function() {
  if (this.type === 'group') {
    return this.name;
  } else {
    // For direct chats, return the other participant's name
    // This would need to be populated when querying
    return 'Direct Chat';
  }
});

// Virtual for unread count (would need user context)
chatSchema.virtual('unreadCount').get(function() {
  // This would be calculated based on user's last read message
  return 0;
});

// Instance methods
chatSchema.methods.addParticipant = function(userId) {
  if (!this.participants.includes(userId)) {
    this.participants.push(userId);
    return this.save();
  }
  return this;
};

chatSchema.methods.removeParticipant = function(userId) {
  this.participants = this.participants.filter(id => !id.equals(userId));
  return this.save();
};

chatSchema.methods.isParticipant = function(userId) {
  return this.participants.some(id => id.equals(userId));
};

chatSchema.methods.updateLastActivity = function() {
  this.lastActivity = new Date();
  return this.save();
};

// Static methods
chatSchema.statics.findUserChats = function(userId, options = {}) {
  const { limit = 50, skip = 0, status = 'active' } = options;

  return this.find({
    participants: userId,
    status: status
  })
  .populate('participants', 'username displayName profilePicture isOnline')
  .populate('lastMessage')
  .sort({ lastActivity: -1 })
  .limit(limit)
  .skip(skip);
};

chatSchema.statics.findDirectChat = function(userId1, userId2) {
  return this.findOne({
    participants: { $all: [userId1, userId2], $size: 2 },
    type: 'direct'
  });
};

chatSchema.statics.createDirectChat = async function(userId1, userId2) {
  // Check if direct chat already exists
  const existingChat = await this.findDirectChat(userId1, userId2);
  if (existingChat) {
    return existingChat;
  }

  // Create new direct chat
  const chat = new this({
    participants: [userId1, userId2],
    type: 'direct'
  });

  return chat.save();
};

chatSchema.statics.createGroupChat = async function(name, participants, admin) {
  const chat = new this({
    name,
    participants,
    admin,
    type: 'group'
  });

  return chat.save();
};

// Pre-save middleware
chatSchema.pre('save', function(next) {
  this.lastActivity = new Date();
  next();
});

// Post-save middleware to update participants' chat lists
chatSchema.post('save', async function(doc) {
  // Could emit socket events or update caches here
  console.log(`Chat ${doc._id} saved with ${doc.participants.length} participants`);
});

module.exports = mongoose.model('Chat', chatSchema);