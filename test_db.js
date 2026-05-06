const { sequelize } = require('./config/db');
const Booking = require('./models/Booking');

async function test() {
    try {
        await sequelize.authenticate();
        await sequelize.sync({ alter: true });
        const count = await Booking.count({ where: { reminderSent: false } });
        console.log("Success! Count of reminderSent=false:", count);
    } catch (err) {
        console.error("Error:", err.message);
    }
}
test();
