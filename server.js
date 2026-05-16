const express = require('express');
const dotenv = require('dotenv');
const os = require('os');

// Load env vars
dotenv.config();

const cookieParser = require('cookie-parser');
const cors = require('cors');
const { initFirebaseAdmin } = require('./config/firebaseAdmin');
const { connectDB } = require('./config/db');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const xss = require('xss-clean');
const compression = require('compression');
const morgan = require('morgan');
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
require('./models/FcmToken');
require('./models/Lead');

// Connect to database
connectDB().then(async () => {
    // Initialize cron jobs after DB is connected and synced
    require('./scripts/cronJobs');
    require('./scripts/scheduler')();

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
const emailRoutes = require('./routes/emailRoutes');
const { processEmailQueue } = require('./utils/emailQueue');
const { sendResendEmail } = require('./utils/resendEmail');
const userRoutes = require('./routes/userRoutes');
const leads = require('./routes/leadRoutes');

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
    'https://yosa.yogsamskara.com',
    'https://www.yosa.yogsamskara.com',
];

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
        if (process.env.NODE_ENV === 'development' && origin?.startsWith('http://localhost')) return callback(null, true);
        // Reject unknown origins cleanly (do not throw)
        return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Explicitly handle OPTIONS preflight for all routes
app.options('*', cors(corsOptions));

// Security Middlewares
app.use(helmet()); // Set security HTTP headers
app.use(xss());    // Sanitize user input from incoming request data
app.use(hpp());    // Prevent parameter pollution

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes'
});

// Performance Middlewares
app.use(compression()); // Gzip compression
app.use(morgan('dev')); // Logging

// Custom middleware to log slow requests (> 500ms)
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        if (duration > 500) {
            console.warn(`[PERF WARNING] Slow request: ${req.method} ${req.originalUrl} took ${duration}ms`);
        }
    });
    next();
});

// Cache control for static assets (if any are served via Express)
app.use((req, res, next) => {
    if (req.method === 'GET' && (req.url.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2)$/))) {
        res.set('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year
    }
    next();
});

// Apply rate limiting to all API routes (AFTER cors handling)
app.use('/api', limiter);

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
app.use('/api/emails', emailRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leads', leads);

// Health check route
app.get('/api/health', (req, res) => {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    res.status(200).json({
        success: true,
        status: 'UP',
        timestamp: new Date().toISOString(),
        process: {
            uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
            memory: {
                rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
                heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
                heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`
            },
            pid: process.pid
        },
        system: {
            platform: os.platform(),
            loadavg: os.loadavg()
        }
    });
});

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

let server;
if (process.env.NODE_ENV !== 'test') {
    server = app.listen(PORT, () => {
        console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
}

let queueProcessing = false;
setInterval(() => {
    if (queueProcessing) return;
    queueProcessing = true;
    processEmailQueue({
        sendEmail: sendResendEmail
    }).catch((err) => {
        console.error('Email queue processor error:', err);
    }).finally(() => {
        queueProcessing = false;
    });
}, 30 * 1000);

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
