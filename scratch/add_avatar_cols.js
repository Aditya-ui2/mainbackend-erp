const { sequelize } = require('../models/sequelizeModels');

async function runMigration() {
    console.log('Starting migration to support profile picture saving for all user types...');
    
    const queries = [
        // 1. Change DepartmentTeams avatar to TEXT
        `ALTER TABLE "DepartmentTeams" ALTER COLUMN "avatar" TYPE TEXT;`,
        
        // 2. Add avatar column to other tables if not exists
        `ALTER TABLE "super_admins" ADD COLUMN IF NOT EXISTS "avatar" TEXT;`,
        `ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "avatar" TEXT;`,
        `ALTER TABLE "team_leaders" ADD COLUMN IF NOT EXISTS "avatar" TEXT;`,
        `ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "avatar" TEXT;`,
        `ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "avatar" TEXT;`
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
