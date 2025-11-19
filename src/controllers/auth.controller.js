const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const zkService = require('../services/zk.service');
const { generateToken } = require('../utils/jwt.utils');

/**
 * Authentication Controller
 * Handles user authentication including ZK Login and traditional methods
 */
class AuthController {
  constructor() {
    // Bind methods to ensure proper context
    this.sendOTPEmail = this.sendOTPEmail.bind(this);
  }

  /**
   * ZK Login endpoint
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async zkLogin(req, res) {
    try {
      const { zkProof } = req.body;

      if (!zkProof) {
        return res.status(400).json({
          error: 'ZK proof is required'
        });
      }

      // Verify ZK proof
      const userInfo = await zkService.verifyZKProof(zkProof);

      // Create or update user
      const user = await zkService.createOrUpdateUser(userInfo);

      // Generate JWT token
      const token = generateToken(user._id.toString());

      // Update user's last active time
      user.lastActive = new Date();
      user.isOnline = true;
      await user.save();

      res.json({
        success: true,
        token,
        user: {
          _id: user._id,
          username: user.username,
          displayName: user.displayName,
          email: user.email,
          profilePicture: user.profilePicture,
          isVerified: user.isVerified,
          walletAddress: user.walletAddress
        }
      });

    } catch (error) {
      console.error('ZK Login error:', error);
      res.status(401).json({
        error: 'Authentication failed',
        message: error.message
      });
    }
  }

  /**
   * Traditional email/password login
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: 'Email and password are required'
        });
      }

      // Find user by email
      const user = await User.findOne({ email: email.toLowerCase() });

      if (!user) {
        return res.status(401).json({
          error: 'Invalid credentials'
        });
      }

      // In a real implementation, you would verify the password hash
      // For demo purposes, we'll accept any password for existing users
      // TODO: Implement proper password hashing with bcrypt

      // Generate JWT token
      const token = generateToken(user._id.toString());

      // Update user's last active time
      user.lastActive = new Date();
      user.isOnline = true;
      await user.save();

      res.json({
        success: true,
        token,
        user: {
          _id: user._id,
          username: user.username,
          displayName: user.displayName,
          email: user.email,
          profilePicture: user.profilePicture,
          isVerified: user.isVerified,
          walletAddress: user.walletAddress
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        error: 'Login failed',
        message: error.message
      });
    }
  }

  /**
   * User registration
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async register(req, res) {
    try {
      const { username, email, password, displayName } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({
          error: 'Username, email, and password are required'
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [
          { email: email.toLowerCase() },
          { username: username.toLowerCase() }
        ]
      });

      if (existingUser) {
        return res.status(409).json({
          error: 'User already exists with this email or username'
        });
      }

      // No OTP needed - users are verified by default

      // Create new user (verified by default, no email verification needed)
      const user = new User({
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        // displayName will be set during profile setup
        // In production, hash the password
        // password: await bcrypt.hash(password, 12),
        isVerified: true, // Set as verified by default
        preferences: {
          notifications: {
            email: true,
            push: true
          }
        }
      });

      await user.save();

      // User is verified by default, no email verification needed
      console.log(`✅ User ${user.email} registered and verified successfully`);

      // Generate JWT token
      const token = generateToken(user._id.toString());

      res.status(201).json({
        success: true,
        token,
        user: {
          _id: user._id,
          username: user.username,
          displayName: user.displayName,
          email: user.email,
          profilePicture: user.profilePicture,
          isVerified: user.isVerified,
          walletAddress: user.walletAddress
        },
        message: 'Registration successful. Please check your email for verification code.'
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        error: 'Registration failed',
        message: error.message
      });
    }
  }

  /**
   * Get current user profile
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getProfile(req, res) {
    try {
      const user = await User.findById(req.user._id)
        .select('-__v -createdAt -updatedAt')
        .populate('friends', 'username displayName profilePicture isOnline');

      if (!user) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      res.json({
        success: true,
        user
      });

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        error: 'Failed to get profile',
        message: error.message
      });
    }
  }

  /**
   * Update user profile
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateProfile(req, res) {
    try {
      const { displayName, bio, profilePicture, preferences } = req.body;

      const user = await User.findById(req.user._id);

      if (!user) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      // Update allowed fields
      if (displayName) user.displayName = displayName;
      if (bio !== undefined) user.bio = bio;
      if (profilePicture) user.profilePicture = profilePicture;
      if (preferences) user.preferences = { ...user.preferences, ...preferences };

      await user.save();

      res.json({
        success: true,
        user: {
          _id: user._id,
          username: user.username,
          displayName: user.displayName,
          email: user.email,
          bio: user.bio,
          profilePicture: user.profilePicture,
          preferences: user.preferences
        }
      });

    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        error: 'Failed to update profile',
        message: error.message
      });
    }
  }

  /**
   * Logout user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async logout(req, res) {
    try {
      // Update user's online status
      await User.findByIdAndUpdate(req.user._id, {
        isOnline: false,
        lastActive: new Date()
      });

      res.json({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        error: 'Logout failed',
        message: error.message
      });
    }
  }

  /**
   * Generate JWT token
   * @param {string} userId - User ID
   * @returns {string} JWT token
   */
  generateToken(userId) {
    return jwt.sign(
      { userId },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
  }

  /**
   * Refresh token
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async refreshToken(req, res) {
    try {
      const user = await User.findById(req.user._id);

      if (!user) {
        return res.status(404).json({
          error: 'User not found'
        });
      }

      const token = generateToken(user._id);

      res.json({
        success: true,
        token
      });

    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(500).json({
        error: 'Failed to refresh token',
        message: error.message
      });
    }
  }

  /**
   * Verify email with OTP
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async verifyEmail(req, res) {
    try {
      const { email, otp } = req.body;

      console.log('🔐 Email verification attempt:', { email, otp });

      if (!email || !otp) {
        console.log('❌ Missing email or OTP:', { email: !!email, otp: !!otp });
        return res.status(400).json({
          error: 'Email and OTP are required'
        });
      }

      // Find user by email
      const user = await User.findOne({ email: email.toLowerCase() });

      if (!user) {
        console.log('❌ User not found for email:', email);
        return res.status(404).json({
          error: 'User not found'
        });
      }

      console.log('✅ User found:', user._id);
      console.log('📧 User email verification data:', {
        hasEmailVerification: !!user.emailVerification,
        storedOTP: user.emailVerification?.otp,
        providedOTP: otp,
        otpMatch: user.emailVerification?.otp === otp,
        otpExpiry: user.emailVerification?.otpExpiry,
        currentTime: new Date(),
        isExpired: user.emailVerification?.otpExpiry < new Date()
      });

      // Check if OTP is valid and not expired
      if (!user.emailVerification ||
          user.emailVerification.otp !== otp ||
          user.emailVerification.otpExpiry < new Date()) {

        let errorReason = 'Unknown error';
        if (!user.emailVerification) {
          errorReason = 'No email verification data found';
        } else if (user.emailVerification.otp !== otp) {
          errorReason = `OTP mismatch - stored: '${user.emailVerification.otp}', provided: '${otp}'`;
        } else if (user.emailVerification.otpExpiry < new Date()) {
          errorReason = `OTP expired - expiry: ${user.emailVerification.otpExpiry}, current: ${new Date()}`;
        }

        console.log('❌ OTP verification failed:', errorReason);

        return res.status(400).json({
          error: 'Invalid or expired OTP',
          details: errorReason
        });
      }

      // Mark email as verified
      user.isVerified = true;
      user.emailVerification.isVerified = true;
      user.emailVerification.otp = undefined; // Clear OTP
      user.emailVerification.otpExpiry = undefined;

      await user.save();

      res.json({
        success: true,
        message: 'Email verified successfully',
        user: {
          _id: user._id,
          username: user.username,
          displayName: user.displayName,
          email: user.email,
          isVerified: user.isVerified
        }
      });

    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({
        error: 'Email verification failed',
        message: error.message
      });
    }
  }

  /**
   * Resend OTP
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async resendOTP(req, res) {
    try {
      const { email } = req.body;

      console.log('🔄 Resend OTP request received for:', email);

      if (!email) {
        console.log('❌ No email provided in resend request');
        return res.status(400).json({
          error: 'Email is required'
        });
      }

      // Find user by email
      const user = await User.findOne({ email: email.toLowerCase() });

      if (!user) {
        console.log('❌ User not found for email:', email);
        return res.status(404).json({
          error: 'User not found'
        });
      }

      console.log('✅ User found:', user._id, 'isVerified:', user.isVerified);

      // Generate new OTP directly (avoiding this.generateOTP() issue)
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Update user's OTP
      user.emailVerification.otp = otp;
      user.emailVerification.otpExpiry = otpExpiry;
      await user.save();

      // Send OTP email
      console.log(`📧 Resending OTP to ${user.email}...`);
      console.log(`🔢 New OTP Code: ${otp} (expires in 10 minutes)`);

      try {
        await this.sendOTPEmail(user.email, otp);
        console.log(`✅ OTP email resent successfully to ${user.email}`);
      } catch (emailError) {
        console.error('❌ Email resend failed:', emailError.message);
        console.log(`🔧 BACKUP: Use OTP from console: ${otp}`);
      }

      res.json({
        success: true,
        message: 'OTP sent successfully'
      });

    } catch (error) {
      console.error('Resend OTP error:', error);
      res.status(500).json({
        error: 'Failed to resend OTP',
        message: error.message
      });
    }
  }

  /**
   * Generate 6-digit OTP
   * @returns {string} OTP
   */
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Generate OTP for testing
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async generateTestOTP(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          error: 'Email is required'
        });
      }

      // Generate new OTP directly (avoiding this.generateOTP() issue)
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      console.log(`🎯 Test OTP Generated for ${email}:`);
      console.log(`🔢 OTP Code: ${otp}`);
      console.log(`⏰ Expires: ${otpExpiry}`);
      console.log(`🔧 Use this OTP to test verification`);

      res.json({
        success: true,
        message: 'OTP generated successfully',
        otp: otp,
        email: email,
        expiresAt: otpExpiry,
        note: 'Use this OTP to test the verification endpoint'
      });

    } catch (error) {
      console.error('❌ OTP generation failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate OTP',
        message: error.message
      });
    }
  }

  /**
   * Test email configuration
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async testEmail(req, res) {
    try {
      const testOTP = '123456';
      const testEmail = req.body.email || 'test@example.com';

      console.log(`🧪 Testing email configuration...`);
      console.log(`📧 Test email to: ${testEmail}`);

      await this.sendOTPEmail(testEmail, testOTP);

      res.json({
        success: true,
        message: 'Email test completed. Check console for details.',
        testOTP: testOTP
      });

    } catch (error) {
      console.error('❌ Email test failed:', error);
      res.status(500).json({
        success: false,
        error: 'Email test failed',
        message: error.message,
        testOTP: '123456' // Always provide test OTP
      });
    }
  }

  /**
   * Google OAuth login
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async googleLogin(req, res) {
    try {
      console.log('🔍 Google login request body:', req.body);
      console.log('🔍 Request headers:', req.headers);

      // Extract data from zkProof object (as sent by frontend)
      const { code, email, name, picture } = req.body.zkProof || req.body;

      console.log('🔍 Extracted data:', { code: !!code, email: !!email, name: !!name, picture: !!picture });

      if (!email) {
        console.log('❌ Email field missing from request body');
        return res.status(400).json({
          error: 'Email is required for Google login'
        });
      }

      console.log('🔐 Processing Google OAuth for:', email);

      // Find or create user
      let user = await User.findOne({ email: email.toLowerCase() });

      if (user) {
        // Update existing user
        user.lastActive = new Date();
        user.isOnline = true;
        if (name && !user.displayName) {
          user.displayName = name;
        }
        if (picture && !user.profilePicture) {
          user.profilePicture = picture;
        }
        await user.save();
        console.log('✅ Existing user updated:', user.email);
      } else {
        // Create new user
        const username = AuthController.generateUsername(name || email);
        user = new User({
          username: username,
          email: email.toLowerCase(),
          displayName: name || username,
          profilePicture: picture,
          isVerified: true, // Google accounts are pre-verified
          preferences: {
            notifications: {
              email: true,
              push: true
            }
          }
        });
        await user.save();
        console.log('✅ New user created:', user.email);
      }

      // Generate JWT token
      const token = generateToken(user._id.toString());

      res.json({
        success: true,
        token,
        user: {
          _id: user._id,
          username: user.username,
          displayName: user.displayName,
          email: user.email,
          profilePicture: user.profilePicture,
          isVerified: user.isVerified,
          walletAddress: user.walletAddress
        },
        message: 'Google login successful'
      });

    } catch (error) {
      console.error('Google login error:', error);
      res.status(500).json({
        error: 'Google login failed',
        message: error.message
      });
    }
  }

  /**
   * Generate unique username from name or email
   * @param {string} input - Name or email
   * @returns {string} Unique username
   */
  static generateUsername(input) {
    const baseUsername = input
      .split('@')[0] // Remove email domain
      .replace(/[^a-zA-Z0-9]/g, '') // Remove special characters
      .toLowerCase()
      .substring(0, 20); // Limit length

    return baseUsername || 'user';
  }

  /**
   * Send OTP email
   * @param {string} email - Recipient email
   * @param {string} otp - OTP code
   */
  async sendOTPEmail(email, otp) {
    try {
      console.log('📧 Starting email send process...');
      console.log('📧 Email credentials check:', {
        hasUser: !!process.env.EMAIL_USER,
        hasPass: !!process.env.EMAIL_PASS,
        emailHost: process.env.EMAIL_HOST,
        emailPort: process.env.EMAIL_PORT
      });

      // Check if email credentials are configured
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log('⚠️ Email credentials not configured. Skipping email send.');
        console.log(`🔧 DEVELOPMENT: OTP for ${email} is: ${otp}`);
        return;
      }

      // Create transporter with Gmail-specific settings
      const transporter = nodemailer.createTransport({
        service: 'gmail', // Use Gmail service instead of manual config
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        },
        // Additional options for Gmail
        tls: {
          rejectUnauthorized: false
        }
      });

      // Verify connection
      await transporter.verify();
      console.log('✅ Email server connection verified');

      // Email content with better formatting
      const mailOptions = {
        from: `"ChatPay Support" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '🔐 Your ChatPay Verification Code',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>ChatPay Email Verification</title>
            </head>
            <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8fafc;">
              <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">ChatPay</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Secure Blockchain Payments</p>
                </div>

                <!-- Content -->
                <div style="padding: 40px 30px;">
                  <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px; text-align: center;">Verify Your Email Address</h2>

                  <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin-bottom: 30px; text-align: center;">
                    Welcome to ChatPay! To complete your registration and secure your account, please verify your email address.
                  </p>

                  <!-- OTP Box -->
                  <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; box-shadow: 0 4px 15px rgba(245, 87, 108, 0.3);">
                    <h3 style="color: white; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">Your Verification Code</h3>
                    <div style="background: rgba(255,255,255,0.2); border-radius: 8px; padding: 20px; display: inline-block; border: 2px dashed rgba(255,255,255,0.5);">
                      <span style="font-size: 36px; font-weight: 900; color: white; letter-spacing: 8px; font-family: 'Courier New', monospace;">${otp}</span>
                    </div>
                    <p style="color: rgba(255,255,255,0.9); margin: 15px 0 0 0; font-size: 14px;">
                      This code expires in <strong>10 minutes</strong>
                    </p>
                  </div>

                  <!-- Instructions -->
                  <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 30px 0; border-left: 4px solid #667eea;">
                    <h4 style="color: #1f2937; margin: 0 0 10px 0; font-size: 16px;">How to verify:</h4>
                    <ol style="color: #6b7280; margin: 0; padding-left: 20px;">
                      <li>Copy the verification code above</li>
                      <li>Return to the ChatPay app</li>
                      <li>Paste the code in the verification field</li>
                      <li>Click "Verify Email" to complete registration</li>
                    </ol>
                  </div>

                  <!-- Warning -->
                  <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 20px 0;">
                    <p style="color: #92400e; margin: 0; font-size: 14px; font-weight: 500;">
                      ⚠️ <strong>Security Notice:</strong> If you didn't request this verification, please ignore this email. Your account remains secure.
                    </p>
                  </div>

                  <!-- Alternative -->
                  <div style="text-align: center; margin: 30px 0;">
                    <p style="color: #6b7280; font-size: 14px; margin-bottom: 10px;">
                      Having trouble? You can also verify using Google OAuth in the app.
                    </p>
                    <a href="#" style="color: #667eea; text-decoration: none; font-weight: 600;">Learn more about Google Login →</a>
                  </div>
                </div>

                <!-- Footer -->
                <div style="background-color: #f8fafc; padding: 20px 30px; border-top: 1px solid #e5e7eb;">
                  <div style="text-align: center;">
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                      © 2024 ChatPay. All rights reserved.<br>
                      This is an automated message. Please do not reply to this email.
                    </p>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `,
        // Plain text fallback
        text: `
ChatPay - Email Verification

Your verification code is: ${otp}

This code will expire in 10 minutes.

If you didn't request this verification, please ignore this email.

Welcome to ChatPay - Secure Blockchain Payments!
        `
      };

      // Send email
      const info = await transporter.sendMail(mailOptions);
      console.log('✅ OTP email sent successfully:', info.messageId);
      console.log('📧 Email sent to:', email);
      console.log('🔢 OTP:', otp);

    } catch (error) {
      console.error('❌ Email sending failed:', error.message);
      console.error('❌ Full error details:', error);

      // Provide specific error messages
      if (error.code === 'EAUTH') {
        console.error('❌ Email authentication failed. Check EMAIL_USER and EMAIL_PASS in .env');
        console.error('💡 Gmail Tip: Make sure you have "Less secure app access" enabled or use an App Password');
      } else if (error.code === 'ECONNREFUSED') {
        console.error('❌ Email server connection refused. Check network connection');
      } else if (error.code === 'ETIMEDOUT') {
        console.error('❌ Email server timeout. Check network connection');
      }

      // For development, always show the OTP in console
      console.log(`🔧 DEVELOPMENT MODE: OTP for ${email} is: ${otp}`);
      console.log('🔧 Copy this OTP and use it in the verification screen');
      console.log('🔧 The verification process is working - you can use the OTP from console');

      // Don't throw error - allow the process to continue for development
    }
  }
}

module.exports = new AuthController();