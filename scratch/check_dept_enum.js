const dotenv = require('dotenv');
dotenv.config();
const { sequelize } = require('../models/sequelizeModels');

async function checkEnum() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected.');

        const [results] = await sequelize.query(`
            SELECT enumlabel 
            FROM pg_enum 
            JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
            WHERE typname = 'enum_DepartmentTeams_department';
        `);

        console.log('Labels in enum_DepartmentTeams_department:');
        console.table(results);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkEnum();
