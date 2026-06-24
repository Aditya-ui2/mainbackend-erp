const { DepartmentTeam, Employee, Client, TeamLeader } = require('../models/sequelizeModels');

async function listUsers() {
    console.log('--- DepartmentTeam ---');
    const dts = await DepartmentTeam.findAll();
    dts.forEach(d => console.log(d.id, d.name, d.email, d.role, d.department));

    console.log('--- Employee ---');
    const emps = await Employee.findAll();
    emps.forEach(e => console.log(e.id, e.name, e.email, e.role));

    console.log('--- Client ---');
    const cls = await Client.findAll();
    cls.forEach(c => console.log(c.id, c.name, c.email, c.companyName));

    console.log('--- TeamLeader ---');
    const tls = await TeamLeader.findAll();
    tls.forEach(t => console.log(t.id, t.name, t.email, t.department));

    process.exit(0);
}

listUsers();
