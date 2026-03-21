const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const PromoCode = sequelize.define('PromoCode', {
    code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    discountPercentage: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 0,
            max: 100
        }
    },
    maxUses: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    currentUses: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    timestamps: true
});

module.exports = PromoCode;
