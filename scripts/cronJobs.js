const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');
const Booking = require('../models/Booking');
const { sendReminderEmail } = require('../utils/emailSender');

// Run every minute
cron.schedule('* * * * *', async () => {
    try {
        const now = new Date();

        // Find bookings that are confirmed and haven't had a reminder sent
        const upcomingBookings = await Booking.findAll({
            where: {
                status: 'confirmed',
                reminderSent: false
            }
        });

        for (const booking of upcomingBookings) {
            try {
                // Parse booking date and time
                // date: "YYYY-MM-DD"
                // time: "10:00 AM" or "02:30 PM"
                const [year, month, day] = booking.date.split('-');
                const [timeStr, modifier] = booking.time.split(' ');
                let [hours, minutes] = timeStr.split(':');
                
                let h = parseInt(hours, 10);
                if (h === 12) {
                    h = modifier.toUpperCase() === 'AM' ? 0 : 12;
                } else if (modifier.toUpperCase() === 'PM') {
                    h += 12;
                }
                
                const sessionTime = new Date(
                    parseInt(year, 10), 
                    parseInt(month, 10) - 1, 
                    parseInt(day, 10), 
                    h, 
                    parseInt(minutes, 10), 
                    0
                );

                // calculate difference in minutes
                const diffMs = sessionTime.getTime() - now.getTime();
                const diffMins = Math.floor(diffMs / 60000);

                // If session is within the next 15 minutes (0 to 15 mins) and not in the past
                if (diffMins <= 15 && diffMins > -5) {
                    const Profile = require('../models/Profile');
                    const { sendWhatsAppMessage } = require('../utils/whatsappSender');

                    // Find profile to get WhatsApp number
                    const profile = await Profile.findOne({ where: { email: booking.userEmail } });
                    
                    if (profile && profile.whatsappNumber) {
                        const message = `Namaste ${profile.firstName || booking.userName}!\n\nReminder: Your ${booking.sessionType} session begins in 15 minutes at ${booking.time}.\n\nPlease find a quiet space and get your mat ready. Join your session here: ${booking.meetingLink || 'Link in dashboard'}\n\nSee you on the mat!`;
                        await sendWhatsAppMessage(profile.whatsappNumber, message);
                    }

                    // Send email as fallback or additional? The user asked for all notifications to go to WhatsApp bot.
                    // So we only send WA.
                    
                    // Mark as sent
                    booking.reminderSent = true;
                    await booking.save();
                    console.log(`WhatsApp Reminder sent for booking ${booking.id} to ${booking.userEmail}`);
                }
            } catch (err) {
                console.error(`Error processing reminder for booking ${booking.id}:`, err);
            }
        }
    } catch (error) {
        console.error('Error running reminder cron job:', error);
    }
});

// ---------------------------------------------------------
// 💾 Daily Database Backup (Runs at 3:00 AM)
// ---------------------------------------------------------
cron.schedule('0 3 * * *', () => {
    console.log('Running daily database backup...');
    const backupScript = path.join(__dirname, 'backup.js');
    exec(`node ${backupScript}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Backup error: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`Backup stderr: ${stderr}`);
            return;
        }
        console.log(`Backup output: ${stdout}`);
    });
});

console.log('Cron scheduler for class reminders initialized.');
