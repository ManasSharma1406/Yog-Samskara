const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Profile = sequelize.define('Profile', {
    userFirebaseUid: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    displayName: {
        type: DataTypes.STRING
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    age: DataTypes.STRING,
    dob: DataTypes.STRING,
    health: {
        type: DataTypes.STRING,
        defaultValue: 'Good'
    },
    bmi: DataTypes.STRING,
    goal: DataTypes.TEXT,
    styleOfYoga: DataTypes.STRING,
    experienceLevel: DataTypes.STRING,
    otherPhysicalActivity: DataTypes.TEXT,
    medicalCondition: {
        type: DataTypes.TEXT,
        defaultValue: 'None'
    },
    historyOfInjury: {
        type: DataTypes.TEXT,
        defaultValue: 'None'
    },
    // Kosha Balance (Ratings 1-10)
    annamaya: { type: DataTypes.INTEGER, defaultValue: 5 },
    pranamaya: { type: DataTypes.INTEGER, defaultValue: 5 },
    manomaya: { type: DataTypes.INTEGER, defaultValue: 5 },
    vijnanamaya: { type: DataTypes.INTEGER, defaultValue: 5 },
    anandamaya: { type: DataTypes.INTEGER, defaultValue: 5 },
    // Emergency Contact
    emergencyContactName: DataTypes.STRING,
    emergencyContactPhone: DataTypes.STRING,
    // Health Details
    medications: DataTypes.TEXT,
    surgeries: DataTypes.TEXT,
    cardioHealth: DataTypes.TEXT,
    respiratoryHealth: DataTypes.TEXT,
    isPregnant: { type: DataTypes.BOOLEAN, defaultValue: false },
    // Contract
    waiverAccepted: { type: DataTypes.BOOLEAN, defaultValue: false },
    isComplete: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
    timestamps: true
});

module.exports = Profile;
