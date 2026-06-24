const { TeamLeader, Employee, DepartmentTeam, Admin, SuperAdmin } = require('../models/sequelizeModels');
const { Op } = require('sequelize');
require('dotenv').config();

async function run() {
    try {
        const models = { SuperAdmin, Admin, TeamLeader, Employee, DepartmentTeam };
        for (const [name, Model] of Object.entries(models)) {
            const attributes = Object.keys(Model.rawAttributes);
            const orConditions = [];
            if (attributes.includes('email')) {
                orConditions.push({ email: { [Op.iLike]: '%sales%' } });
            }
            if (attributes.includes('name')) {
                orConditions.push({ name: { [Op.iLike]: '%sales%' } });
            }
            if (attributes.includes('role')) {
                orConditions.push({ role: { [Op.iLike]: '%sales%' } });
            }
            if (attributes.includes('department')) {
                orConditions.push({ department: { [Op.iLike]: '%sales%' } });
            }

            if (orConditions.length === 0) continue;

            const users = await Model.findAll({
                where: {
                    [Op.or]: orConditions
                }
            });
            if (users.length > 0) {
                console.log(`Found ${users.length} users in ${name}:`);
                users.forEach(u => {
                    console.log({ id: u.id, name: u.name, email: u.email, role: u.role || u.userType || '', department: u.department || '' });
                });
            }
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
