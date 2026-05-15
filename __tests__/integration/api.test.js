const request = require('supertest');
const app = require('../../server');
const Booking = require('../../models/Booking');
const Profile = require('../../models/Profile');

// Mock Authentication
jest.mock('../../middleware/authMiddleware', () => ({
    protect: (req, res, next) => {
        req.user = { uid: 'test-user-123', email: 'test@example.com' };
        next();
    }
}));

describe('API Integration Tests', () => {
    
    test('GET /api/health should return 200', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    test('POST /api/bookings/create should return 201 on success', async () => {
        // Mock Booking.create to return a valid object
        Booking.create.mockResolvedValue({
            id: 1,
            userName: 'Test User',
            userEmail: 'test@example.com',
            date: '2026-05-20',
            time: '10:00 AM',
            meetingLink: 'http://zoom.us',
            update: jest.fn().mockResolvedValue({})
        });

        // Mock Profile.findOne to return a valid profile for email notification
        Profile.findOne.mockResolvedValue({
            firstName: 'Test',
            email: 'test@example.com',
            whatsappNumber: '1234567890'
        });

        const res = await request(app)
            .post('/api/bookings/create')
            .send({
                date: '2026-05-20',
                time: '10:00 AM',
                userName: 'Test User',
                userEmail: 'test@example.com',
                sessionType: '1:1 Coaching'
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
    });

    test('POST /api/bookings/create should return 400 for invalid email', async () => {
        const res = await request(app)
            .post('/api/bookings/create')
            .send({
                date: '2026-05-20',
                time: '10:00 AM',
                userName: 'Test User',
                userEmail: 'invalid-email',
                sessionType: '1:1 Coaching'
            });

        expect(res.status).toBe(400);
        expect(res.body.errors).toBeDefined();
    });

    test('Edge Case: SQL Injection attempt in profile update', async () => {
        const res = await request(app)
            .put('/api/profiles/test@example.com')
            .send({ firstName: "'; DROP TABLE Users; --" });
        
        // Should be handled as a string and not crash
        expect(res.status).not.toBe(500);
    });
});
