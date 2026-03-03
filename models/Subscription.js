const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    userId: {
        type: String, // Firebase UID
        required: true,
        unique: true,
        index: true
    },
    planName: {
        type: String,
        required: true,
        default: 'Free'
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'pending', 'expired'],
        default: 'inactive'
    },
    totalSessions: {
        type: Number,
        default: 0
    },
    sessionsUsed: {
        type: Number,
        default: 0
    },
    amountPaid: {
        type: Number,
        default: 0
    },
    currency: {
        type: String,
        default: 'INR'
    },
    startDate: Date,
    expiryDate: Date,
    lastPaymentId: String,
    lastOrderId: String
}, {
    timestamps: true
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
