const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);

        // Handle errors after initial connection
        mongoose.connection.on('error', err => {
            console.error('Mongoose Connection Error! 💥');
            console.error(err);
        });
    } catch (error) {
        console.error(`Warning: MongoDB connection failed (${error.message}). Some features may be unavailable.`);
        // Don't exit process, allow other utilities to run
    }
};

module.exports = connectDB;
