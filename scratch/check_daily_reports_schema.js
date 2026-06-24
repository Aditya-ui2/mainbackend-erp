const { sequelize } = require('../models/sequelizeModels');
const dotenv = require('dotenv');
dotenv.config();

async function checkDailyReportsSchema() {
    try {
        const [results] = await sequelize.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'DailyReports'");
        console.log('Columns in DailyReports table:', JSON.stringify(results, null, 2));
        
        // Also check ENUM values for department if it's a user-defined type
        const [enumResults] = await sequelize.query(`
            SELECT enumlabel 
            FROM pg_enum 
            JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
            WHERE typname = 'enum_DailyReports_department'
        `).catch(() => [[]]);
        console.log('ENUM values for department:', enumResults.map(r => r.enumlabel));

        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

checkDailyReportsSchema();
