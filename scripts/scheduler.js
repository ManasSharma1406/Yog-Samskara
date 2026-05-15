const cron = require('node-cron');
const Booking = require('../models/Booking');
const { sendClassReminder } = require('../utils/mailer');

/**
 * ⏰ Scheduler Logic
 * -----------------
 * Runs every minute to check for upcoming sessions.
 * 1. Checks for bookings starting in ~15 minutes.
 * 2. Checks for bookings starting in ~5 minutes.
 * 3. Sends emails and updates 'reminder15Sent' or 'reminder5Sent' to avoid duplicates.
 */

const startScheduler = () => {
    // Run every minute
    cron.schedule('* * * * *', async () => {
        try {
            const now = new Date();
            
            // Fetch all confirmed bookings that haven't had their 5-min reminder sent yet
            const upcomingBookings = await Booking.findAll({
                where: { 
                    status: 'confirmed',
                    reminder5Sent: false
                }
            });

            for (const booking of upcomingBookings) {
                try {
                    // Parse booking date and time
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
                    
                    // Difference in minutes
                    const diffMs = sessionTime - now;
                    const diffMins = Math.floor(diffMs / (1000 * 60));

                    // 15-Minute Reminder Logic (Targeting 15-10 mins range)
                    if (diffMins <= 15 && diffMins > 5 && !booking.reminder15Sent) {
                        console.log(`[Scheduler] Sending 15-min reminder for ${booking.userName} - ${booking.sessionType}`);
                        
                        await sendClassReminder(booking.userEmail, {
                            userName: booking.userName,
                            className: booking.sessionType,
                            time: booking.time,
                            zoomLink: booking.meetingLink
                        }, 15);

                        await booking.update({ reminder15Sent: true });
                    }

                    // 5-Minute Reminder Logic (Targeting 5-0 mins range)
                    if (diffMins <= 5 && diffMins >= 0 && !booking.reminder5Sent) {
                        console.log(`[Scheduler] Sending 5-min reminder for ${booking.userName} - ${booking.sessionType}`);
                        
                        await sendClassReminder(booking.userEmail, {
                            userName: booking.userName,
                            className: booking.sessionType,
                            time: booking.time,
                            zoomLink: booking.meetingLink
                        }, 5);

                        await booking.update({ reminder5Sent: true });
                    }
                } catch (err) {
                    console.error(`Error processing reminder for booking ${booking.id}:`, err);
                }
            }
        } catch (error) {
            console.error('Critical Scheduler Error:', error);
        }
    });

    console.log('✅ Email Scheduler started (running every minute)');
};

module.exports = startScheduler;
