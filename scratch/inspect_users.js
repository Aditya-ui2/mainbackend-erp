const { SuperAdmin, Admin, TeamLeader, Employee, DepartmentTeam } = require('../models/sequelizeModels');

async function run() {
    try {
        console.log('--- SuperAdmins ---');
        const superAdmins = await SuperAdmin.findAll();
        superAdmins.forEach(u => console.log(`SuperAdmin: ID=${u.id}, Email=${u.email}, Status=${u.status}`));

        console.log('\n--- Admins ---');
        const admins = await Admin.findAll();
        admins.forEach(u => console.log(`Admin: ID=${u.id}, Email=${u.email}, Status=${u.status}`));

        console.log('\n--- TeamLeaders ---');
        const tls = await TeamLeader.findAll();
        tls.forEach(u => console.log(`TeamLeader: ID=${u.id}, Email=${u.email}, Status=${u.status}`));

        console.log('\n--- Employees ---');
        const employees = await Employee.findAll();
        employees.forEach(u => console.log(`Employee: ID=${u.id}, Email=${u.email}, Status=${u.status}`));

        console.log('\n--- DepartmentTeam ---');
        const dts = await DepartmentTeam.findAll();
        dts.forEach(u => console.log(`DepartmentTeam: ID=${u.id}, Email=${u.email}, Status=${u.status}`));

    } catch (error) {
        console.error('Error querying users:', error);
    }
    process.exit(0);
}

run();
