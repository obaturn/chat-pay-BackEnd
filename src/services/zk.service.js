const { jwtVerify } = require('jose');
const User = require('../models/User');

/**
 * ZK Login Service
 * Handles verification of ZK Login proofs from various providers
 */
class ZKLoginService {
  constructor() {
    // ZK Login configuration - Google only
    this.providers = {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        issuer: 'https://accounts.google.com'
      }
    };
  }

  /**
   * Verify ZK Login proof
   * @param {Object} zkProof - The ZK proof from the frontend
   * @returns {Object} User information
   */
  async verifyZKProof(zkProof) {
    try {
      const { jwt, provider } = zkProof;

      if (!jwt || !provider) {
        throw new Error('Invalid ZK proof: missing jwt or provider');
      }

      if (!this.providers[provider]) {
        throw new Error(`Unsupported provider: ${provider}`);
      }

      // Verify the JWT
      const { payload } = await jwtVerify(
        jwt,
        this.getProviderKey(provider),
        {
          issuer: this.providers[provider].issuer,
          audience: this.providers[provider].clientId
        }
      );

      // Extract user information
      const userInfo = this.extractUserInfo(payload, provider);

      return {
        ...userInfo,
        provider,
        zkLoginId: payload.sub // Unique identifier for ZK Login
      };

    } catch (error) {
      console.error('ZK Login verification failed:', error);
      throw new Error(`ZK Login verification failed: ${error.message}`);
    }
  }

  /**
   * Get the public key for JWT verification
   * @param {string} provider - The OAuth provider
   * @returns {KeyLike} The public key
   */
  getProviderKey(provider) {
    // In production, you would fetch the public keys from the provider's JWKS endpoint
    // For now, we'll use a mock implementation
    switch (provider) {
      case 'google':
        return this.getGooglePublicKey();
      case 'apple':
        return this.getApplePublicKey();
      case 'twitter':
        return this.getTwitterPublicKey();
      default:
        throw new Error(`No public key available for provider: ${provider}`);
    }
  }

  /**
   * Extract user information from JWT payload
   * @param {Object} payload - JWT payload
   * @param {string} provider - OAuth provider
   * @returns {Object} Standardized user info
   */
  extractUserInfo(payload, provider) {
    const baseInfo = {
      id: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified || false
    };

    switch (provider) {
      case 'google':
        return {
          ...baseInfo,
          name: payload.name,
          givenName: payload.given_name,
          familyName: payload.family_name,
          picture: payload.picture,
          locale: payload.locale
        };

      case 'apple':
        return {
          ...baseInfo,
          name: payload.name || 'Apple User'
        };

      case 'twitter':
        return {
          ...baseInfo,
          name: payload.name || payload.screen_name,
          username: payload.screen_name,
          picture: payload.profile_image_url_https
        };

      default:
        return baseInfo;
    }
  }

  /**
   * Create or update user from ZK Login info
   * @param {Object} userInfo - User info from ZK Login
   * @returns {Object} User document
   */
  async createOrUpdateUser(userInfo) {
    try {
      let user = await User.findOne({ zkLoginId: userInfo.zkLoginId });

      if (user) {
        // Update existing user
        user.email = userInfo.email;
        user.displayName = userInfo.name;
        user.lastActive = new Date();
        await user.save();
      } else {
        // Check if user exists with same email
        const existingUser = await User.findOne({ email: userInfo.email });

        if (existingUser) {
          // Link ZK Login to existing account
          existingUser.zkLoginId = userInfo.zkLoginId;
          existingUser.lastActive = new Date();
          user = await existingUser.save();
        } else {
          // Create new user
          user = new User({
            zkLoginId: userInfo.zkLoginId,
            username: this.generateUsername(userInfo.name || userInfo.email),
            email: userInfo.email,
            displayName: userInfo.name,
            profilePicture: userInfo.picture,
            isVerified: userInfo.emailVerified || false,
            preferences: {
              notifications: {
                email: true,
                push: true
              }
            }
          });
          await user.save();
        }
      }

      return user;
    } catch (error) {
      console.error('Error creating/updating user:', error);
      throw new Error('Failed to create or update user account');
    }
  }

  /**
   * Generate a unique username from name or email
   * @param {string} input - Name or email
   * @returns {string} Unique username
   */
  async generateUsername(input) {
    const baseUsername = input
      .split('@')[0] // Remove email domain
      .replace(/[^a-zA-Z0-9]/g, '') // Remove special characters
      .toLowerCase()
      .substring(0, 20); // Limit length

    let username = baseUsername;
    let counter = 1;

    while (await User.findOne({ username })) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    return username;
  }

  /**
   * Mock public key getters (replace with real JWKS fetching in production)
   */
  getGooglePublicKey() {
    // In production, fetch from https://www.googleapis.com/oauth2/v3/certs
    return 'mock-google-public-key';
  }

  getApplePublicKey() {
    // In production, fetch from https://appleid.apple.com/auth/keys
    return 'mock-apple-public-key';
  }

  getTwitterPublicKey() {
    // In production, fetch from Twitter's JWKS endpoint
    return 'mock-twitter-public-key';
  }

  /**
   * Validate ZK Login session
   * @param {string} sessionId - Session identifier
   * @returns {boolean} Is session valid
   */
  async validateSession(sessionId) {
    // Implement session validation logic
    // Check if session exists and hasn't expired
    return true; // Mock implementation
  }
}

module.exports = new ZKLoginService();