require('dotenv').config();
const { getTeamMembers } = require('../controllers/departmentTeam');
const { sequelize } = require('../models/sequelizeModels');

async function test() {
    try {
        await sequelize.authenticate();
        console.log('Postgres connected.');

        // Mock Express request & response objects
        const req = {
            query: { department: 'Tech' },
            user: { id: '00000000-0000-0000-0000-000000000000', role: 'SuperAdmin' }
        };

        const res = {
            statusCode: 200,
            json(data) {
                console.log('Response status:', this.statusCode);
                console.log('Returned members:', JSON.stringify(data, null, 2));
            },
            status(code) {
                this.statusCode = code;
                return this;
            }
        };

        console.log('Calling getTeamMembers with department: Tech');
        await getTeamMembers(req, res);

    } catch (error) {
        console.error('Test error:', error);
    } finally {
        await sequelize.close();
    }
}

test();
