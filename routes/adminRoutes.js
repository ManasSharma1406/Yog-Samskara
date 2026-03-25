const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Profile = require('../models/Profile');
const { sendBookingEmail } = require('../utils/emailSender');
const Subscription = require('../models/Subscription');
const Booking = require('../models/Booking');
const { admin } = require('../config/firebaseAdmin');

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
 * @desc    Get all users - real-time from DB (Profiles + Bookings) and optionally Firebase Auth
 * @access  Private (Admin)
 */
router.get('/customers', protectAdmin, async (req, res) => {
    try {
        const [profiles, subscriptions, allBookings] = await Promise.all([
            Profile.findAll({ order: [['createdAt', 'DESC']] }),
            Subscription.findAll({}),
            Booking.findAll({ attributes: ['userEmail', 'userName', 'userId'], raw: true })
        ]);
        const seenEmails = new Set();
        const bookingUsers = allBookings.filter(b => {
            const key = (b.userEmail || '').toLowerCase();
            if (!key || seenEmails.has(key)) return false;
            seenEmails.add(key);
            return true;
        });

        const customerMap = new Map();

        const isTestUser = (email, uid) => {
            if (!email) return true;
            const e = (email || '').toLowerCase();
            if (e === 'test@example.com' || e.includes('@example.com')) return true;
            if (uid === 'guest' || !uid) return true;
            return false;
        };

        // 1. Add from Profiles (primary source - has full data)
        profiles.forEach(profile => {
            if (isTestUser(profile.email, profile.userFirebaseUid)) return;
            const userSub = subscriptions.find(s => s.userId === profile.userFirebaseUid);
            customerMap.set(profile.email.toLowerCase(), {
                id: profile.id,
                email: profile.email,
                name: profile.displayName || profile.email?.split('@')[0] || 'User',
                userFirebaseUid: profile.userFirebaseUid,
                createdAt: profile.createdAt,
                hasProfile: true,
                subscription: userSub ? {
                    planName: userSub.planName,
                    status: userSub.status,
                    totalSessions: userSub.totalSessions,
                    sessionsUsed: userSub.sessionsUsed,
                    expiryDate: userSub.expiryDate,
                } : null
            });
        });

        // 2. Add users from Bookings who don't have Profile yet
        bookingUsers.forEach(bu => {
            const key = (bu.userEmail || '').toLowerCase();
            if (!key) return;
            if (!customerMap.has(key)) {
                const userSub = subscriptions.find(s => s.userId === bu.userId);
                customerMap.set(key, {
                    id: null,
                    email: bu.userEmail,
                    name: bu.userName || bu.userEmail?.split('@')[0] || 'User',
                    userFirebaseUid: bu.userId,
                    createdAt: null,
                    hasProfile: false,
                    subscription: userSub ? {
                        planName: userSub.planName,
                        status: userSub.status,
                        totalSessions: userSub.totalSessions,
                        sessionsUsed: userSub.sessionsUsed,
                        expiryDate: userSub.expiryDate,
                    } : null
                });
            }
        });

        // 3. If Firebase Admin has valid credentials, merge in Firebase Auth users not yet in our list
        const hasFirebaseCreds = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS;
        if (admin.apps?.length > 0 && admin.auth && hasFirebaseCreds) {
            try {
                let nextPageToken;
                do {
                    const listResult = await admin.auth().listUsers(1000, nextPageToken);
                    listResult.users.forEach(fbUser => {
                        const email = fbUser.email?.toLowerCase();
                        if (!email || isTestUser(fbUser.email, fbUser.uid)) return;
                        if (!customerMap.has(email)) {
                            const userSub = subscriptions.find(s => s.userId === fbUser.uid);
                            customerMap.set(email, {
                                id: null,
                                email: fbUser.email,
                                name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
                                userFirebaseUid: fbUser.uid,
                                createdAt: fbUser.metadata?.creationTime ? new Date(fbUser.metadata.creationTime) : null,
                                hasProfile: false,
                                subscription: userSub ? {
                                    planName: userSub.planName,
                                    status: userSub.status,
                                    totalSessions: userSub.totalSessions,
                                    sessionsUsed: userSub.sessionsUsed,
                                    expiryDate: userSub.expiryDate,
                                } : null
                            });
                        }
                    });
                    nextPageToken = listResult.pageToken;
                } while (nextPageToken);
            } catch (fbErr) {
                console.warn('Firebase listUsers failed (non-fatal):', fbErr.message);
            }
        }

        const customers = Array.from(customerMap.values()).sort((a, b) => {
            const da = a.createdAt ? new Date(a.createdAt) : new Date(0);
            const db = b.createdAt ? new Date(b.createdAt) : new Date(0);
            return db - da;
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
        const email = decodeURIComponent(req.params.email);
        let profile = await Profile.findOne({ where: { email } });

        if (!profile) {
            const anyBooking = await Booking.findOne({ where: { userEmail: email } });
            if (anyBooking) {
                profile = {
                    id: null,
                    userFirebaseUid: anyBooking.userId,
                    email: anyBooking.userEmail,
                    displayName: anyBooking.userName,
                    goal: null,
                    styleOfYoga: null,
                    medicalCondition: null,
                    annamaya: 5, pranamaya: 5, manomaya: 5, vijnanamaya: 5, anandamaya: 5,
                    isComplete: false
                };
            }
        }

        if (!profile) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }

        const subscription = await Subscription.findOne({
            where: { userId: profile.userFirebaseUid }
        });
        const bookings = await Booking.findAll({
            where: { userEmail: profile.email },
            order: [['date', 'DESC'], ['time', 'DESC']]
        });

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

        const booking = await Booking.findByPk(req.params.id);

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        booking.meetingLink = meetingLink;
        await booking.save();

        // Notify customer via email
        try {
            await sendBookingEmail({
                to: booking.userEmail,
                subject: 'Your Yoga Session - Meeting Link Ready!',
                html: `
                    <div style="font-family: Arial, sans-serif; color: #333;">
                        <h2>Namaste ${booking.userName}!</h2>
                        <p>Your meeting link for your <strong>${booking.sessionType}</strong> session is ready.</p>
                        <div style="background: #f4f4f4; padding: 15px; border-left: 5px solid #000; margin: 20px 0;">
                            <p><strong>Date:</strong> ${booking.date}</p>
                            <p><strong>Time:</strong> ${booking.time}</p>
                            <p><strong>Join your session:</strong> <a href="${meetingLink}" style="color: #000; font-weight: bold;">${meetingLink}</a></p>
                        </div>
                        <p>See you on the mat!</p>
                        <p>Best regards,<br/>YOG SAMSKARA</p>
                    </div>
                `
            });
        } catch (emailErr) {
            console.warn('Meeting link email failed:', emailErr.message);
        }

        res.status(200).json({ success: true, message: 'Meeting link updated successfully', data: booking });

    } catch (error) {
        console.error('Update meet link error:', error);
        res.status(500).json({ success: false, message: 'Failed to update meeting link' });
    }
});

/**
 * @route   GET /api/admin/fix-subscriptions-emergency
 * @desc    Temporary script to fix 0-session subscriptions
 * @access  Public (protected by secret query param)
 */
router.get('/fix-subscriptions-emergency', async (req, res) => {
    if (req.query.secret !== 'yosa-fix-123') {
        return res.status(401).send('Unauthorized');
    }
    try {
        const subscriptions = await Subscription.findAll({
            where: { totalSessions: 0, status: 'active' }
        });
        
        let fixedCount = 0;
        for (const sub of subscriptions) {
            let sessions = 1;
            const planName = sub.planName.toLowerCase();
            if (planName.includes('family')) sessions = 12;
            else if (planName.includes('transformation')) sessions = 36;
            else if (planName.includes('journey')) sessions = 12; // 4-week journey is 12 sessions
            else if (planName.includes('discovery')) sessions = 1;

            const match = planName.match(/(\d+)\s*(?:class|session|pack)/i);
            if (match) {
                sessions = parseInt(match[1], 10);
            }

            sub.totalSessions = sessions;
            // Set expiry to 2 months from today (or from creation)
            const d = new Date(sub.createdAt || new Date());
            d.setMonth(d.getMonth() + 2);
            sub.expiryDate = d;

            await sub.save();
            fixedCount++;
        }
        res.json({ success: true, message: `Fixed ${fixedCount} broken subscriptions` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
