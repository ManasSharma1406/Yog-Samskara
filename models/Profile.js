const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    age: String,
    dob: String,
    health: {
        type: String,
        default: 'Good'
    },
    bmi: String,
    goal: String,
    styleOfYoga: String,
    experienceLevel: String,
    otherPhysicalActivity: String,
    medicalCondition: {
        type: String,
        default: 'None'
    },
    historyOfInjury: {
        type: String,
        default: 'None'
    },
    // Kosha Balance (Ratings 1-10)
    annamaya: { type: Number, default: 5 },
    pranamaya: { type: Number, default: 5 },
    manomaya: { type: Number, default: 5 },
    vijnanamaya: { type: Number, default: 5 },
    anandamaya: { type: Number, default: 5 },
    // Emergency Contact
    emergencyContactName: String,
    emergencyContactPhone: String,
    // Health Details
    medications: String,
    surgeries: String,
    cardioHealth: String,
    respiratoryHealth: String,
    isPregnant: { type: Boolean, default: false },
    // Contract
    waiverAccepted: { type: Boolean, default: false },
    isComplete: { type: Boolean, default: false }
}, {
    timestamps: true
});

module.exports = mongoose.model('Profile', profileSchema);
