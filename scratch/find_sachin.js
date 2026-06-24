const { TeamLeader, Employee, DepartmentTeam, Admin, SuperAdmin } = require('../models/sequelizeModels');
require('dotenv').config();

async function run() {
    try {
        const email = 'recruitment.mabicons@gmail.com';
        console.log('Searching for:', email);

        const dt = await DepartmentTeam.findOne({ where: { email } });
        console.log('DepartmentTeam:', dt ? dt.toJSON() : 'Not Found');

        const tl = await TeamLeader.findOne({ where: { email } });
        console.log('TeamLeader:', tl ? tl.toJSON() : 'Not Found');

        const emp = await Employee.findOne({ where: { email } });
        console.log('Employee:', emp ? emp.toJSON() : 'Not Found');

        const adm = await Admin.findOne({ where: { email } });
        console.log('Admin:', adm ? adm.toJSON() : 'Not Found');

        const sa = await SuperAdmin.findOne({ where: { email } });
        console.log('SuperAdmin:', sa ? sa.toJSON() : 'Not Found');

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
