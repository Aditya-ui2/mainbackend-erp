require('dotenv').config();
const { sequelize } = require('../models/sequelizeModels');

async function run() {
    try {
        console.log('Altering DepartmentTasks table...');
        await sequelize.query('ALTER TABLE "DepartmentTasks" ALTER COLUMN "assignedTo" TYPE VARCHAR(255);');
        await sequelize.query('ALTER TABLE "DepartmentTasks" ALTER COLUMN "assignedBy" TYPE VARCHAR(255);');
        console.log('Successfully altered columns to VARCHAR(255)');
        process.exit(0);
    } catch (err) {
        console.error('Error altering table:', err.message);
        process.exit(1);
    }
}

run();
