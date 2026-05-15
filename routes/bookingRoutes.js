const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Subscription = require('../models/Subscription');
const { protect } = require('../middleware/authMiddleware');
const { sendBookingConfirmation } = require('../utils/mailer');
const { notifyCustomerBooking, notifyInstructorBooking, notifyCustomerCancellation, getFcmTokens } = require('../services/notifier');
const { body, validationResult } = require('express-validator');

const isTodayOrPastDate = (dateInput) => {
    const selected = new Date(dateInput);
    if (Number.isNaN(selected.getTime())) return true;
    selected.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selected <= today;
};

/**
 * @route   POST /api/bookings/create
 * @desc    Create a booking and verify subscription
 * @access  Private
 */
router.post('/create', [
    protect,
    body('date').trim().notEmpty().withMessage('Date is required').isISO8601().withMessage('Invalid date format'),
    body('time').trim().notEmpty().withMessage('Time is required'),
    body('userName').trim().notEmpty().withMessage('User name is required').isLength({ min: 2 }).withMessage('Name too short'),
    body('userEmail').trim().isEmail().withMessage('Valid email is required'),
    body('sessionType').optional().trim(),
    body('focusArea').optional().trim(),
    body('intensity').optional().isInt({ min: 0, max: 100 }).withMessage('Intensity must be between 0 and 100')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    console.log('--- NEW BOOKING REQUEST ---');
    console.log('User:', req.user.email);
    try {
        const {
            date,
            time,
            userName,
            userEmail,
            sessionType,
            focusArea,
            intensity,
            status
        } = req.body;

        // Ensure user can only book for themselves
        if (req.user.email !== userEmail) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to book for another user'
            });
        }

        // Validate required fields
        if (!date || !time || !userName || !userEmail) {
            return res.status(400).json({
                success: false,
                message: 'Missing required booking information'
            });
        }

        if (isTodayOrPastDate(date)) {
            return res.status(400).json({
                success: false,
                message: 'Same-day or past-date bookings are not allowed. Please select a future date.'
            });
        }

        // Check subscription status
        const subscription = await Subscription.findOne({ where: { userId: req.user.uid } });

        if (!subscription || subscription.status !== 'active') {
            return res.status(403).json({
                success: false,
                message: 'No active subscription found. Please purchase a plan to book sessions.'
            });
        }

        // Check session limits for private sessions
        if (sessionType !== 'Group Class' && subscription.sessionsUsed >= subscription.totalSessions) {
            return res.status(403).json({
                success: false,
                message: 'Session limit reached for your current plan.'
            });
        }

        // Prepare booking data
        const bookingData = {
            userId: req.user.uid,
            userName,
            userEmail,
            date,
            time,
            sessionType: sessionType || '1:1 Coaching',
            focusArea: focusArea || 'Mindfulness',
            intensity: intensity || 50,
            status: status || 'confirmed',
            meetingLink: "https://meet.google.com/ngs-doim-gqq"
        };

        // Save to Postgres
        const booking = await Booking.create(bookingData);

        // Increment sessions used if it's a private session
        if (sessionType !== 'Group Class') {
            subscription.sessionsUsed += 1;
            await subscription.save();
        }

        // Send confirmation email
        try {
            await sendBookingConfirmation(userEmail, {
                userName,
                className: sessionType,
                date,
                time,
                zoomLink: booking.meetingLink
            });
        } catch (emailErr) {
            console.error('Email sending failed:', emailErr);
        }

        try {
            const Profile = require('../models/Profile');
            const { sendWhatsAppMessage } = require('../utils/whatsappSender');
            const profile = await Profile.findOne({ where: { email: userEmail } });

            // Notify Student
            if (profile && profile.whatsappNumber) {
                const message = `Namaste ${profile.firstName || userName}!\n\nYour ${sessionType} session on ${date} at ${time} is confirmed! 🧘\n\nMeeting link: ${booking.meetingLink}\n\nSee you on the mat!`;
                await sendWhatsAppMessage(profile.whatsappNumber, message);
            }

            // Notify Instructor via WhatsApp
            const instructorPhone = process.env.INSTRUCTOR_PHONE_NUMBER;
            if (instructorPhone) {
                const instructorMsg = `New Booking Alert 🔔\n\nStudent: ${profile?.firstName || userName} (${userEmail})\nSession: ${sessionType}\nDate: ${date}\nTime: ${time}`;
                await sendWhatsAppMessage(instructorPhone, instructorMsg);
            }
            
            // FCM & Email Notifications
            const customerTokens = await getFcmTokens(req.user.uid);
            notifyCustomerBooking({
                name: profile?.firstName || userName,
                email: userEmail,
                fcmTokens: customerTokens,
                className: sessionType,
                instructorName: 'YogSamskara Instructor',
                date,
                time,
                zoomLink: booking.meetingLink
            }).catch(console.error);

            // Instructor Notification (using hardcoded instructor details or admin role)
            const instructorEmail = process.env.ADMIN_EMAIL || 'teacher@yogsamskara.com';
            // We'll query User table to get the admin's UID and then FCM tokens if possible.
            // But since we don't know the exact UID, we'll fetch tokens for a known admin UID if available, 
            // or pass empty array to just send an email.
            try {
                const User = require('../models/User');
                const adminUser = await User.findOne({ where: { email: instructorEmail } });
                let instructorTokens = [];
                if (adminUser) {
                    instructorTokens = await getFcmTokens(adminUser.firebaseUid);
                }
                notifyInstructorBooking({
                    instructorEmail: instructorEmail,
                    instructorFcmTokens: instructorTokens,
                    instructorName: 'Instructor',
                    studentName: profile?.firstName || userName,
                    className: sessionType,
                    date,
                    time
                }).catch(console.error);
            } catch (err) {
                console.error('Error fetching admin for instructor notification', err);
            }

        } catch (waErr) {
            console.error('WhatsApp booking confirmation failed:', waErr);
        }

        res.status(201).json({
            success: true,
            message: 'Booking confirmed',
            data: booking
        });

    } catch (error) {
        console.error('Booking creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create booking',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/bookings/bulk-create
 * @desc    Create multiple bookings at once
 * @access  Private
 */
router.post('/bulk-create', [
    protect,
    body('bookings').isArray({ min: 1 }).withMessage('At least one booking is required'),
    body('bookings.*.date').trim().notEmpty().isISO8601().withMessage('Invalid date format'),
    body('bookings.*.time').trim().notEmpty().withMessage('Time is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    console.log('--- NEW BULK BOOKING REQUEST ---');
    console.log('User:', req.user.email);
    
    try {
        const { bookings } = req.body;
        
        if (!bookings || !Array.isArray(bookings) || bookings.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Missing or invalid bookings data'
            });
        }

        const subscription = await Subscription.findOne({ where: { userId: req.user.uid } });

        if (!subscription || subscription.status !== 'active') {
            return res.status(403).json({
                success: false,
                message: 'No active subscription found. Please purchase a plan to book sessions.'
            });
        }

        const privateSessionCount = bookings.filter(b => b.sessionType !== 'Group Class').length;

        for (const slot of bookings) {
            if (isTodayOrPastDate(slot.date)) {
                return res.status(400).json({
                    success: false,
                    message: 'Same-day or past-date bookings are not allowed in bulk booking.'
                });
            }
        }

        if (subscription.sessionsUsed + privateSessionCount > subscription.totalSessions) {
            return res.status(403).json({
                success: false,
                message: `Session limit exceeded. You are trying to book ${privateSessionCount} sessions but only have ${subscription.totalSessions - subscription.sessionsUsed} remaining.`
            });
        }

        const userEmail = req.user.email;
        let userName = userEmail.split('@')[0];
        
        try {
            const Profile = require('../models/Profile');
            const profile = await Profile.findOne({ where: { email: userEmail } });
            if (profile && profile.fullName) {
                userName = profile.fullName;
            }
        } catch (err) {
            console.log("Could not fetch profile for username", err.message);
        }

        const createdBookings = [];
        for (const slot of bookings) {
            const bookingData = {
                userId: req.user.uid,
                userName,
                userEmail,
                date: slot.date,
                time: slot.time,
                sessionType: slot.sessionType || 'Private 1:1 Session',
                focusArea: slot.focusArea || 'Mindfulness',
                intensity: slot.intensity || 50,
                status: 'confirmed',
                meetingLink: "https://meet.google.com/ngs-doim-gqq"
            };

            const booking = await Booking.create(bookingData);
            createdBookings.push(booking);
        }

        if (privateSessionCount > 0) {
            subscription.sessionsUsed += privateSessionCount;
            await subscription.save();
        }

        try {
            await sendBookingConfirmation(userEmail, {
                userName,
                className: `${createdBookings.length}x Sessions`,
                date: 'Multiple Dates',
                time: 'Multiple Times',
                zoomLink: "https://meet.google.com/ngs-doim-gqq"
            });
        } catch (emailErr) {
            console.error('Email sending failed for bulk booking:', emailErr);
        }

        try {
            const Profile = require('../models/Profile');
            const { sendWhatsAppMessage } = require('../utils/whatsappSender');
            const profile = await Profile.findOne({ where: { email: userEmail } });

            // Notify Student
            if (profile && profile.whatsappNumber) {
                const message = `Namaste ${profile.firstName || userName}!\n\nYour ${createdBookings.length} sessions have been confirmed! 🧘\n\nYou have ${subscription.totalSessions - subscription.sessionsUsed} sessions remaining.\n\nSee you on the mat!`;
                await sendWhatsAppMessage(profile.whatsappNumber, message);
            }

            // Notify Instructor via WhatsApp
            const instructorPhone = process.env.INSTRUCTOR_PHONE_NUMBER;
            if (instructorPhone) {
                const instructorMsg = `New Bulk Booking Alert 🔔\n\nStudent: ${profile?.firstName || userName} (${userEmail})\nBooked ${createdBookings.length} sessions.`;
                await sendWhatsAppMessage(instructorPhone, instructorMsg);
            }
            
            // FCM & Email Notifications
            const customerTokens = await getFcmTokens(req.user.uid);
            // Just notify for the first booking to avoid spamming 10 emails/pushes at once, 
            // or send a consolidated one. Since we don't have a bulk notify function, 
            // we will send one notification using the first booking's details, but indicating multiple.
            if (createdBookings.length > 0) {
                const firstB = createdBookings[0];
                notifyCustomerBooking({
                    name: profile?.firstName || userName,
                    email: userEmail,
                    fcmTokens: customerTokens,
                    className: `${createdBookings.length}x ${firstB.sessionType}`,
                    instructorName: 'YogSamskara Instructor',
                    date: 'Multiple Dates',
                    time: 'Multiple Times',
                    zoomLink: firstB.meetingLink
                }).catch(console.error);

                // Instructor Notification
                const instructorEmail = process.env.ADMIN_EMAIL || 'teacher@yogsamskara.com';
                try {
                    const User = require('../models/User');
                    const adminUser = await User.findOne({ where: { email: instructorEmail } });
                    let instructorTokens = [];
                    if (adminUser) {
                        instructorTokens = await getFcmTokens(adminUser.firebaseUid);
                    }
                    notifyInstructorBooking({
                        instructorEmail: instructorEmail,
                        instructorFcmTokens: instructorTokens,
                        instructorName: 'Instructor',
                        studentName: profile?.firstName || userName,
                        className: `${createdBookings.length}x ${firstB.sessionType}`,
                        date: 'Multiple Dates',
                        time: 'Multiple Times'
                    }).catch(console.error);
                } catch (err) {
                    console.error('Error fetching admin for instructor notification', err);
                }
            }

        } catch (waErr) {
            console.error('WhatsApp bulk booking confirmation failed:', waErr);
        }

        res.status(201).json({
            success: true,
            message: `Successfully booked ${createdBookings.length} sessions.`,
            data: createdBookings
        });

    } catch (error) {
        console.error('Bulk booking creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create bookings',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/bookings/user/:email
 * @desc    Get all bookings for the authenticated user
 * @access  Private
 */
router.get('/user/:email', protect, async (req, res) => {
    try {
        const { email } = req.params;

        // Ensure user can only fetch their own bookings
        if (req.user.email !== email) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access these bookings'
            });
        }

        let userBookings = await Booking.findAll({
            where: { userEmail: email },
            order: [['date', 'DESC']]
        });

        // Auto-complete past bookings
        const now = new Date();
        let updated = false;
        for (let booking of userBookings) {
            if (booking.status === 'confirmed') {
                try {
                    const dateRaw = new Date(booking.date);
                    const [timeStr, modifier] = booking.time.split(' ');
                    let [hours, minutes] = timeStr.split(':');
                    
                    let h = parseInt(hours, 10);
                    if (h === 12) {
                        h = modifier.toUpperCase() === 'AM' ? 0 : 12;
                    } else if (modifier.toUpperCase() === 'PM') {
                        h += 12;
                    }
                    
                    const sessionTime = new Date(dateRaw.getFullYear(), dateRaw.getMonth(), dateRaw.getDate(), h, parseInt(minutes, 10), 0);
                    
                    // Mark completed if it's 2 hours past the start time
                    if (sessionTime.getTime() + 2 * 60 * 60 * 1000 < now.getTime()) {
                        booking.status = 'completed';
                        await booking.save();
                        updated = true;
                    }
                } catch (e) {
                    console.error('Error parsing booking time for auto-complete', e);
                }
            }
        }
        
        if (updated) {
            // Re-fetch since statuses have changed
            userBookings = await Booking.findAll({
                where: { userEmail: email },
                order: [['date', 'DESC']]
            });
        }

        res.status(200).json({
            success: true,
            count: userBookings.length,
            data: userBookings
        });
    } catch (error) {
        console.error('Fetch bookings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch bookings',
            error: error.message
        });
    }
});

module.exports = router;
