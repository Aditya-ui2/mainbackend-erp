const dotenv = require('dotenv');
dotenv.config();
const { sequelize } = require('../models/sequelizeModels');

async function fixSchema() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected.');

        console.log('Adding columns to sharepoint_candidates...');
        await sequelize.query('ALTER TABLE sharepoint_candidates ADD COLUMN IF NOT EXISTS "resumeUrl" VARCHAR(255)');
        await sequelize.query('ALTER TABLE sharepoint_candidates ADD COLUMN IF NOT EXISTS "cvUrl" VARCHAR(255)');
        
        console.log('Adding "Finance" to DepartmentTeam department enum...');
        // In PostgreSQL, adding a value to an enum is done with ALTER TYPE
        try {
            await sequelize.query("ALTER TYPE \"enum_DepartmentTeams_department\" ADD VALUE IF NOT EXISTS 'Finance'");
            await sequelize.query("ALTER TYPE \"enum_DepartmentTeams_department\" ADD VALUE IF NOT EXISTS 'Sales'");
            await sequelize.query("ALTER TYPE \"enum_DepartmentTeams_department\" ADD VALUE IF NOT EXISTS 'IT'");
        } catch (e) {
            console.log('Enum update (Finance/Sales/IT) might have failed or values already exist:', e.message);
        }

        console.log('✅ Schema fixed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

fixSchema();
