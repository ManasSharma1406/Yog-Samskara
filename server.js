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

// Connect to database
connectDB();

// Route files
const payments = require('./routes/paymentRoutes');
const bookings = require('./routes/bookingRoutes');
const profiles = require('./routes/profileRoutes');
const subscriptions = require('./routes/subscriptionRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Raw body parser for Razorpay webhook (must be before express.json())
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// Body parser for all other routes
app.use(express.json());

// Cookie parser
app.use(cookieParser());

// Enable CORS
const allowedOrigins = [
    'http://localhost:3000',
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
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true
};
app.use(cors(corsOptions));

// Mount routers
app.use('/api/payments', payments);
app.use('/api/bookings', bookings);
app.use('/api/profiles', profiles);
app.use('/api/subscriptions', subscriptions);
app.use('/api/admin', adminRoutes);

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

