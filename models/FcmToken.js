const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const FcmToken = sequelize.define('FcmToken', {
    userId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    token: {
        type: DataTypes.TEXT,
        allowNull: false
    }
}, {
    timestamps: true,
    tableName: 'fcm_tokens',
    indexes: [
        {
            unique: true,
            fields: ['userId', 'token']
        },
        {
            fields: ['userId']
        }
    ]
});

module.exports = FcmToken;
