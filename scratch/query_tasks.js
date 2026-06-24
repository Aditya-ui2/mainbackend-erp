const { sequelize } = require('../models/sequelizeModels');
const dotenv = require('dotenv');
dotenv.config();

async function checkTasks() {
    try {
        console.log('Locating Priyanshi...');
        const tables = ['employees', 'team_leaders', 'admins', 'super_admins'];
        let priyanshiId = null;
        for (const table of tables) {
            const [rows] = await sequelize.query(`SELECT id, name, email FROM ${table} WHERE email LIKE '%priyanshi%'`);
            if (rows.length > 0) {
                console.log(`Found Priyanshi in table '${table}':`, rows);
                priyanshiId = rows[0].id;
            }
        }

        if (!priyanshiId) {
            console.log('Priyanshi not found in any database table.');
            process.exit(0);
        }

        console.log(`Checking tasks for Priyanshi ID: ${priyanshiId}...`);
        const [tasks] = await sequelize.query(`SELECT id, title, "assignedToId", "assignedToType", status FROM tasks WHERE "assignedToId" = '${priyanshiId}'`);
        console.log(`Found ${tasks.length} tasks assigned to her directly:`, tasks);

        const [allTasks] = await sequelize.query(`SELECT count(*)::int as count FROM tasks`);
        console.log(`Total tasks in system: ${allTasks[0].count}`);

        process.exit(0);
    } catch (err) {
        console.error('Error querying tasks:', err.message);
        process.exit(1);
    }
}

checkTasks();
