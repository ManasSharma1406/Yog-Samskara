const cron = require('node-cron');
const Booking = require('../models/Booking');
const { getFcmTokens, notifyClassReminder } = require('../services/notifier');
const { Op } = require('sequelize');

const startScheduler = () => {
    // Run every hour at minute 0
    cron.schedule('0 * * * *', async () => {
        console.log('Running hourly cron job for class reminders...');

        try {
            const now = new Date();
            
            // Look ahead 1 hour and 24 hours
            const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
            const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

            // Helper to get start and end of the targeted hour to match bookings
            const getHourWindow = (targetDate) => {
                const start = new Date(targetDate);
                start.setMinutes(0, 0, 0);
                const end = new Date(targetDate);
                end.setMinutes(59, 59, 999);
                return { start, end };
            };

            const windows = [
                { hoursUntil: 1, ...getHourWindow(oneHourFromNow) },
                { hoursUntil: 24, ...getHourWindow(twentyFourHoursFromNow) }
            ];

            for (const win of windows) {
                // Formatting dates to match DB string format "YYYY-MM-DD"
                // Assuming local time for date comparison (or UTC depending on how it's stored)
                // Note: The booking times are stored as strings e.g., "10:00 AM".
                // We'll fetch all upcoming confirmed bookings and filter in memory to be safe,
                // since string comparison for dates/times can be tricky in SQL without proper casting.

                const allBookings = await Booking.findAll({
                    where: { status: 'confirmed' }
                });

                for (const booking of allBookings) {
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
                        
                        // Check if sessionTime falls within this window
                        if (sessionTime >= win.start && sessionTime <= win.end) {
                            // It's a match!
                            const fcmTokens = await getFcmTokens(booking.userId);
                            
                            await notifyClassReminder({
                                name: booking.userName,
                                email: booking.userEmail,
                                fcmTokens,
                                className: booking.sessionType,
                                instructorName: 'YogSamskara Instructor',
                                date: booking.date,
                                time: booking.time,
                                zoomLink: booking.meetingLink,
                                hoursUntil: win.hoursUntil
                            });
                        }
                    } catch (err) {
                        console.error('Error processing booking for reminder:', err);
                    }
                }
            }
        } catch (error) {
            console.error('Scheduler error:', error);
        }
    });
};

module.exports = startScheduler;
