const { sequelize } = require('../models/sequelizeModels');

async function runMigration() {
    console.log('Starting migration to add picture column to support profile picture saving for all user types...');
    
    const queries = [
        `ALTER TABLE "super_admins" ADD COLUMN IF NOT EXISTS "picture" TEXT;`,
        `ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "picture" TEXT;`,
        `ALTER TABLE "team_leaders" ADD COLUMN IF NOT EXISTS "picture" TEXT;`,
        `ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "picture" TEXT;`
    ];

    for (const query of queries) {
        try {
            console.log(`Executing: ${query}`);
            await sequelize.query(query);
            console.log('SUCCESS');
        } catch (err) {
            console.error(`ERROR: ${err.message}`);
        }
    }
    
    console.log('Migration finished.');
    process.exit(0);
}

runMigration();
