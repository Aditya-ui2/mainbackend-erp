const { DepartmentTeam } = require('../models/sequelizeModels');
const bcrypt = require('bcrypt');

async function run() {
    try {
        const email = 'crm@mabicons.com';
        const existing = await DepartmentTeam.findOne({ where: { email } });
        if (existing) {
            console.log('CRM user crm@mabicons.com already exists in DepartmentTeam.');
            process.exit(0);
        }

        const hashedPassword = await bcrypt.hash('Crm@123', 10);
        const newUser = await DepartmentTeam.create({
            name: 'CRM Executive',
            email: email,
            password: hashedPassword,
            role: 'crm',
            department: 'CRM',
            status: 'Active'
        });

        console.log('Successfully created CRM user:', newUser.toJSON());
    } catch (error) {
        console.error('Error creating CRM user:', error);
    }
    process.exit(0);
}

run();
