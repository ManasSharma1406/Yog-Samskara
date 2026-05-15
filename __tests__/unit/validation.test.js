const express = require('express');
const request = require('supertest');
const { body, validationResult } = require('express-validator');

// Create a small express app to test validation middleware
const app = express();
app.use(express.json());

const validateTest = [
    body('email').isEmail().withMessage('Invalid email'),
    body('name').trim().notEmpty().withMessage('Name required').isLength({ min: 2 }).withMessage('Name too short'),
    body('phone').optional().isMobilePhone().withMessage('Invalid phone'),
    body('message').optional().isLength({ max: 500 }).withMessage('Message too long')
];

app.post('/test-validate', validateTest, (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    res.status(200).json({ success: true });
});

describe('Validation Logic Tests', () => {
    test('Should pass with valid input', async () => {
        const res = await request(app)
            .post('/test-validate')
            .send({ email: 'test@example.com', name: 'John Doe' });
        expect(res.status).toBe(200);
    });

    test('Should fail with invalid email', async () => {
        const res = await request(app)
            .post('/test-validate')
            .send({ email: 'not-an-email', name: 'John Doe' });
        expect(res.status).toBe(400);
        expect(res.body.errors[0].msg).toBe('Invalid email');
    });

    test('Should fail with empty name', async () => {
        const res = await request(app)
            .post('/test-validate')
            .send({ email: 'test@example.com', name: '' });
        expect(res.status).toBe(400);
    });

    test('Should fail with name too short', async () => {
        const res = await request(app)
            .post('/test-validate')
            .send({ email: 'test@example.com', name: 'A' });
        expect(res.status).toBe(400);
        expect(res.body.errors[0].msg).toBe('Name too short');
    });

    test('Edge Case: Very long input strings', async () => {
        const longMessage = 'a'.repeat(501);
        const res = await request(app)
            .post('/test-validate')
            .send({ email: 'test@example.com', name: 'John Doe', message: longMessage });
        expect(res.status).toBe(400);
        expect(res.body.errors[0].msg).toBe('Message too long');
    });

    test('Edge Case: Special characters in inputs', async () => {
        // Validation should still work and not crash
        const res = await request(app)
            .post('/test-validate')
            .send({ 
                email: 'test+filter@example.com', 
                name: 'John <script>alert(1)</script>',
                message: "SELECT * FROM users; --" 
            });
        // Note: Unless we have specific regex for XSS, this might pass 200 
        // but express-validator will have trimmed/escaped if configured.
        // Here we just ensure it doesn't crash.
        expect(res.status).toBe(200); 
    });
});
