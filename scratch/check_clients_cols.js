const dotenv = require('dotenv');
dotenv.config();
const { sequelize } = require('../models/sequelizeModels');

async function checkClientsTable() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to DB.');

        const [columns] = await sequelize.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'clients'
            ORDER BY column_name;
        `);

        console.log('CLIENTS_COLUMNS:', columns.map(c => c.column_name).join(', '));
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkClientsTable();
