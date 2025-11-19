const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Authentication Middleware
 * Verifies JWT tokens and attaches user to request
 */

/**
 * Verify JWT token middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Access token is required'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    // Get user from database
    const user = await User.findById(decoded.userId)
      .select('-__v -createdAt -updatedAt');

    if (!user) {
      return res.status(401).json({
        error: 'User not found'
      });
    }

    // Check if user is active
    if (user.accountStatus !== 'active') {
      return res.status(403).json({
        error: 'Account is not active'
      });
    }

    // Attach user to request
    req.user = user;

    // Update last active time (throttled to avoid too many DB writes)
    const now = new Date();
    const lastActive = user.lastActive || new Date(0);
    const timeDiff = now - lastActive;

    // Only update if more than 5 minutes have passed
    if (timeDiff > 5 * 60 * 1000) {
      user.lastActive = now;
      user.isOnline = true;
      await user.save();
    }

    next();

  } catch (error) {
    console.error('Authentication error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired'
      });
    }

    res.status(500).json({
      error: 'Authentication failed'
    });
  }
};

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't fail if no token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      const user = await User.findById(decoded.userId);

      if (user && user.accountStatus === 'active') {
        req.user = user;
      }
    }

    next();

  } catch (error) {
    // Silently fail for optional auth
    next();
  }
};

/**
 * Admin only middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireAdmin = (req, res, next) => {
  // In a real app, you might have roles in the user model
  // For now, this is a placeholder
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required'
    });
  }

  // Check if user has admin privileges
  // This would be based on your user model/role system
  const isAdmin = req.user.role === 'admin' || req.user.isAdmin;

  if (!isAdmin) {
    return res.status(403).json({
      error: 'Admin access required'
    });
  }

  next();
};

/**
 * Rate limiting helper for auth endpoints
 * @param {number} maxRequests - Maximum requests per window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Function} Rate limiting middleware
 */
const createRateLimit = (maxRequests = 5, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();

  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old entries
    for (const [ip, timestamps] of requests.entries()) {
      requests.set(ip, timestamps.filter(timestamp => timestamp > windowStart));
      if (requests.get(ip).length === 0) {
        requests.delete(ip);
      }
    }

    // Check current requests
    const userRequests = requests.get(key) || [];
    if (userRequests.length >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests. Please try again later.'
      });
    }

    // Add current request
    userRequests.push(now);
    requests.set(key, userRequests);

    next();
  };
};

/**
 * ZK Login specific middleware
 * Validates ZK proof format
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validateZKProof = (req, res, next) => {
  const { zkProof } = req.body;

  if (!zkProof) {
    return res.status(400).json({
      error: 'ZK proof is required'
    });
  }

  if (!zkProof.jwt || !zkProof.provider) {
    return res.status(400).json({
      error: 'Invalid ZK proof format. Must include jwt and provider.'
    });
  }

  const validProviders = ['google'];
  if (!validProviders.includes(zkProof.provider)) {
    return res.status(400).json({
      error: `Invalid provider. Supported: ${validProviders.join(', ')}`
    });
  }

  next();
};

/**
 * CORS configuration for auth endpoints
 */
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireAdmin,
  createRateLimit,
  validateZKProof,
  corsOptions
};