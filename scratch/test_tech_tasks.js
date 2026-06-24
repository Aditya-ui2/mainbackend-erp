require('dotenv').config();
const { getDepartmentTasks } = require('../controllers/departmentTeam');
const { sequelize } = require('../models/sequelizeModels');

async function test() {
    try {
        await sequelize.authenticate();
        console.log('Postgres connected.');

        // Mock Express request & response objects
        const req = {
            query: { department: 'Tech' },
            user: { id: '17fd18b2-1634-4e43-a30e-fbda8bce1233', role: 'tech' } // Tech User ID and role
        };

        const res = {
            statusCode: 200,
            json(data) {
                console.log('Response status:', this.statusCode);
                console.log('Returned tasks:', JSON.stringify(data, null, 2));
            },
            status(code) {
                this.statusCode = code;
                return this;
            }
        };

        console.log('Calling getDepartmentTasks with department: Tech');
        await getDepartmentTasks(req, res);

    } catch (error) {
        console.error('Test error:', error);
    } finally {
        await sequelize.close();
    }
}

test();
