const { sequelize } = require('../models/sequelizeModels');
const dotenv = require('dotenv');
dotenv.config();

async function locateUsers() {
    try {
        const tables = ['employees', 'team_leaders', 'admins', 'super_admins', '"DepartmentTeams"'];
        for (const table of tables) {
            const [rows] = await sequelize.query(`SELECT id, name, email FROM ${table}`);
            console.log(`Found users in table ${table}:`, rows);
        }
        process.exit(0);
    } catch (err) {
        console.error('Error locating users:', err.message);
        process.exit(1);
    }
}

locateUsers();
