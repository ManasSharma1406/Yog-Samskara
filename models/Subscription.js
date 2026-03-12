const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Subscription = sequelize.define('Subscription', {
    userId: {
        type: DataTypes.STRING, // Firebase UID
        allowNull: false,
        unique: true
    },
    planName: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Free'
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive', 'pending', 'expired'),
        defaultValue: 'inactive'
    },
    totalSessions: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    sessionsUsed: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    amountPaid: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00
    },
    currency: {
        type: DataTypes.STRING,
        defaultValue: 'INR'
    },
    startDate: DataTypes.DATE,
    expiryDate: DataTypes.DATE,
    lastPaymentId: DataTypes.STRING,
    lastOrderId: DataTypes.STRING
}, {
    timestamps: true
});

module.exports = Subscription;
