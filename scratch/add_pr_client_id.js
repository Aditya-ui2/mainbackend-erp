const { sequelize } = require('../models/sequelizeModels');

async function runMigration() {
    console.log('Adding clientId column to payment_requests table (plain UUID)...');
    try {
        const query = `ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "clientId" UUID;`;
        await sequelize.query(query);
        console.log('SUCCESS: clientId column added to payment_requests table.');
    } catch (err) {
        console.error('ERROR:', err.message);
    }
    process.exit(0);
}

runMigration();
