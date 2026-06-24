require('dotenv').config();
const { Admin, SuperAdmin, TeamLeader, Employee, DepartmentTeam, sequelize } = require('../models/sequelizeModels');

async function find() {
    try {
        await sequelize.authenticate();
        console.log('Postgres connected.');

        const email = 'tech.mabicons@gmail.com';

        const admin = await Admin.findOne({ where: { email } });
        if (admin) console.log('Found in Admin:', { id: admin.id, name: admin.name, role: admin.role, department: admin.department });

        const superAdmin = await SuperAdmin.findOne({ where: { email } });
        if (superAdmin) console.log('Found in SuperAdmin:', { id: superAdmin.id, name: superAdmin.name });

        const tl = await TeamLeader.findOne({ where: { email } });
        if (tl) console.log('Found in TeamLeader:', { id: tl.id, name: tl.name, role: tl.role, department: tl.department });

        const emp = await Employee.findOne({ where: { email } });
        if (emp) console.log('Found in Employee:', { id: emp.id, name: emp.name, role: emp.role, department: emp.department });

        const dt = await DepartmentTeam.findOne({ where: { email } });
        if (dt) console.log('Found in DepartmentTeam:', { id: dt.id, name: dt.name, role: dt.role, department: dt.department });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

find();
