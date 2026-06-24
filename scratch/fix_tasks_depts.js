const { sequelize } = require('../models/sequelizeModels');
require('dotenv').config();

async function fixTasks() {
    try {
        console.log("=== Updating Stale Task Departments ===");
        const [result] = await sequelize.query(`
            UPDATE "DepartmentTasks"
            SET "department" = 'IT'
            WHERE "assignedTo" = '17fd18b2-1634-4e43-a30e-fbda8bce1233'
        `);
        console.log("Update result:", result);
        process.exit(0);
    } catch (err) {
        console.error('Error updating tasks:', err);
        process.exit(1);
    }
}

fixTasks();
