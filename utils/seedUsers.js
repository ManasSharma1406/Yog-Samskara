const { sequelize } = require('../config/db');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Subscription = require('../models/Subscription');

const seedUsers = async () => {
    try {
        // Sync database first
        await sequelize.sync({ alter: true });
        console.log('Database synchronized.');

        const usersData = [
            {
                uid: 'local-user-manas',
                email: 'manas@example.com',
                name: 'Manas Sharma',
                plan: 'Family Plan',
                sessions: 20
            },
            {
                uid: 'local-user-bhumika',
                email: 'bhumika@example.com',
                name: 'Bhumika',
                plan: 'Personal Yoga',
                sessions: 10
            }
        ];

        for (const data of usersData) {
            // Create or update User
            const [user] = await User.findOrCreate({
                where: { email: data.email },
                defaults: {
                    firebaseUid: data.uid,
                    displayName: data.name,
                    role: 'user'
                }
            });

            // Create or update Profile
            await Profile.findOrCreate({
                where: { email: data.email },
                defaults: {
                    userFirebaseUid: data.uid,
                    displayName: data.name,
                    isComplete: true,
                    goal: 'Wellness',
                    health: 'Good',
                    styleOfYoga: 'Vinyasa'
                }
            });

            // Create or update Subscription
            await Subscription.findOrCreate({
                where: { userId: data.uid },
                defaults: {
                    planName: data.plan,
                    status: 'active',
                    totalSessions: data.sessions,
                    sessionsUsed: 2,
                    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
                }
            });
        }

        console.log('Test users Manas and Bhumika seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
};

seedUsers();
