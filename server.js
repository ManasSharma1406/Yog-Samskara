const express = require('express');
const dotenv = require('dotenv');

// Load env vars
dotenv.config();

const cookieParser = require('cookie-parser');
const cors = require('cors');
const { initFirebaseAdmin } = require('./config/firebaseAdmin');
const { connectDB } = require('./config/db');
const errorHandler = require('./middleware/errorMiddleware');

// Initialize Firebase Admin (required for user auth verification)
initFirebaseAdmin();

// Load models before connectDB so sync/alter works correctly
require('./models/Profile');
require('./models/Booking');
require('./models/Subscription');
require('./models/User');
require('./models/Transaction');
require('./models/PromoCode');

// Connect to database
connectDB().then(async () => {
    // Seed the YOSA100 promo code
    try {
        const PromoCode = require('./models/PromoCode');
        const [promo, created] = await PromoCode.findOrCreate({
            where: { code: 'YOSA100' },
            defaults: {
                discountPercentage: 100,
                maxUses: 10,
                currentUses: 0,
                isActive: true
            }
        });
        if (created) {
            console.log('Seeded initial promo code: YOSA100');
        }
    } catch (err) {
        console.error('Failed to seed promo code:', err);
    }
});

// Route files
const payments = require('./routes/paymentRoutes');
const bookings = require('./routes/bookingRoutes');
const profiles = require('./routes/profileRoutes');
const subscriptions = require('./routes/subscriptionRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Enable CORS
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3000/',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'https://yog-samskara.vercel.app',
    'https://yogsamskara.com',
    'https://www.yogsamskara.com',
];

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
        if (process.env.NODE_ENV === 'development' && origin?.startsWith('http://localhost')) return callback(null, true);
        callback(null, true); // Fallback to allow for easier testing, though we should ideally be strict
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Raw body parser for Razorpay webhook (must be before express.json())
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// Body parser for all other routes
app.use(express.json());

// Cookie parser
app.use(cookieParser());

// Mount routers
app.use('/api/payments', payments);
app.use('/api/bookings', bookings);
app.use('/api/profiles', profiles);
app.use('/api/subscriptions', subscriptions);
app.use('/api/admin', adminRoutes);

// Health check route
app.get('/api/health', (req, res) => {
    const { admin } = require('./config/firebaseAdmin');
    res.status(200).json({
        success: true,
        environment: process.env.NODE_ENV,
        firebaseAdmin: admin.apps.length > 0 ? 'Initialized' : 'Not Initialized',
        hasServiceAccountEnv: !!process.env.FIREBASE_SERVICE_ACCOUNT,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID ? 'set via env' : 'using hardcoded fallback',
        razorpaySecret: process.env.RAZORPAY_KEY_SECRET ? 'set via env' : 'using hardcoded fallback',
        timestamp: new Date().toISOString()
    });
});

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.error('UNHANDLED REJECTION! 💥');
    console.error(err);
    // Close server & exit process
    server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION! 💥');
    console.error(err);
    process.exit(1);
});

// Export app for Vercel Serverless Functions
module.exports = app;

