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

        res.status(200).json({
            success: true,
            data: subscription
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
