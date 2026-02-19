const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.middleware');

const userController = require('../controllers/user.controller');

/**
 * @route GET /api/users/search
 * @desc Search users by query
 * @access Private
 */
router.get('/search', authenticateToken, (req, res) =>
  userController.searchUsers(req, res)
);

/**
 * @route GET /api/users/u/:username
 * @desc Get public profile by username
 * @access Public
 */
router.get('/u/:username', (req, res) =>
  userController.getUserByUsername(req, res)
);

// Placeholder for future implementation
router.get('/:id', authenticateToken, (req, res) => res.json({ message: 'Not implemented' }));
router.put('/:id', authenticateToken, (req, res) => res.json({ message: 'Not implemented' }));

module.exports = router;