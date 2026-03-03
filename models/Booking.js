const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    userId: {
        type: String, // Firebase UID
        required: true,
        index: true
    },
    userName: {
        type: String,
        required: true
    },
    userEmail: {
        type: String,
        required: true
    },
    date: {
        type: String, // Storing as string "YYYY-MM-DD" for simplicity with current frontend
        required: true
    },
    time: {
        type: String, // e.g., "10:00 AM"
        required: true
    },
    sessionType: {
        type: String,
        default: '1:1 Coaching'
    },
    focusArea: {
        type: String,
        default: 'Mindfulness'
    },
    intensity: {
        type: Number,
        default: 50
    },
    status: {
        type: String,
        enum: ['confirmed', 'cancelled', 'completed'],
        default: 'confirmed'
    },
    meetingLink: {
        type: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Booking', bookingSchema);
