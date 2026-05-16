require('dotenv').config();
const { connectDB, sequelize } = require('../config/db');
const PromoCode = require('../models/PromoCode');

const createPromos = async () => {
    try {
        console.log('Connecting to database...');
        await connectDB();
        
        const promos = [
            { code: 'YOSA30', discountPercentage: 30, maxUses: 10, currentUses: 0, isActive: true },
            { code: 'YOSA45', discountPercentage: 45, maxUses: 10, currentUses: 0, isActive: true },
            { code: 'YOSA10', discountPercentage: 10, maxUses: 10, currentUses: 0, isActive: true }
        ];

        for (const promo of promos) {
            const [record, created] = await PromoCode.findOrCreate({
                where: { code: promo.code },
                defaults: promo
            });
            if (created) {
                console.log(`✅ Successfully created promo code: ${promo.code} (${promo.discountPercentage}% off, max 10 uses)`);
            } else {
                console.log(`🔄 Promo code ${promo.code} already exists. Updating its limits...`);
                await record.update(promo);
            }
        }

        console.log('\n🎉 All promo codes processed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to create promo codes:', err);
        process.exit(1);
    }
};

createPromos();
