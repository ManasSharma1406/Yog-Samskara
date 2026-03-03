const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: {
        type: String, // Changed from ObjectId to String for Firebase UID compatibility
        required: true,
        index: true
    },
    orderId: {
        type: String,
        required: true,
        unique: true
    },
    paymentId: {
        type: String
    },
    signature: {
        type: String
    },
    planName: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        required: true,
        default: 'INR'
    },
    status: {
        type: String,
        enum: ['pending', 'captured', 'failed'],
        default: 'pending'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Transaction', transactionSchema);
