const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const {
  authenticateToken,
  createRateLimit,
  validateZKProof
} = require('../middleware/auth.middleware');

// Rate limiting for auth endpoints
const authRateLimit = createRateLimit(5, 15 * 60 * 1000); // 5 requests per 15 minutes
const zkRateLimit = createRateLimit(3, 10 * 60 * 1000); // 3 requests per 10 minutes

/**
 * @route POST /api/auth/zk-login
 * @desc ZK Login with OAuth providers
 * @access Public
 */
router.post('/zk-login',
  zkRateLimit,
  validateZKProof,
  authController.zkLogin
);

/**
 * @route POST /api/auth/login
 * @desc Traditional email/password login
 * @access Public
 */
router.post('/login',
  authRateLimit,
  authController.login
);

/**
 * @route POST /api/auth/register
 * @desc User registration
 * @access Public
 */
router.post('/register',
  authRateLimit,
  authController.register
);

/**
 * @route POST /api/auth/verify-email
 * @desc Verify email with OTP
 * @access Public
 */
router.post('/verify-email',
  authRateLimit,
  authController.verifyEmail
);

/**
 * @route POST /api/auth/resend-otp
 * @desc Resend OTP to email
 * @access Public
 */
router.post('/resend-otp',
  authRateLimit,
  authController.resendOTP
);

/**
 * @route POST /api/auth/generate-test-otp
 * @desc Generate test OTP for development
 * @access Public
 */
router.post('/generate-test-otp',
  authRateLimit,
  authController.generateTestOTP
);

/**
 * @route POST /api/auth/test-email
 * @desc Test email configuration
 * @access Public
 */
router.post('/test-email',
  authRateLimit,
  authController.testEmail
);

/**
 * @route POST /api/auth/google
 * @desc Google OAuth login
 * @access Public
 */
router.post('/google',
  authRateLimit,
  authController.googleLogin
);

/**
 * @route GET /api/auth/profile
 * @desc Get current user profile
 * @access Private
 */
router.get('/profile',
  authenticateToken,
  authController.getProfile
);

/**
 * @route PUT /api/auth/profile
 * @desc Update user profile
 * @access Private
 */
router.put('/profile',
  authenticateToken,
  authController.updateProfile
);

/**
 * @route POST /api/auth/logout
 * @desc Logout user
 * @access Private
 */
router.post('/logout',
  authenticateToken,
  authController.logout
);

/**
 * @route POST /api/auth/refresh
 * @desc Refresh JWT token
 * @access Private
 */
router.post('/refresh',
  authenticateToken,
  authController.refreshToken
);

/**
 * @route GET /api/auth/verify
 * @desc Verify token validity
 * @access Private
 */
router.get('/verify',
  authenticateToken,
  (req, res) => {
    res.json({
      success: true,
      user: {
        _id: req.user._id,
        username: req.user.username,
        email: req.user.email
      }
    });
  }
);

module.exports = router;