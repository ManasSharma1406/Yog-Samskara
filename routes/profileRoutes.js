const express = require('express');
const router = express.Router();
const Profile = require('../models/Profile');
const { protect } = require('../middleware/authMiddleware');

/**
 * @route   GET /api/profiles/:email
 * @desc    Get user profile by email
 * @access  Private
 */
router.get('/:email', protect, async (req, res) => {
    try {
        const { email } = req.params;

        // Ensure user can only fetch their own profile
        if (req.user.email !== email) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access this profile'
            });
        }

        const profile = await Profile.findOne({ email });

        if (!profile) {
            return res.status(404).json({
                success: false,
                message: 'Profile not found'
            });
        }

        res.status(200).json({
            success: true,
            data: profile
        });
    } catch (error) {
        console.error('Fetch profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch profile',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/profiles/update
 * @desc    Create or update user profile
 * @access  Private
 */
router.post('/update', protect, async (req, res) => {
    try {
        const profileData = req.body;

        if (!profileData.email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // Ensure user can only update their own profile
        if (req.user.email !== profileData.email) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this profile'
            });
        }

        const profile = await Profile.findOneAndUpdate(
            { email: profileData.email },
            profileData,
            { new: true, upsert: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: profile
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile',
            error: error.message
        });
    }
});

module.exports = router;
