// Mock Firebase Admin
jest.mock('firebase-admin', () => ({
    initializeApp: jest.fn(),
    credential: { cert: jest.fn() },
    messaging: jest.fn(() => ({
        sendEachForMulticast: jest.fn().mockResolvedValue({ successCount: 1, failureCount: 0, responses: [] }),
    })),
    apps: { length: 1 }
}));

// Mock node-cron
jest.mock('node-cron', () => ({
    schedule: jest.fn(),
    validate: jest.fn().mockReturnValue(true)
}));

// Mock Database Connection
jest.mock('./config/db', () => ({
    connectDB: jest.fn().mockResolvedValue(true),
    sequelize: {
        authenticate: jest.fn().mockResolvedValue(true),
        sync: jest.fn().mockResolvedValue(true),
        define: jest.fn((name, schema) => ({
            findOne: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({}),
            update: jest.fn().mockResolvedValue([1]),
            findAll: jest.fn().mockResolvedValue([]),
            destroy: jest.fn().mockResolvedValue(1),
            upsert: jest.fn().mockResolvedValue([{}, true]),
            increment: jest.fn().mockResolvedValue({}),
            save: jest.fn().mockResolvedValue({})
        }))
    }
}));

// Mock Models specifically
jest.mock('./models/FcmToken', () => ({
    findAll: jest.fn().mockResolvedValue([]),
    destroy: jest.fn().mockResolvedValue(1)
}));

jest.mock('./models/Profile', () => ({
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue([1])
}));

jest.mock('./models/Subscription', () => ({
    findOne: jest.fn().mockResolvedValue({
        status: 'active',
        totalSessions: 10,
        sessionsUsed: 2,
        save: jest.fn().mockResolvedValue({})
    }),
    upsert: jest.fn().mockResolvedValue([{}, true])
}));

jest.mock('./models/PromoCode', () => ({
    findOne: jest.fn().mockResolvedValue({ code: 'YOSA100', isActive: true, currentUses: 0, maxUses: 10, discountPercentage: 100 }),
    findOrCreate: jest.fn().mockResolvedValue([{ code: 'YOSA100' }, false])
}));

// Setup Environment
process.env.JWT_ACCESS_SECRET = 'test-secret';
process.env.ADMIN_EMAIL = 'admin@test.com';
process.env.WELCOME_EMAIL = 'welcome@test.com';
process.env.NOREPLY_EMAIL = 'noreply@test.com';
process.env.NOTIFICATION_EMAIL = 'notify@test.com';
process.env.EMAIL_PASS = 'test-pass';
process.env.NODE_ENV = 'test';
process.env.RAZORPAY_KEY_ID = 'test-key';
process.env.RAZORPAY_KEY_SECRET = 'test-secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test-webhook-secret';
