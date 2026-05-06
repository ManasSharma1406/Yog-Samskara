const express = require('express');
const router = express.Router();
const FcmToken = require('../models/FcmToken');
const { protect } = require('../middleware/authMiddleware');

/**
 * @route   POST /api/users/fcm-token
 * @desc    Upsert an FCM token for a user
 * @access  Private
 */
router.post('/fcm-token', protect, async (req, res) => {
    try {
        const { userId, token } = req.body;

        if (!userId || !token) {
            return res.status(400).json({
                success: false,
                message: 'userId and token are required'
            });
        }

        // Validate that the user is updating their own token
        // Fallback or override userId with the authenticated user's uid to be secure
        const targetUserId = req.user.uid;

        // Using upsert isn't directly matching the unique constraint with just user ID in Sequelize 
        // without specifying the unique key, so we use findOrCreate or manual lookup.
        const [fcmToken, created] = await FcmToken.findOrCreate({
            where: { userId: targetUserId, token: token },
            defaults: {
                userId: targetUserId,
                token: token
            }
        });

        if (!created) {
            // Update the updated_at timestamp
            fcmToken.changed('updatedAt', true);
            await fcmToken.save();
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error saving FCM token:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
