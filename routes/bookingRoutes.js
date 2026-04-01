const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Subscription = require('../models/Subscription');
const { protect } = require('../middleware/authMiddleware');
const { sendBookingEmail } = require('../utils/emailSender');

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
                            <p><strong>Meeting Link:</strong> <a href="${booking.meetingLink}" style="color: #000; font-weight: bold;">Join Session</a></p>
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
 * @route   POST /api/bookings/bulk-create
 * @desc    Create multiple bookings at once
 * @access  Private
 */
router.post('/bulk-create', protect, async (req, res) => {
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
            const slotsHtml = createdBookings.map(b => `<li style="margin-bottom: 5px;"><strong>Date:</strong> ${new Date(b.date).toLocaleDateString()} | <strong>Time:</strong> ${b.time}</li>`).join('');
            
            await sendBookingEmail({
                to: userEmail,
                subject: 'Your Yoga Sessions are Confirmed!',
                html: `
                    <div style="font-family: Arial, sans-serif; color: #333;">
                        <h2>Namaste ${userName}!</h2>
                        <p>Your <strong>${createdBookings.length}</strong> sessions have been confirmed.</p>
                        <div style="background: #f4f4f4; padding: 15px; border-left: 5px solid #000; margin: 20px 0;">
                            <ul style="list-style-type: none; padding: 0; margin: 0;">
                                ${slotsHtml}
                            </ul>
                            <p style="margin-top: 15px;"><strong>Meeting Link (for all sessions):</strong> <a href="https://meet.google.com/ngs-doim-gqq" style="color: #000; font-weight: bold;">Join Session</a></p>
                        </div>
                        <p>You have ${subscription.totalSessions - subscription.sessionsUsed} sessions remaining in your current plan.</p>
                        <p>We look forward to seeing you!</p>
                        <p>Best regards,<br/>The YOG SAMSKARA Team</p>
                    </div>
                `
            });
        } catch (emailErr) {
            console.error('Email sending failed for bulk booking:', emailErr);
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
