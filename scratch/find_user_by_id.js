require('dotenv').config();
const { Admin, SuperAdmin, TeamLeader, Employee, DepartmentTeam, sequelize } = require('../models/sequelizeModels');

async function find() {
    const id = '123e4567-e89b-12d3-a456-426614174000';
    try {
        await sequelize.authenticate();
        
        let found = await Admin.findByPk(id);
        if (found) { console.log('Found in Admin:', found.toJSON()); return; }
        
        found = await SuperAdmin.findByPk(id);
        if (found) { console.log('Found in SuperAdmin:', found.toJSON()); return; }

        found = await TeamLeader.findByPk(id);
        if (found) { console.log('Found in TeamLeader:', found.toJSON()); return; }

        found = await Employee.findByPk(id);
        if (found) { console.log('Found in Employee:', found.toJSON()); return; }

        found = await DepartmentTeam.findByPk(id);
        if (found) { console.log('Found in DepartmentTeam:', found.toJSON()); return; }

        console.log('ID not found in any user table');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sequelize.close();
    }
}

find();
