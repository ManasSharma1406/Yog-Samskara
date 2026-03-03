const express = require('express');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const admin = require('firebase-admin');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorMiddleware');

// Load env vars
dotenv.config();

// Initialize Firebase Admin (Temporarily disabled for debugging)
/*
try {
    admin.initializeApp();
    console.log('Firebase Admin Initialized');
} catch (err) {
    console.warn('Firebase Admin initialization warning:', err.message);
}
*/

// Connect to database
connectDB();

// Route files
const payments = require('./routes/paymentRoutes');
const bookings = require('./routes/bookingRoutes');
const profiles = require('./routes/profileRoutes');
const subscriptions = require('./routes/subscriptionRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Body parser
app.use(express.json());

// Cookie parser
app.use(cookieParser());

// Enable CORS
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174'],
    credentials: true
}));

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
