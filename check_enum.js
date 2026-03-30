const dotenv = require('dotenv');
dotenv.config();
const { sequelize } = require('./models/sequelizeModels');

async function checkEnum() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected.');

        // Check enum values for DepartmentTeams.department
        const [enums] = await sequelize.query(`
            SELECT enumlabel 
            FROM pg_enum 
            JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
            WHERE typname LIKE 'enum_%department%';
        `);
        console.log('--- Department Enums ---');
        console.table(enums);

        const [enums2] = await sequelize.query(`
            SELECT enumlabel 
            FROM pg_enum 
            JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
            WHERE typname LIKE 'public.enum_%' OR typname LIKE 'enum_%';
        `);
        console.log('--- All Enums ---');
        console.table(enums2);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkEnum();
