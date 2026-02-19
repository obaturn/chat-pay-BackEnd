const User = require('../models/User');

class UserController {
    /**
     * Search users by username, email, or displayName
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async searchUsers(req, res) {
        try {
            const { q } = req.query;

            if (!q || q.length < 2) {
                return res.status(400).json({
                    error: 'Search query must be at least 2 characters'
                });
            }

            // Exclude current user from results
            const currentUserId = req.user._id;

            const users = await User.find({
                _id: { $ne: currentUserId },
                $or: [
                    { username: new RegExp(q, 'i') },
                    { displayName: new RegExp(q, 'i') },
                    { email: new RegExp(q, 'i') }
                ]
            })
                .select('username displayName profilePicture isOnline')
                .limit(20);

            res.json({
                success: true,
                users
            });
        } catch (error) {
            console.error('Search users error:', error);
            res.status(500).json({
                error: 'Search failed',
                message: error.message
            });
        }
    }

    /**
     * Get user profile by username (Public/Shared Link)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getUserByUsername(req, res) {
        try {
            const { username } = req.params;

            const user = await User.findOne({ username: new RegExp(`^${username}$`, 'i') })
                .select('username displayName profilePicture bio isOnline createdAt');

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
            console.error('Get user by username error:', error);
            res.status(500).json({
                error: 'Failed to fetch user',
                message: error.message
            });
        }
    }
}

module.exports = new UserController();
