const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Subscription = require('../models/Subscription');
const { protect } = require('../middleware/authMiddleware');
const { generateMeetingLink } = require('../utils/meetingLink');
const { sendBookingEmail } = require('../utils/emailSender');

/**
 * @route   POST /api/bookings/create
 * @desc    Create a booking in MongoDB and verify subscription
 * @access  Private
 */
router.post('/create', protect, async (req, res) => {
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

        // Check subscription status
        const subscription = await Subscription.findOne({ userId: req.user.uid });

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
            status: status || 'confirmed'
        };

        // Save to MongoDB
        const booking = await Booking.create(bookingData);

        // Init meeting link as pending
        booking.meetingLink = "Pending... (Teacher will assign Google Meet link soon)";
        await booking.save();

        // Increment sessions used if it's a private session
        if (sessionType !== 'Group Class') {
            subscription.sessionsUsed += 1;
            await subscription.save();
        }

        // Send confirmation email
        try {
            await sendBookingEmail({
                to: userEmail,
                subject: 'Your Yoga Session is Confirmed!',
                html: `
                    <div style="font-family: Arial, sans-serif; color: #333;">
                        <h2>Namaste ${userName}!</h2>
                        <p>Your <strong>${sessionType}</strong> session has been confirmed.</p>
                        <div style="background: #f4f4f4; padding: 15px; border-left: 5px solid #000; margin: 20px 0;">
                            <p><strong>Date:</strong> ${date}</p>
                            <p><strong>Time:</strong> ${time}</p>
                            <p><strong>Session:</strong> ${sessionType}</p>
                            <p><strong>Meeting Link:</strong> <a href="${meetingLink}" style="color: #000; font-weight: bold;">Join Session</a></p>
                        </div>
                        <p>We look forward to seeing you!</p>
                        <p>Best regards,<br/>The YOG SAMSKARA Team</p>
                    </div>
                `
            });
        } catch (emailErr) {
            console.error('Email sending failed:', emailErr);
            // Don't fail the booking if email fails
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

        const userBookings = await Booking.find({ userEmail: email }).sort({ date: -1 });

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
