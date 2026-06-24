require('dotenv').config();
const { DepartmentTeam, DepartmentTask, sequelize } = require('../models/sequelizeModels');

async function check() {
    try {
        await sequelize.authenticate();
        console.log('--- DEPARTMENT TEAMS ---');
        const members = await DepartmentTeam.findAll({
            attributes: ['id', 'name', 'email', 'role', 'department']
        });
        console.log(JSON.stringify(members, null, 2));

        console.log('\n--- DEPARTMENT TASKS ---');
        const tasks = await DepartmentTask.findAll({
            attributes: ['id', 'title', 'department', 'assignedTo', 'assignedToName', 'assignedBy', 'assignedByName', 'status']
        });
        console.log(JSON.stringify(tasks, null, 2));

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await sequelize.close();
    }
}

check();
