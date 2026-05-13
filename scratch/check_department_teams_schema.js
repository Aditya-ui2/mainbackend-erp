const { sequelize } = require('../models/sequelizeModels');
const dotenv = require('dotenv');
dotenv.config();

async function checkDepartmentTeamsSchema() {
    try {
        const [results] = await sequelize.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'DepartmentTeams'");
        console.log('Columns in DepartmentTeams table:', JSON.stringify(results, null, 2));
        
        // Check department ENUM values
        const [enumResults] = await sequelize.query(`
            SELECT enumlabel 
            FROM pg_enum 
            JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
            WHERE typname = 'enum_DepartmentTeams_department'
        `).catch(() => [[]]);
        console.log('ENUM values for department:', enumResults.map(r => r.enumlabel));

        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

checkDepartmentTeamsSchema();
