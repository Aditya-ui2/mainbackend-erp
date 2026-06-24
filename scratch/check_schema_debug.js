const dotenv = require('dotenv');
dotenv.config();
const { sequelize } = require('./models/sequelizeModels');

async function checkColumns() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected.');

        const tablesToCheck = ['clients', 'candidates', 'DepartmentTeams'];
        
        for (const tableName of tablesToCheck) {
            console.log(`\n--- Columns for ${tableName} ---`);
            const [columns] = await sequelize.query(`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_name = '${tableName}' 
                ORDER BY ordinal_position;
            `);
            console.table(columns);
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkColumns();
