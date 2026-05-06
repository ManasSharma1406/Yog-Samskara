const Subscription = require('./models/Subscription');
const { connectDB, sequelize } = require('./config/db');

async function fixSubscriptions() {
    await connectDB();
    const subs = await Subscription.findAll({ where: { status: 'active', totalSessions: 0 } });
    
    for (let sub of subs) {
        let sessions = 1;

        if (sub.planName.includes('Drop-In')) {
            sessions = 1;
        } else if (sub.planName.includes('Family of 2')) {
            sessions = 24;
        } else if (sub.planName.includes('Family of 3')) {
            sessions = 32;
        } else if (sub.planName.includes('Family of 4')) {
            sessions = 40;
        } else if (sub.planName.includes('4-Week Journey')) {
            sessions = 8;
        } else if (sub.planName.includes('Deep Foundation')) {
            sessions = 12;
        } else if (sub.planName.includes('Transformation')) {
            sessions = 16;
        } else if (sub.planName.includes('Total Immersion')) {
            sessions = 20;
        } else {
            const match = sub.planName.match(/(\d+)\s*[- ]*(Class|Session)/i);
            if (match) {
                sessions = parseInt(match[1], 10);
            } else {
                if (sub.planName.includes('Personal')) sessions = 12;
                else if (sub.planName.includes('Family')) sessions = 24;
                else if (sub.planName.includes('Immersive')) { sessions = 32; }
            }
        }
        
        const expiry = new Date(sub.startDate || new Date());
        expiry.setMonth(expiry.getMonth() + 2); // default 2 months

        await sub.update({ totalSessions: sessions, expiryDate: expiry });
        console.log(`Updated sub ${sub.id} (${sub.planName}) to ${sessions} sessions.`);
    }

    console.log("Done.");
    process.exit(0);
}

fixSubscriptions().catch(err => {
    console.error(err);
    process.exit(1);
});
