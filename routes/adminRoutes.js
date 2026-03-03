const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Profile = require('../models/Profile');
const Subscription = require('../models/Subscription');
const Booking = require('../models/Booking');

// --- Middleware to protect admin routes ---
const protectAdmin = (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            // Uses standard JWT secret. In production, consider a separate ADMIN_JWT_SECRET
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');

            if (decoded.role === 'admin') {
                req.admin = decoded;
                next();
            } else {
                res.status(401).json({ message: 'Not authorized as an admin' });
            }
        } catch (error) {
            console.error(error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    } else {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

/**
 * @route   POST /api/admin/login
 * @desc    Login for Teacher Dashboard returning JWT
 * @access  Public
 */
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Fallback credentials if process.env isn't set
    const adminEmail = process.env.ADMIN_EMAIL || 'teacher@flownest.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'teacher123';

    if (email === adminEmail && password === adminPassword) {
        // Sign token with admin role
        const token = jwt.sign(
            { email: adminEmail, role: 'admin' },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '30d' }
        );
        res.status(200).json({ success: true, token, email: adminEmail, role: 'admin' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid Admin Credentials' });
    }
});

/**
 * @route   GET /api/admin/customers
 * @desc    Get all users (Profiles + their Subscriptions)
 * @access  Private (Admin)
 */
router.get('/customers', protectAdmin, async (req, res) => {
    try {
        const profiles = await Profile.find({}).sort({ createdAt: -1 });
        const subscriptions = await Subscription.find({});

        // Merge profile and subscription status for the list view
        const customers = profiles.map(profile => {
            const userSub = subscriptions.find(s => s.userId === profile._id.toString() || s.userEmail === profile.email);
            return {
                id: profile._id,
                email: profile.email,
                name: profile.name || 'User', // Profile doesn't strictly have a root 'name' property based on schema, might need to pull from auth later if possible, but let's send basics
                createdAt: profile.createdAt,
                subscription: userSub ? {
                    planName: userSub.planName,
                    status: userSub.status,
                    totalSessions: userSub.totalSessions,
                    sessionsUsed: userSub.sessionsUsed,
                    expiryDate: userSub.expiryDate,
                } : null
            };
        });

        res.status(200).json({ success: true, count: customers.length, data: customers });
    } catch (error) {
        console.error('Fetch customers error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch customers' });
    }
});

/**
 * @route   GET /api/admin/customer/:email
 * @desc    Get detailed info for a single customer
 * @access  Private (Admin)
 */
router.get('/customer/:email', protectAdmin, async (req, res) => {
    try {
        const email = req.params.email;
        const profile = await Profile.findOne({ email });

        if (!profile) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }

        // We fetch subcription either by email or guessing userId if profile mapping exists
        // Ideally we'd search by userId if Profile has it. Let's send what we can find.
        const subscription = await Subscription.findOne({ $or: [{ userEmail: email }, { userId: profile._id.toString() }] });
        const bookings = await Booking.find({ userEmail: email }).sort({ date: -1, time: -1 });

        res.status(200).json({
            success: true,
            data: {
                profile,
                subscription: subscription || null,
                bookings
            }
        });
    } catch (error) {
        console.error('Fetch customer detail error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch customer details' });
    }
});

/**
 * @route   PUT /api/admin/booking/:id/meet-link
 * @desc    Update the Google Meet link for a booking
 * @access  Private (Admin)
 */
router.put('/booking/:id/meet-link', protectAdmin, async (req, res) => {
    try {
        const { meetingLink } = req.body;

        if (!meetingLink) {
            return res.status(400).json({ success: false, message: 'Meeting link cannot be empty' });
        }

        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        booking.meetingLink = meetingLink;
        await booking.save();

        res.status(200).json({ success: true, message: 'Meeting link updated successfully', data: booking });

    } catch (error) {
        console.error('Update meet link error:', error);
        res.status(500).json({ success: false, message: 'Failed to update meeting link' });
    }
});

module.exports = router;
