const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize(
    process.env.DB_NAME || 'u916218583_yosa',
    process.env.DB_USER || 'u916218583_bhumikahardiya',
    process.env.DB_PASSWORD || 'June@2023.123456789',
    {
        host: process.env.DB_HOST || 'localhost',
        dialect: 'mysql',
        logging: false,
        pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
        dialectOptions: { connectTimeout: 60000 }
    }
);

const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log(`Database Connected via Sequelize (${sequelize.getDialect()})`);

        // Sync models (always sync to ensure schemas like PromoCodes are created in production DBs)
        await sequelize.sync({ alter: true });
        console.log('Database models synchronized');
        // Ensure displayName column exists (migration for existing SQLite DBs)
        if (sequelize.getDialect() === 'sqlite') {
            try {
                await sequelize.query('ALTER TABLE Profiles ADD COLUMN displayName VARCHAR(255)');
                console.log('Added displayName column to Profiles');
            } catch (e) {
                if (!e.message?.includes('duplicate column name')) {
                    console.warn('displayName migration:', e.message);
                }
            }
        }
    } catch (error) {
        console.error(`Warning: Database connection failed (${error.message}). Switching to SQLite fallback if not already using it.`);
    }
};

module.exports = { connectDB, sequelize };
