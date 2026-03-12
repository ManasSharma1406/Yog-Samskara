/**
 * One-time seed: Import bookings from data/bookings.json into SQLite
 * Run: node scripts/seedBookings.js (from backend folder)
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
// Load models before db
require('../models/Profile');
require('../models/Booking');
const { sequelize } = require('../config/db');
const Booking = require('../models/Booking');

async function seed() {
    const jsonPath = path.join(__dirname, '../data/bookings.json');
    if (!fs.existsSync(jsonPath)) {
        console.log('No bookings.json found');
        process.exit(0);
    }
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const filtered = data.filter(b => b.userId !== 'guest' && b.userEmail !== 'test@example.com');
    if (filtered.length === 0) {
        console.log('No valid bookings to seed');
        process.exit(0);
    }
    await sequelize.sync();
    const existing = await Booking.count();
    if (existing > 0) {
        console.log('Bookings already exist in DB. Skipping seed. Users should appear in instructor portal.');
        process.exit(0);
    }
    for (const b of filtered) {
        const intensity = typeof b.intensity === 'number' ? b.intensity : 50;
        await Booking.create({
            userId: b.userId,
            userName: b.userName,
            userEmail: b.userEmail,
            date: String(b.date),
            time: String(b.time),
            sessionType: b.sessionType || '1:1 Coaching',
            focusArea: b.focusArea || 'Mindfulness',
            intensity,
            status: b.status || 'confirmed',
            meetingLink: b.meetingLink || null,
        });
    }
    console.log(`Seeded ${filtered.length} bookings. Instructor portal should now show Manas, Bhumika, etc.`);
    process.exit(0);
}

seed().catch(err => {
    console.error(err);
    process.exit(1);
});
