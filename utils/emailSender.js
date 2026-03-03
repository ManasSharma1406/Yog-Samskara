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

module.exports = {
    sendBookingEmail
};
