const { sequelize } = require('../models/sequelizeModels');
const dotenv = require('dotenv');
dotenv.config();

async function showTables() {
    try {
        const [rows] = await sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log('Tables in database:');
        console.log(rows.map(r => r.table_name));
        process.exit(0);
    } catch (err) {
        console.error('Error showing tables:', err.message);
        process.exit(1);
    }
}

showTables();
