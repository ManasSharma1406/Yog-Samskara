const { Sequelize } = require('sequelize');

// Use DATABASE_URL if provided and not the exact placeholder string
const isRealDatabaseUrl = process.env.DATABASE_URL &&
    !process.env.DATABASE_URL.includes('user:password');

const sequelize = isRealDatabaseUrl
    ? new Sequelize(process.env.DATABASE_URL, {
        dialect: process.env.DATABASE_URL.startsWith('mysql') ? 'mysql' : 'postgres',
        logging: false,
        pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
        dialectOptions: process.env.DATABASE_URL.startsWith('mysql') ? {
            connectTimeout: 60000
        } : {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        }
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
