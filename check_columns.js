const dotenv = require('dotenv');
dotenv.config();
const { sequelize } = require('./models/sequelizeModels');

async function checkColumns() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected.');

        // Get columns for DepartmentTeams
        const [columns] = await sequelize.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'DepartmentTeams' 
            ORDER BY ordinal_position;
        `);

        console.table(columns);

        // Also check if there's any other table with similar name but different case
        const [tables] = await sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name ILIKE 'department_teams%' OR table_name ILIKE 'DepartmentTeams%';
        `);
        console.log('Similar Tables:', tables);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkColumns();
