const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Booking = sequelize.define('Booking', {
    userId: {
        type: DataTypes.STRING, // Firebase UID
        allowNull: false
    },
    userName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    userEmail: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isEmail: true
        }
    },
    date: {
        type: DataTypes.STRING, // "YYYY-MM-DD"
        allowNull: false
    },
    time: {
        type: DataTypes.STRING, // e.g., "10:00 AM"
        allowNull: false
    },
    sessionType: {
        type: DataTypes.STRING,
        defaultValue: '1:1 Coaching'
    },
    focusArea: {
        type: DataTypes.STRING,
        defaultValue: 'Mindfulness'
    },
    intensity: {
        type: DataTypes.INTEGER,
        defaultValue: 50
    },
    status: {
        type: DataTypes.ENUM('confirmed', 'cancelled', 'completed'),
        defaultValue: 'confirmed'
    },
    meetingLink: {
        type: DataTypes.TEXT
    }
}, {
    timestamps: true
});

module.exports = Booking;
