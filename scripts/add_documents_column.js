const { sequelize } = require('../models/sequelizeModels');

async function runMigration() {
    try {
        console.log('--- Migrating Database for Documents Column ---');
        
        // 1. Alter employees table
        await sequelize.query('ALTER TABLE employees ADD COLUMN IF NOT EXISTS "documents" JSONB DEFAULT \'{}\';');
        console.log('Added "documents" column to employees table.');
        
        // 2. Alter team_leaders table
        await sequelize.query('ALTER TABLE team_leaders ADD COLUMN IF NOT EXISTS "documents" JSONB DEFAULT \'{}\';');
        console.log('Added "documents" column to team_leaders table.');
        
        // 3. Alter DepartmentTeams table
        await sequelize.query('ALTER TABLE "DepartmentTeams" ADD COLUMN IF NOT EXISTS "documents" JSONB DEFAULT \'{}\';');
        console.log('Added "documents" column to DepartmentTeams table.');
        
        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    }
}

runMigration();
