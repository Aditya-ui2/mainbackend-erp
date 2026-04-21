require('dotenv').config();
const { sequelize } = require('../models/sequelizeModels');

async function check() {
    try {
        const [results] = await sequelize.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'DepartmentTasks' 
            AND column_name IN ('assignedTo', 'assignedBy')
        `);
        console.log(JSON.stringify(results, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
}

check();
