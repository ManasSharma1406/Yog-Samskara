const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

/**
 * 📧 Email Flow Diagram
 * --------------------
 * [Signup/Login] ----> sendWelcomeEmail() ----> (Customer: Welcome) + (Admin: Alert)
 * [Class Booked] ----> sendBookingConfirmation() ----> (Customer: Confirmed) + (Admin: Alert)
 * [Payment Done] ----> sendPaymentConfirmation() ----> (Customer: Receipt) + (Admin: Alert)
 * [T - 15 Mins]  ----> sendClassReminder(15) ----> (Customer: 15min) + (Admin: List)
 * [T - 5 Mins]   ----> sendClassReminder(5)  ----> (Customer: 5min) + (Admin: Alert)
 */

const smtpConfig = {
    host: 'smtp.hostinger.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.WELCOME_EMAIL,
        pass: process.env.EMAIL_PASS,
    },
};

const welcomeTransporter = nodemailer.createTransport({ ...smtpConfig, auth: { user: process.env.WELCOME_EMAIL, pass: process.env.EMAIL_PASS } });
const noReplyTransporter = nodemailer.createTransport({ ...smtpConfig, auth: { user: process.env.NOREPLY_EMAIL, pass: process.env.EMAIL_PASS } });
const notificationTransporter = nodemailer.createTransport({ ...smtpConfig, auth: { user: process.env.NOTIFICATION_EMAIL, pass: process.env.EMAIL_PASS } });

const emailQueue = [];
let isProcessing = false;

const processQueue = async () => {
    if (isProcessing || emailQueue.length === 0) return;
    isProcessing = true;
    const task = emailQueue.shift();
    try { await task(); } catch (error) { console.error('Email queue error:', error); }
    isProcessing = false;
    processQueue();
};

const addToQueue = (emailTask) => {
    emailQueue.push(emailTask);
    processQueue();
};

const sendEmailWithRetry = async (transporter, mailOptions, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await transporter.sendMail(mailOptions);
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(r => setTimeout(r, 2000));
        }
    }
};

/**
 * 1. Welcome & First Login Email
 */
const sendWelcomeEmail = async (customerEmail, customerName) => {
    addToQueue(async () => {
        const customerMail = {
            from: `"Bhumika Hardiya | YogSamskara" <${process.env.WELCOME_EMAIL}>`,
            to: customerEmail,
            subject: 'Welcome to YogSamskara!',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
                    <div style="background: #2d6a4f; padding: 40px; text-align: center; color: white;">
                        <h1 style="margin: 0;">Namaste ${customerName}!</h1>
                    </div>
                    <div style="padding: 30px; line-height: 1.6;">
                        <p>Welcome to YogSamskara community. We're honored to support your wellness journey.</p>
                        <p>Discover personalized yoga routines and join our live classes to find your balance.</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="https://yogsamskara.com/dashboard" style="background: #2d6a4f; color: white; padding: 12px 25px; text-decoration: none; border-radius: 50px; font-weight: bold;">Explore Classes</a>
                        </div>
                        <p>Warmly,<br>Bhumika Hardiya</p>
                    </div>
                </div>
            `
        };
        const adminMail = {
            from: `"YogSamskara Alerts" <${process.env.WELCOME_EMAIL}>`,
            to: process.env.ADMIN_EMAIL,
            subject: `🔔 New User: ${customerName}`,
            html: `<p>New user <b>${customerName}</b> (${customerEmail}) joined at ${new Date().toLocaleString()}.</p>`
        };
        await sendEmailWithRetry(welcomeTransporter, customerMail);
        await sendEmailWithRetry(welcomeTransporter, adminMail);
    });
};

/**
 * 2a. Payment Confirmation
 */
const sendPaymentConfirmation = async (customerEmail, paymentDetails) => {
    const { userName, planName, amount, transactionId, orderId } = paymentDetails;
    addToQueue(async () => {
        const customerMail = {
            from: `"YogSamskara" <${process.env.NOREPLY_EMAIL}>`,
            to: customerEmail,
            subject: 'Payment Received - YogSamskara',
            html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
                    <h3>Payment Successful</h3>
                    <p>Namaste ${userName}, your purchase of <b>${planName}</b> is confirmed.</p>
                    <p>Amount: ₹${amount}</p>
                    <p>Transaction ID: ${transactionId}</p>
                    <p>Order ID: ${orderId}</p>
                </div>
            `
        };
        const adminMail = {
            from: `"Payment System" <${process.env.NOREPLY_EMAIL}>`,
            to: process.env.ADMIN_EMAIL,
            subject: `💳 Payment Alert: ₹${amount} from ${userName}`,
            html: `<p>${userName} (${customerEmail}) paid ₹${amount} for ${planName}.<br>Txn: ${transactionId}</p>`
        };
        await sendEmailWithRetry(noReplyTransporter, customerMail);
        await sendEmailWithRetry(noReplyTransporter, adminMail);
    });
};

