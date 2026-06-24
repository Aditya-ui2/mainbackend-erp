require('dotenv').config();
const { sequelize } = require('../models/sequelizeModels');

async function patch() {
    try {
        console.log('Running manual patch...');
        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS "addedByType" VARCHAR(255)');
        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS "kycDocuments" JSONB');
        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS "password" VARCHAR(255)');
        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS "username" VARCHAR(255)');
        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS "rawPassword" VARCHAR(255)');
        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS "bgvStatus" VARCHAR(255) DEFAULT \'Not Started\'');
        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS "firebaseUid" VARCHAR(255)');
        console.log('Manual patch completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Manual patch failed:', error.message);
        process.exit(1);
    }
}

patch();
