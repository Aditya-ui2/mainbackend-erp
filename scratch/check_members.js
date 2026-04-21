require('dotenv').config();
const { DepartmentTeam, sequelize } = require('../models/sequelizeModels');

async function check() {
    try {
        await sequelize.authenticate();
        const count = await DepartmentTeam.count({ 
            where: { department: 'HR Recruitment' } 
        });
        console.log('Count for HR Recruitment:', count);
        
        const all = await DepartmentTeam.findAll({
            attributes: ['name', 'email', 'department']
        });
        console.log('All members:', JSON.stringify(all, null, 2));

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await sequelize.close();
    }
}

check();
