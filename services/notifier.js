const nodemailer = require('nodemailer');
const admin = require('firebase-admin');
const FcmToken = require('../models/FcmToken');

// Firebase Admin initialization is handled in server.js or config/firebaseAdmin.js
// But just in case we need it here, we check if it's initialized.
if (!admin.apps.length) {
    try {
        const serviceAccount = require('../../firebase-service-account.json');
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } catch (e) {
        console.warn('Could not load firebase-service-account.json in notifier.js. Relying on default initialization.', e.message);
    }
}

// Nodemailer Transporter for Hostinger
const transporter = nodemailer.createTransport({
    host: "smtp.hostinger.com",
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Helper: Get FCM Tokens from DB
const getFcmTokens = async (userId) => {
    try {
        const tokens = await FcmToken.findAll({ where: { userId } });
        return tokens.map(t => t.token);
    } catch (error) {
        console.error('Error fetching FCM tokens:', error);
        return [];
    }
};

// Helper: Remove invalid FCM Token
const removeInvalidFcmToken = async (userId, token) => {
    try {
        await FcmToken.destroy({ where: { userId, token } });
    } catch (error) {
        console.error('Error removing invalid FCM token:', error);
    }
};

// Internal Helper: Send Email with Brand Styling
const sendBrandEmail = async (to, subject, title, bodyHtml, ctaLink, ctaText) => {
    const html = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #2d6a4f; color: #fff; padding: 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px;">🙏 YogSamskara</h1>
            </div>
            <div style="padding: 30px 20px;">
                <h2 style="color: #2d6a4f; margin-top: 0;">${title}</h2>
                ${bodyHtml}
                ${ctaLink ? `
                <div style="text-align: center; margin-top: 30px;">
                    <a href="${ctaLink}" style="background-color: #2d6a4f; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">${ctaText || 'Go to Dashboard'}</a>
                </div>
                ` : ''}
            </div>
            <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #e0e0e0;">
                <p style="margin: 0;">&copy; ${new Date().getFullYear()} YogSamskara. All rights reserved.</p>
                <p style="margin: 5px 0 0;"><a href="https://yogsamskara.com" style="color: #2d6a4f; text-decoration: none;">yogsamskara.com</a></p>
            </div>
        </div>
    `;

    return transporter.sendMail({
        from: `"YogSamskara" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html
    });
};

// Internal Helper: Send Push Notification to multiple tokens
const sendPush = async (userId, tokens, title, body, url, tag) => {
    if (!tokens || tokens.length === 0) return;

    const message = {
        notification: {
            title,
            body
        },
        data: {
            url: url || 'https://yogsamskara.com',
            type: tag || 'yogsamskara'
        },
        webpush: {
            fcmOptions: {
                link: url || 'https://yogsamskara.com'
            },
            notification: {
                icon: 'https://yogsamskara.com/icon-192.png',
                requireInteraction: tag === 'reminder',
                tag: tag || 'yogsamskara'
            }
        },
        tokens
    };

    try {
        const response = await admin.messaging().sendEachForMulticast(message);
        
        // Handle invalid tokens
        if (response.failureCount > 0) {
            const failedTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const errCode = resp.error?.code;
                    if (errCode === 'messaging/registration-token-not-registered' || errCode === 'messaging/invalid-registration-token') {
                        failedTokens.push(tokens[idx]);
                    }
                }
            });
            for (const failedToken of failedTokens) {
                await removeInvalidFcmToken(userId, failedToken);
            }
        }
    } catch (error) {
        console.error('Error sending push notification:', error);
    }
};

const notifyCustomerSignup = async ({ name, email, fcmTokens }) => {
    try {
        const subject = 'Welcome to YogSamskara!';
        const title = `Namaste, ${name || 'Friend'}!`;
        const bodyHtml = `<p>Welcome to YogSamskara. We are thrilled to be part of your wellness journey. Book your first class today and let the transformation begin!</p>`;
        const url = 'https://yogsamskara.com/dashboard';

        await Promise.all([
            sendBrandEmail(email, subject, title, bodyHtml, url, 'Book a Class').catch(console.error),
            sendPush(null, fcmTokens, subject, 'Welcome to your wellness journey! Book your first class today.', url, 'signup').catch(console.error)
        ]);
    } catch (error) {
        console.error('notifyCustomerSignup error:', error);
    }
};

const notifyPaymentConfirmed = async ({ name, email, fcmTokens, amount, planName, orderId }) => {
    try {
        const subject = 'Payment Confirmed - YogSamskara';
        const title = `Payment Successful`;
        const bodyHtml = `
            <p>Namaste ${name || ''}, your payment has been successfully processed.</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Plan:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${planName}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Amount:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${amount}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Order ID:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${orderId}</td></tr>
            </table>
            <p style="margin-top: 15px;">Your subscription is now active.</p>
        `;
        const url = 'https://yogsamskara.com/dashboard';

        await Promise.all([
            sendBrandEmail(email, subject, title, bodyHtml, url, 'View Dashboard').catch(console.error),
            sendPush(null, fcmTokens, subject, `Your purchase of ${planName} is confirmed!`, url, 'payment').catch(console.error)
        ]);
    } catch (error) {
        console.error('notifyPaymentConfirmed error:', error);
    }
};

