const express = require('express');
const router = express.Router();
const Subscription = require('../models/Subscription');
const { protect } = require('../middleware/authMiddleware');

/**
 * @route   GET /api/payments/subscription
 * @desc    Get current user's subscription status
 * @access  Private
 */
router.get('/status', protect, async (req, res) => {
    try {
        const subscription = await Subscription.findOne({
            where: { userId: req.user.uid }
        });

        if (!subscription) {
            return res.status(200).json({
                success: true,
                data: {
                    planName: 'Free',
                    status: 'inactive',
                    totalSessions: 0,
                    sessionsUsed: 0
                }
            });
        }

        // Auto-expire if past expiryDate and still marked active
        if (subscription.status === 'active' && subscription.expiryDate && new Date(subscription.expiryDate) < new Date()) {
            await subscription.update({ status: 'expired' });
        }

        // Also auto-expire if all sessions are used
        if (subscription.status === 'active' && subscription.totalSessions > 0 && subscription.sessionsUsed >= subscription.totalSessions) {
            await subscription.update({ status: 'expired' });
        }

        const remainingSessions = Math.max(0, (subscription.totalSessions || 0) - (subscription.sessionsUsed || 0));

        res.status(200).json({
            success: true,
            data: {
                ...subscription.toJSON(),
                remainingSessions
            }
        });
    } catch (error) {
        console.error('Fetch subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch subscription status'
        });
    }
});

module.exports = router;
