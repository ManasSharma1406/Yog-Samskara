const nodemailer = require('nodemailer');

/**
 * Utility to send emails via SMTP using nodemailer.
 */
const sendBookingEmail = async ({ to, subject, html }) => {
    try {
        // Create a transporter using environment variables
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com', // Default to Gmail for demo
            port: process.env.SMTP_PORT || 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        const mailOptions = {
            from: `"YOG SAMSKARA" <${process.env.SMTP_USER}>`,
            to,
            subject,
            html
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: %s', info.messageId);
        return info;
    } catch (error) {
        console.error('Email send error:', error);
        // We don't throw here to avoid failing the whole booking process if email fails
        return null;
    }
};

const sendWelcomeEmail = async (to, name) => {
    return sendBookingEmail({
        to,
        subject: 'Welcome to YOG SAMSKARA!',
        html: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2>Namaste ${name}!</h2>
                <p>Welcome to YOG SAMSKARA. Your account has been successfully created.</p>
                <p>We are thrilled to have you join our community. Explore our yoga classes and find the perfect sessions to nurture your mind, body, and spirit.</p>
                <br/>
                <p>If you have any questions, feel free to reach out to our team.</p>
                <p>Best regards,<br/>The YOG SAMSKARA Team</p>
            </div>
        `
    });
};

const sendReminderEmail = async (to, name, meetingLink, classDetails, date, time) => {
    return sendBookingEmail({
        to,
        subject: `Reminder: Your ${classDetails} Session is Starting Soon!`,
        html: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2>Namaste ${name},</h2>
                <p>This is a gentle reminder that your <strong>${classDetails}</strong> session starts in 15 minutes.</p>
                <div style="background: #f4f4f4; padding: 15px; border-left: 5px solid #000; margin: 20px 0;">
                    <p><strong>Date:</strong> ${date}</p>
                    <p><strong>Time:</strong> ${time}</p>
                    <p><strong>Meeting Link:</strong> <a href="${meetingLink}" style="color: #000; font-weight: bold;">Join Session</a></p>
                </div>
                <p>Please log in a few minutes early to ensure your setup is working.</p>
                <p>We look forward to seeing you!</p>
                <p>Best regards,<br/>The YOG SAMSKARA Team</p>
            </div>
        `
    });
};

module.exports = {
    sendBookingEmail,
    sendWelcomeEmail,
    sendReminderEmail
};
