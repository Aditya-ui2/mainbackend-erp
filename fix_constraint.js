const dotenv = require('dotenv');
dotenv.config();
const { sequelize } = require('./models/sequelizeModels');

async function fixConstraint() {
    try {
        console.log('--- Database Constraint Fixer ---');
        console.log('Connecting to:', process.env.DB_HOST);
        
        // Test connection
        await sequelize.authenticate();
        console.log('✅ Connection established successfully.');

        // Drop the problematic foreign key constraint
        // The error message specifically mentioned "DepartmentTeams_managerId_fkey1"
        const query = 'ALTER TABLE "DepartmentTeams" DROP CONSTRAINT IF EXISTS "DepartmentTeams_managerId_fkey1";';
        console.log('Executing:', query);
        
        await sequelize.query(query);
        console.log('✅ Constraint dropped successfully (if it existed).');

        // Also try the base name in case it varied
        await sequelize.query('ALTER TABLE "DepartmentTeams" DROP CONSTRAINT IF EXISTS "DepartmentTeams_managerId_fkey";');
        console.log('✅ Second variant checked.');

        console.log('--- Fix Complete ---');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error fixing constraint:', error.message);
        if (error.original) {
            console.error('Original Error:', error.original.message);
        }
        process.exit(1);
    }
}

fixConstraint();
