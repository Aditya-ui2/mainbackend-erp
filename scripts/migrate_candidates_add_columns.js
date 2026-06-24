const { sequelize } = require('../models/sequelizeModels');

async function runMigration() {
    try {
        console.log('--- Migrating Database for New Candidate Columns ---');
        
        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS "currentJobRole" VARCHAR(255);');
        console.log('Added "currentJobRole" column to candidates table.');

        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS "currentDesignation" VARCHAR(255);');
        console.log('Added "currentDesignation" column to candidates table.');

        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS "hometown" VARCHAR(255);');
        console.log('Added "hometown" column to candidates table.');

        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS "preferredLocation" VARCHAR(255);');
        console.log('Added "preferredLocation" column to candidates table.');

        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS "relevantExperience" VARCHAR(255);');
        console.log('Added "relevantExperience" column to candidates table.');

        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS "highestQualification" VARCHAR(255);');
        console.log('Added "highestQualification" column to candidates table.');

        await sequelize.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS "reasonForLeaving" TEXT;');
        console.log('Added "reasonForLeaving" column to candidates table.');

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    }
}

runMigration();
