const { sequelize } = require('../models/sequelizeModels');
require('dotenv').config();

async function checkUser() {
    try {
        console.log("=== Checking Ashish Sirrrr ===");
        const [sa] = await sequelize.query(`SELECT id, name, email FROM super_admins WHERE name LIKE '%Ashish%'`);
        console.log("SuperAdmins:", sa);

        const [admins] = await sequelize.query(`SELECT id, name, email, department FROM admins WHERE name LIKE '%Ashish%'`);
        console.log("Admins:", admins);

        const [dt] = await sequelize.query(`SELECT id, name, email, department FROM "DepartmentTeams" WHERE name LIKE '%Ashish%'`);
        console.log("DepartmentTeams:", dt);

        process.exit(0);
    } catch (err) {
        console.error('Error running check:', err);
        process.exit(1);
    }
}

checkUser();
