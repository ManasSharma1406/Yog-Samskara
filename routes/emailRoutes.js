const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { sendResendEmail } = require('../utils/resendEmail');
const { upsertQueueEntry } = require('../utils/emailQueue');

const router = express.Router();

const welcomeTemplate = ({ name }) => {
    const safeName = name ? String(name) : 'there';
    return {
        subject: 'Welcome to Yog Samskara',
        html: `
            <div style="font-family: Arial, sans-serif; color: #111827;">
                <h2 style="margin:0 0 12px 0;">Namaste ${safeName}!</h2>
                <p style="margin:0 0 12px 0;">Welcome to Yog Samskara. Your journey starts now.</p>
                <p style="margin:0 0 18px 0;">Explore your plans, book your next class, and we will meet you on the mat.</p>
                <p style="margin:0;">Best regards,<br/>Yog Samskara Team</p>
            </div>
        `
    };
};

const planPurchasedTemplate = ({ name, planName }) => {
    const safeName = name ? String(name) : 'friend';
    const safePlan = planName ? String(planName) : 'your plan';
    return {
        subject: 'Plan purchased successfully',
        html: `
            <div style="font-family: Arial, sans-serif; color: #111827;">
                <h2 style="margin:0 0 12px 0;">Hi ${safeName},</h2>
                <p style="margin:0 0 12px 0;">Congratulations! Your ${safePlan} purchase was successful.</p>
                <p style="margin:0 0 18px 0;">You can now book your classes. We look forward to supporting your wellness journey.</p>
                <p style="margin:0;">Best regards,<br/>Yog Samskara Team</p>
            </div>
        `
    };
};

const classReminderTemplate = ({ name, meetingLink, dateText, timeText }) => {
    const safeName = name ? String(name) : 'there';
    return {
        subject: 'Your class starts in 15 minutes',
        html: `
            <div style="font-family: Arial, sans-serif; color: #111827;">
                <h2 style="margin:0 0 12px 0;">Hi ${safeName},</h2>
                <p style="margin:0 0 12px 0;">
                    Your class is starting soon${dateText || timeText ? ':' : '.'}
                    ${dateText ? `<strong> ${dateText}</strong>` : ''}
                    ${timeText ? `<strong> ${timeText}</strong>` : ''}
                </p>
                <div style="background:#f4f4f4; padding:15px; border-left:5px solid #111827; margin:18px 0;">
                    <p style="margin:0 0 10px 0;"><strong>Join Class Link:</strong></p>
                    <p style="margin:0;">
                        <a href="${meetingLink}" style="color:#111827; font-weight:700;" target="_blank" rel="noreferrer">
                            Join Session
                        </a>
                    </p>
                </div>
                <p style="margin:0 0 18px 0;">See you in 15 minutes.</p>
                <p style="margin:0;">Best regards,<br/>Yog Samskara Team</p>
            </div>
        `
    };
};

router.post('/welcome', protect, async (req, res) => {
    try {
        const { to, name } = req.body || {};
        if (!to) return res.status(400).json({ success: false, message: '`to` is required' });
        if (req.user.email !== to) return res.status(403).json({ success: false, message: 'Not authorized for this email' });

        const { subject, html } = welcomeTemplate({ name });
        await sendResendEmail({ to, subject, html });

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error('Welcome email error:', err);
        return res.status(500).json({ success: false, message: err?.message || 'Failed to send welcome email' });
    }
});

router.post('/plan-purchased', protect, async (req, res) => {
    try {
        const { to, name, planName } = req.body || {};
        if (!to) return res.status(400).json({ success: false, message: '`to` is required' });
        if (req.user.email !== to) return res.status(403).json({ success: false, message: 'Not authorized for this email' });

        const { subject, html } = planPurchasedTemplate({ name, planName });
        await sendResendEmail({ to, subject, html });

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error('Plan purchased email error:', err);
        return res.status(500).json({ success: false, message: err?.message || 'Failed to send plan purchased email' });
    }
});

router.post('/class-reminder/schedule', protect, async (req, res) => {
    try {
        const { appointmentId, to, name, meetingLink, classStartISO, dateText, timeText } = req.body || {};
        if (!appointmentId) return res.status(400).json({ success: false, message: '`appointmentId` is required' });
        if (!to) return res.status(400).json({ success: false, message: '`to` is required' });
        if (!meetingLink) return res.status(400).json({ success: false, message: '`meetingLink` is required' });
        if (!classStartISO) return res.status(400).json({ success: false, message: '`classStartISO` is required' });
        if (req.user.email !== to) return res.status(403).json({ success: false, message: 'Not authorized for this email' });

        const classStartMs = new Date(classStartISO).getTime();
        if (Number.isNaN(classStartMs)) {
            return res.status(400).json({ success: false, message: 'Invalid `classStartISO`' });
        }

        const reminderSendMs = classStartMs - 15 * 60 * 1000;
        const scheduledAtISO = new Date(reminderSendMs).toISOString();

        const { subject, html } = classReminderTemplate({
            name,
            meetingLink,
            dateText,
            timeText
        });

        const key = `class_reminder:${appointmentId}`;
        const result = await upsertQueueEntry({ key, to, subject, html, scheduledAtISO });

        return res.status(200).json({ success: true, queued: result.queued, reason: result.reason });
    } catch (err) {
        console.error('Schedule class reminder error:', err);
        return res.status(500).json({ success: false, message: err?.message || 'Failed to schedule reminder' });
    }
});

module.exports = router;

