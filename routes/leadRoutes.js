const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const { sendNotificationEmail } = require('../utils/mailer');
const { body, validationResult } = require('express-validator');

/**
 * @route   POST /api/leads
 * @desc    Create a new lead from contact form
 * @access  Public
 */
router.post('/', [
    body('firstName').trim().notEmpty().escape(),
    body('lastName').trim().notEmpty().escape(),
    body('email').isEmail().normalizeEmail(),
    body('phone').trim().notEmpty(),
    body('age').optional().isInt(),
    body('gender').optional().trim().escape(),
    body('healthGoals').optional().trim().escape(),
    body('medicalHistory').optional().trim().escape(),
    body('yogaExperience').optional().trim().escape()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const lead = await Lead.create(req.body);

        // Notify Instructor
        const instructorEmail = process.env.ADMIN_EMAIL || 'yogsamskara02@gmail.com';
        const details = `
            Name: ${lead.firstName} ${lead.lastName}
            Email: ${lead.email}
            Phone: ${lead.phone}
            Age: ${lead.age}
            Gender: ${lead.gender}
            Yoga Experience: ${lead.yogaExperience}
            Health Goals: ${lead.healthGoals}
            Medical History: ${lead.medicalHistory}
        `;

        try {
            await sendNotificationEmail(instructorEmail, `New Student Inquiry: ${lead.firstName}`, details);
        } catch (mailErr) {
            console.error('Failed to send lead notification email:', mailErr);
        }

        res.status(201).json({
            success: true,
            message: 'Inquiry submitted successfully',
            data: lead
        });
    } catch (error) {
        console.error('Lead creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit inquiry',
            error: error.message
        });
    }
});


module.exports = router;
