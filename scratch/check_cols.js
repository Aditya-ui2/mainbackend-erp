const { sequelize } = require('../models/sequelizeModels');

async function checkColumns() {
    const tables = ['super_admins', 'admins', 'team_leaders', 'employees', 'clients', 'DepartmentTeams'];
    
    for (const table of tables) {
        try {
            const [results] = await sequelize.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = '${table}'
            `);
            console.log(`\n--- Columns in table: ${table} ---`);
            const colNames = results.map(r => r.column_name);
            console.log(colNames.join(', '));
        } catch (err) {
            console.error(`Error checking table ${table}:`, err.message);
        }
    }
    process.exit(0);
}

checkColumns();
