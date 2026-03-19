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

        const profile = await Profile.findOne({ where: { email } });

        if (!profile) {
            return res.status(204).json({
                success: true,
                data: null,
                message: 'Profile doesn\'t exist yet'
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
 * @route   POST /api/profiles/ensure
 * @desc    Create minimal profile from Firebase user if none exists (for new signups)
 * @access  Private
 */
router.post('/ensure', protect, async (req, res) => {
    try {
        const existing = await Profile.findOne({ where: { email: req.user.email } });
        if (existing) {
            return res.status(200).json({ success: true, data: existing, created: false });
        }
        const profile = await Profile.create({
            userFirebaseUid: req.user.uid,
            email: req.user.email,
            displayName: req.user.displayName || req.user.email?.split('@')[0] || 'User',
            isComplete: false
        });
        res.status(201).json({ success: true, data: profile, created: true });
    } catch (error) {
        console.error('Ensure profile error:', error);
        res.status(500).json({ success: false, message: 'Failed to ensure profile' });
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

        // Auto-assign the UID and displayName from auth
        profileData.userFirebaseUid = req.user.uid;
        if (req.user.displayName && !profileData.displayName) {
            profileData.displayName = req.user.displayName;
        }

        let profile = await Profile.findOne({ where: { email: profileData.email } });
        let created = false;
        if (profile) {
            await profile.update(profileData);
        } else {
            profile = await Profile.create(profileData);
            created = true;
        }

        res.status(200).json({
            success: true,
            message: created ? 'Profile created successfully' : 'Profile updated successfully',
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
