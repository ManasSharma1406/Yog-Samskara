const fs = require('fs').promises;
const path = require('path');

const BOOKINGS_PATH = path.join(__dirname, '../data/bookings.json');
const PROFILES_PATH = path.join(__dirname, '../data/profiles.json');

/**
 * Initialize a JSON file if it doesn't exist
 */
const initFile = async (filePath) => {
    try {
        await fs.access(filePath);
    } catch (error) {
        // File doesn't exist, create it with empty array
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, JSON.stringify([], null, 2));
        console.log('Initialized storage at:', filePath);
    }
};

/**
 * Save a new booking to the JSON file
 * @param {Object} bookingData 
 */
const saveBookingToJson = async (bookingData) => {
    try {
        await initFile(BOOKINGS_PATH);
        const data = await fs.readFile(BOOKINGS_PATH, 'utf8');
        const bookings = JSON.parse(data);

        const newBooking = {
            id: Date.now().toString(),
            ...bookingData,
            createdAt: new Date().toISOString()
        };

        bookings.push(newBooking);
        await fs.writeFile(BOOKINGS_PATH, JSON.stringify(bookings, null, 2));
        return newBooking;
    } catch (error) {
        console.error('Error saving booking to JSON storage:', error);
        throw error;
    }
};

/**
 * Get all bookings from the JSON file
 */
const getAllBookings = async () => {
    try {
        await initFile(BOOKINGS_PATH);
        const data = await fs.readFile(BOOKINGS_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading bookings from JSON storage:', error);
        return [];
    }
};

/**
 * Save or update a profile in the JSON file
 * @param {Object} profileData 
 */
const saveProfileToJson = async (profileData) => {
    try {
        await initFile(PROFILES_PATH);
        const data = await fs.readFile(PROFILES_PATH, 'utf8');
        let profiles = JSON.parse(data);

        const index = profiles.findIndex(p => p.email === profileData.email);
        if (index !== -1) {
            profiles[index] = { ...profiles[index], ...profileData, updatedAt: new Date().toISOString() };
        } else {
            profiles.push({ ...profileData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        }

        await fs.writeFile(PROFILES_PATH, JSON.stringify(profiles, null, 2));
        return profileData;
    } catch (error) {
        console.error('Error saving profile to JSON storage:', error);
        throw error;
    }
};

/**
 * Get a profile by email
 * @param {string} email 
 */
const getProfileByEmail = async (email) => {
    try {
        await initFile(PROFILES_PATH);
        const data = await fs.readFile(PROFILES_PATH, 'utf8');
        const profiles = JSON.parse(data);
        return profiles.find(p => p.email === email) || null;
    } catch (error) {
        console.error('Error reading profile from JSON storage:', error);
        return null;
    }
};

module.exports = {
    saveBookingToJson,
    getAllBookings,
    saveProfileToJson,
    getProfileByEmail
};

