const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Transaction = sequelize.define('Transaction', {
    userId: {
        type: DataTypes.STRING, // Firebase UID
        allowNull: false
    },
    orderId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    paymentId: {
        type: DataTypes.STRING
    },
    signature: {
        type: DataTypes.TEXT
    },
    planName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    currency: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'INR'
    },
    status: {
        type: DataTypes.ENUM('pending', 'captured', 'failed'),
        defaultValue: 'pending'
    }
}, {
    timestamps: true
});

module.exports = Transaction;
