const { SuperAdmin, TeamLeader, Employee } = require('../models/sequelizeModels');
const dotenv = require('dotenv');
dotenv.config();

async function testHierarchy() {
    try {
        const adminId = '3624251a-6e4b-4600-9d83-dbbfbfce67a1';
        console.log('Searching for SuperAdmin with ID:', adminId);
        const superAdmin = await SuperAdmin.findByPk(adminId);
        console.log('SuperAdmin found:', superAdmin ? superAdmin.toJSON() : 'Not Found');
        
        if (superAdmin) {
            console.log('Fetching all team leaders...');
            let allTeamLeaders = await TeamLeader.findAll({
                attributes: ['id', 'name', 'email', 'phone', 'department', 'status'],
                include: [{
                    model: Employee,
                    as: 'employees',
                    attributes: [
                        'id', 'name', 'email', 'plainPassword', 'phone', 'status',
                        'basicSalary', 'leaveBalance', 'bankAccount', 'pfNumber', 'uanNumber'
                    ]
                }]
            });
            console.log('Found team leaders count:', allTeamLeaders.length);
        }
        process.exit(0);
    } catch (err) {
        console.error('Error running test:', err);
        process.exit(1);
    }
}

testHierarchy();
