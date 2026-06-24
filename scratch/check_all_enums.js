const { sequelize } = require('../models/sequelizeModels');
const dotenv = require('dotenv');
dotenv.config();

async function checkAllDepartmentEnums() {
    try {
        const [results] = await sequelize.query(`
            SELECT typname, array_agg(enumlabel) as values
            FROM pg_enum 
            JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
            WHERE typname LIKE '%department%'
            GROUP BY typname
        `);
        console.log('All Department ENUMs in DB:', JSON.stringify(results, null, 2));

        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

checkAllDepartmentEnums();