/**
 * 2b. Booking Confirmation
 */
const sendBookingConfirmation = async (customerEmail, bookingDetails) => {
    const { userName, className, date, time, zoomLink } = bookingDetails;
    addToQueue(async () => {
        const customerMail = {
            from: `"YogSamskara" <${process.env.NOREPLY_EMAIL}>`,
            to: customerEmail,
            subject: 'Class Booking Confirmed!',
            html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
                    <h3>Session Confirmed</h3>
                    <p>Hi ${userName}, your <b>${className}</b> is scheduled for <b>${date}</b> at <b>${time}</b>.</p>
                    <p>Link: <a href="${zoomLink}">${zoomLink}</a></p>
                </div>
            `
        };
        const adminMail = {
            from: `"Booking System" <${process.env.NOREPLY_EMAIL}>`,
            to: process.env.ADMIN_EMAIL,
            subject: `🗓️ New Booking: ${userName} - ${className}`,
            html: `<p>${userName} booked ${className} for ${date} at ${time}.</p>`
        };
        await sendEmailWithRetry(noReplyTransporter, customerMail);
        await sendEmailWithRetry(noReplyTransporter, adminMail);
    });
};

/**
 * 3 & 4. Class Reminders
 */
const sendClassReminder = async (customerEmail, bookingDetails, minutesLeft) => {
    const { userName, className, time, zoomLink } = bookingDetails;
    addToQueue(async () => {
        const customerMail = {
            from: `"YogSamskara" <${process.env.NOTIFICATION_EMAIL}>`,
            to: customerEmail,
            subject: `⏰ Reminder: Class starts in ${minutesLeft} mins!`,
            html: `<h3>${className} starts in ${minutesLeft} minutes!</h3><p>Namaste ${userName}, join here: <a href="${zoomLink}">${zoomLink}</a></p>`
        };
        const adminMail = {
            from: `"Reminder System" <${process.env.NOTIFICATION_EMAIL}>`,
            to: process.env.ADMIN_EMAIL,
            subject: `⏰ Reminder Sent (${minutesLeft}m): ${className}`,
            html: `<p>${minutesLeft}m reminder sent to ${userName} for ${className} starting at ${time}.</p>`
        };
        await sendEmailWithRetry(notificationTransporter, customerMail);
        await sendEmailWithRetry(notificationTransporter, adminMail);
    });
};

/**
 * 5. Critical System Alert
 */
const sendCriticalAlert = async (errorDetails) => {
    addToQueue(async () => {
        const adminMail = {
            from: `"SYSTEM CRITICAL" <${process.env.NOTIFICATION_EMAIL}>`,
            to: process.env.ADMIN_EMAIL,
            subject: '🚨 CRITICAL SERVER ERROR - YogSamskara',
            html: `
                <div style="font-family: monospace; padding: 20px; background: #fff1f0; border: 2px solid #cf1322;">
                    <h2 style="color: #cf1322;">Critical Error Detected</h2>
                    <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                    <p><strong>Message:</strong> ${errorDetails.message}</p>
                    <pre style="background: #fff; padding: 10px; border: 1px solid #ffa39e; overflow: auto;">${errorDetails.stack}</pre>
                </div>
            `
        };
        await sendEmailWithRetry(notificationTransporter, adminMail);
    });
};

module.exports = {
    sendWelcomeEmail,
    sendPaymentConfirmation,
    sendBookingConfirmation,
    sendClassReminder,
    sendCriticalAlert
};
