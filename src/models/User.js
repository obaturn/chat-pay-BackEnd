const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // ZK Login fields
  zkLoginId: {
    type: String,
    unique: true,
    sparse: true // Allows null values but ensures uniqueness when present
  },

  // Basic user information
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },

  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },

  // Wallet information
  walletAddress: {
    type: String,
    trim: true,
    match: [/^0x[a-fA-F0-9]{64}$/, 'Please enter a valid Sui wallet address']
  },

  // Account balance (in NGN)
  balance: {
    type: Number,
    default: 0,
    min: 0
  },

  // Profile information
  displayName: {
    type: String,
    trim: true,
    maxlength: 50
  },

  profilePicture: {
    type: String,
    trim: true
  },

  bio: {
    type: String,
    trim: true,
    maxlength: 160
  },

  // Social features
  friends: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  friendRequests: [{
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Activity tracking
  lastActive: {
    type: Date,
    default: Date.now
  },

  isOnline: {
    type: Boolean,
    default: false
  },

  // Account status
  isVerified: {
    type: Boolean,
    default: false
  },

  // Email verification
  emailVerification: {
    otp: {
      type: String,
      trim: true
    },
    otpExpiry: {
      type: Date
    },
    isVerified: {
      type: Boolean,
      default: false
    }
  },

  accountStatus: {
    type: String,
    enum: ['active', 'suspended', 'deactivated'],
    default: 'active'
  },

  // Preferences
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      payments: { type: Boolean, default: true }
    },
    privacy: {
      profileVisible: { type: Boolean, default: true },
      showOnlineStatus: { type: Boolean, default: true }
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'auto'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
userSchema.index({ 'friends': 1 });
userSchema.index({ lastActive: -1 });

// Virtual for full name (if needed)
userSchema.virtual('fullName').get(function () {
  return this.displayName || this.username;
});

// Instance methods
userSchema.methods.getFriendsList = async function () {
  return await mongoose.model('User').find({
    _id: { $in: this.friends }
  }).select('username displayName profilePicture isOnline lastActive');
};

userSchema.methods.addFriend = function (friendId) {
  if (!this.friends.includes(friendId)) {
    this.friends.push(friendId);
  }
  return this.save();
};

userSchema.methods.removeFriend = function (friendId) {
  this.friends = this.friends.filter(id => !id.equals(friendId));
  return this.save();
};

// Static methods
userSchema.statics.findByWallet = function (walletAddress) {
  return this.findOne({ walletAddress });
};

userSchema.statics.findByZkLoginId = function (zkLoginId) {
  return this.findOne({ zkLoginId });
};

userSchema.statics.searchUsers = function (query, limit = 10) {
  return this.find({
    $or: [
      { username: new RegExp(query, 'i') },
      { displayName: new RegExp(query, 'i') },
      { email: new RegExp(query, 'i') }
    ]
  })
    .select('username displayName profilePicture isOnline')
    .limit(limit);
};

// Pre-save middleware
userSchema.pre('save', function (next) {
  this.lastActive = new Date();
  next();
});

module.exports = mongoose.model('User', userSchema);