const notifyCustomerBooking = async ({ name, email, fcmTokens, className, instructorName, date, time, zoomLink }) => {
    try {
        const subject = 'Your Yoga Session is Confirmed!';
        const title = `Namaste, ${name || ''}!`;
        const bodyHtml = `
            <p>Your session has been successfully booked.</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Session:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${className}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Date:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${date}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Time:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${time}</td></tr>
                ${instructorName ? `<tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Instructor:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${instructorName}</td></tr>` : ''}
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Meeting Link:</strong></td><td style="padding: 8px; border: 1px solid #ddd;"><a href="${zoomLink}">${zoomLink}</a></td></tr>
            </table>
        `;
        const url = zoomLink || 'https://yogsamskara.com/dashboard';

        await Promise.all([
            sendBrandEmail(email, subject, title, bodyHtml, url, 'Join Session').catch(console.error),
            sendPush(null, fcmTokens, subject, `Your ${className} session on ${date} at ${time} is confirmed!`, url, 'booking').catch(console.error)
        ]);
    } catch (error) {
        console.error('notifyCustomerBooking error:', error);
    }
};

const notifyInstructorBooking = async ({ instructorEmail, instructorFcmTokens, instructorName, studentName, className, date, time }) => {
    try {
        const subject = 'New Booking Alert 🔔';
        const title = `Hello ${instructorName || 'Instructor'},`;
        const bodyHtml = `
            <p>You have a new booking from <strong>${studentName}</strong>.</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Session:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${className}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Date:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${date}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Time:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${time}</td></tr>
            </table>
        `;
        const url = 'https://yogsamskara.com/admin/bookings';

        await Promise.all([
            sendBrandEmail(instructorEmail, subject, title, bodyHtml, url, 'View Bookings').catch(console.error),
            sendPush(null, instructorFcmTokens, subject, `${studentName} booked a ${className} session on ${date} at ${time}.`, url, 'booking_alert').catch(console.error)
        ]);
    } catch (error) {
        console.error('notifyInstructorBooking error:', error);
    }
};

const notifyCustomerCancellation = async ({ name, email, fcmTokens, className, date, time }) => {
    try {
        const subject = 'Session Cancellation Notice';
        const title = `Namaste, ${name || ''}`;
        const bodyHtml = `
            <p>Your session for <strong>${className}</strong> scheduled on <strong>${date}</strong> at <strong>${time}</strong> has been cancelled.</p>
            <p>If you have any questions, please contact us.</p>
        `;
        const url = 'https://yogsamskara.com/dashboard';

        await Promise.all([
            sendBrandEmail(email, subject, title, bodyHtml, url, 'View Dashboard').catch(console.error),
            sendPush(null, fcmTokens, subject, `Your ${className} session on ${date} at ${time} was cancelled.`, url, 'cancellation').catch(console.error)
        ]);
    } catch (error) {
        console.error('notifyCustomerCancellation error:', error);
    }
};

const notifyClassReminder = async ({ name, email, fcmTokens, className, instructorName, date, time, zoomLink, hoursUntil }) => {
    try {
        const subject = `Reminder: Your ${className} session is in ${hoursUntil} hour${hoursUntil > 1 ? 's' : ''}`;
        const title = `Namaste, ${name || ''}!`;
        const bodyHtml = `
            <p>This is a reminder that your session is coming up soon.</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Session:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${className}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Date:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${date}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Time:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${time}</td></tr>
                ${instructorName ? `<tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Instructor:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${instructorName}</td></tr>` : ''}
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Meeting Link:</strong></td><td style="padding: 8px; border: 1px solid #ddd;"><a href="${zoomLink}">${zoomLink}</a></td></tr>
            </table>
            <p style="margin-top: 15px;">Please be ready 5 minutes before the session starts.</p>
        `;
        const url = zoomLink || 'https://yogsamskara.com/dashboard';

        await Promise.all([
            sendBrandEmail(email, subject, title, bodyHtml, url, 'Join Session').catch(console.error),
            sendPush(null, fcmTokens, subject, `Your ${className} session starts in ${hoursUntil} hour${hoursUntil > 1 ? 's' : ''}!`, url, 'reminder').catch(console.error)
        ]);
    } catch (error) {
        console.error('notifyClassReminder error:', error);
    }
};

module.exports = {
    getFcmTokens,
    removeInvalidFcmToken,
    notifyCustomerSignup,
    notifyPaymentConfirmed,
    notifyCustomerBooking,
    notifyInstructorBooking,
    notifyCustomerCancellation,
    notifyClassReminder
};
