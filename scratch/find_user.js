require('dotenv').config();
const { DepartmentTeam } = require('../models/sequelizeModels');

async function findUser() {
    try {
        const user = await DepartmentTeam.findOne({ where: { email: 'ashwin.mabicons@gmail.com' } });
        if (user) {
            console.log('User found in DepartmentTeam:');
            console.log(JSON.stringify(user, null, 2));
        } else {
            console.log('User NOT found in DepartmentTeam');
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
    process.exit();
}

findUser();
