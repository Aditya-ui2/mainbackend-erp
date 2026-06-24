const { DepartmentTeam } = require('../models/sequelizeModels');
require('dotenv').config();

async function run() {
    try {
        const members = await DepartmentTeam.findAll();
        console.log(`Found ${members.length} members in DepartmentTeam:`);
        members.forEach(m => {
            console.log({ id: m.id, name: m.name, email: m.email, role: m.role, department: m.department });
        });
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
