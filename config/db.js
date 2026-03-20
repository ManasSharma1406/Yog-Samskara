const { Sequelize } = require('sequelize');

// Use DATABASE_URL only if it's a real remote database (not a localhost placeholder)
const isRealDatabaseUrl = process.env.DATABASE_URL &&
    !process.env.DATABASE_URL.includes('localhost') &&
    !process.env.DATABASE_URL.includes('user:password') &&
    !process.env.DATABASE_URL.includes('127.0.0.1');

const sequelize = isRealDatabaseUrl
    ? new Sequelize(process.env.DATABASE_URL, {
        dialect: process.env.DATABASE_URL.startsWith('mysql') ? 'mysql' : 'postgres',
        logging: false,
        pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
        dialectOptions: process.env.DATABASE_URL.startsWith('mysql') ? {
            connectTimeout: 60000
        } : {}
    })
    : new Sequelize({
        dialect: 'sqlite',
        storage: './database.sqlite',
        logging: false
    });

const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log(`Database Connected via Sequelize (${sequelize.getDialect()})`);

        // Sync models (always sync in dev or if using sqlite)
        if (process.env.NODE_ENV !== 'production' || sequelize.getDialect() === 'sqlite') {
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
        }
    } catch (error) {
        console.error(`Warning: Database connection failed (${error.message}). Switching to SQLite fallback if not already using it.`);
    }
};

module.exports = { connectDB, sequelize };
