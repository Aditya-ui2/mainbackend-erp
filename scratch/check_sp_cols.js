const dotenv = require('dotenv');
dotenv.config();
const { sequelize } = require('../models/sequelizeModels');

async function checkColumns() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected.');

        const [columns] = await sequelize.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'sharepoint_candidates' 
            ORDER BY ordinal_position;
        `);

        console.log('Columns in sharepoint_candidates:');
        console.table(columns);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkColumns();
