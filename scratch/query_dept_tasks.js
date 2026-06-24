const { sequelize } = require('../models/sequelizeModels');
const dotenv = require('dotenv');
dotenv.config();

async function checkTasks() {
    try {
        const id = 'ffd606f2-459c-4bc1-8f4b-52b88663fed3';
        console.log(`Checking 'tasks' table for assignedToId = ${id}...`);
        const [mainTasks] = await sequelize.query(`SELECT * FROM tasks WHERE "assignedToId" = '${id}'`);
        console.log(`Found in 'tasks' table:`, mainTasks);

        console.log(`Checking 'DepartmentTasks' table for assignedToId = ${id} or similar...`);
        // Let's first describe columns of DepartmentTasks
        const [cols] = await sequelize.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'DepartmentTasks'
        `);
        console.log('DepartmentTasks columns:', cols.map(c => c.column_name));

        const [deptTasks] = await sequelize.query(`SELECT * FROM "DepartmentTasks" WHERE "assignedToId" = '${id}' OR "assignedTo" = '${id}'`);
        console.log(`Found in 'DepartmentTasks' table:`, deptTasks);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkTasks();
