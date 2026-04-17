require('dotenv').config();
const { sequelize } = require('../models/sequelizeModels');

async function check() {
    try {
        const [results] = await sequelize.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'candidates'");
        console.log('Columns in candidates table:');
        console.log(results.map(r => r.column_name).sort());
        process.exit(0);
    } catch (error) {
        console.error('Check failed:', error.message);
        process.exit(1);
    }
}

check();
