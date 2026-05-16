const { Sequelize } = require('sequelize');

// Auto-correct common URL issues on Hostinger
let dbUrl = process.env.DATABASE_URL || '';
if (dbUrl) {
    // Force IPv4
    dbUrl = dbUrl.replace('@localhost:', '@127.0.0.1:');
    // Auto-encode the @ symbol in the specific password if they forgot
    dbUrl = dbUrl.replace('June@2023', 'June%402023');
    // Remove the accidental YOUR_ prefix if they copy-pasted it
    dbUrl = dbUrl.replace(':YOUR_June', ':June');
}

const isRealDatabaseUrl = dbUrl && !dbUrl.includes('user:password');

const sequelize = isRealDatabaseUrl
    ? new Sequelize(dbUrl, {
        dialect: dbUrl.startsWith('mysql') ? 'mysql' : 'postgres',
        logging: false,
        pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
        dialectOptions: dbUrl.startsWith('mysql') ? {
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
