const express = require('express');
const router = express.Router();
const Profile = require('../models/Profile');
const { protect } = require('../middleware/authMiddleware');
const { notifyCustomerSignup } = require('../services/notifier');
const { sendWelcomeEmail } = require('../utils/mailer');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

// Stricter rate limit for profile updates to prevent email spam
const profileUpdateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit each IP to 10 profile updates per hour
    message: 'Too many profile updates, please try again after an hour'
});

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
router.post('/ensure', [
    protect,
    profileUpdateLimiter,
    body('firstName').optional().trim().escape(),
    body('lastName').optional().trim().escape(),
    body('whatsappNumber').optional().trim().isMobilePhone().withMessage('Invalid WhatsApp number')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    try {
        const existing = await Profile.findOne({ where: { email: req.user.email } });
        if (existing) {
            return res.status(200).json({ success: true, data: existing, created: false });
        }
        const { whatsappNumber, firstName, lastName } = req.body;
        const profile = await Profile.create({
            userFirebaseUid: req.user.uid,
            email: req.user.email,
            displayName: req.user.displayName || req.user.email?.split('@')[0] || 'User',
            firstName: firstName || '',
            lastName: lastName || '',
            whatsappNumber: whatsappNumber || '',
            isComplete: false
        });
        
        try {
            await sendWelcomeEmail(profile.email, profile.firstName || profile.displayName);
        } catch (emailErr) {
            console.error('Failed to send welcome email:', emailErr);
        }

        if (profile.whatsappNumber) {
            try {
                const { sendWhatsAppMessage } = require('../utils/whatsappSender');
                await sendWhatsAppMessage(profile.whatsappNumber, `Namaste ${profile.firstName || profile.displayName}!\n\nWelcome to Yog Samskara. We're thrilled to be part of your wellness journey. Book your first class today and let the transformation begin!`);
            } catch (waErr) {
                console.error('Failed to send WhatsApp welcome:', waErr);
            }
        }
        
        notifyCustomerSignup({ 
            name: profile.firstName || profile.displayName, 
            email: profile.email, 
            fcmTokens: [] 
        }).catch(console.error);

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
router.post('/update', [
    protect,
    profileUpdateLimiter,
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('firstName').optional().trim().escape(),
    body('lastName').optional().trim().escape(),
    body('whatsappNumber').optional().trim().isMobilePhone().withMessage('Invalid WhatsApp number')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
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
            try {
                await sendWelcomeEmail(profile.email, profile.firstName || profile.displayName || 'User');
            } catch (emailErr) {
                console.error('Failed to send welcome email:', emailErr);
            }
            if (profile.whatsappNumber) {
                try {
                    const { sendWhatsAppMessage } = require('../utils/whatsappSender');
                    await sendWhatsAppMessage(profile.whatsappNumber, `Namaste ${profile.firstName || profile.displayName || 'User'}!\n\nWelcome to Yog Samskara. We're thrilled to be part of your wellness journey. Book your first class today and let the transformation begin!`);
                } catch (waErr) {
                    console.error('Failed to send WhatsApp welcome:', waErr);
                }
            }
            
            notifyCustomerSignup({ 
                name: profile.firstName || profile.displayName || 'User', 
                email: profile.email, 
                fcmTokens: [] 
            }).catch(console.error);
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
