const { sequelize, Employee, DepartmentTeam, TeamLeader } = require('../models/sequelizeModels');
const employeeController = require('../controllers/employee');

async function testCreateEmployeeEndpoint() {
    try {
        console.log('--- Testing createEmployee Controller directly ---');

        // Let's fetch Ashwin's ID
        const ashwin = await DepartmentTeam.findOne({ where: { email: 'ashwin.mabicons@gmail.com' } });
        if (!ashwin) {
            throw new Error('Ashwin not found in DB!');
        }
        console.log('Ashwin found: ID =', ashwin.id);

        const req = {
            body: {
                name: 'Aryan Rawat Test',
                email: 'aryan_rawat_test@gmail.com',
                phone: '9163788650',
                teamLeaderIds: ['mock_crm'],
                department: 'Sales',
                role: 'sales_kam',
                bankAccount: '',
                pfNumber: '',
                uanNumber: '',
                basicSalary: '18000',
                leaveBalance: '2'
            },
            user: {
                id: '3624251a-6e4b-4600-9d83-dbbfbfce67a1', // Ashish's ID (SuperAdmin)
                role: 'SuperAdmin'
            }
        };

        const res = {
            statusCode: 200,
            status: function(code) {
                this.statusCode = code;
                return this;
            },
            json: function(data) {
                console.log('Response JSON:', data);
                return this;
            }
        };

        await employeeController.createEmployee(req, res);
        console.log('Status code returned:', res.statusCode);
        
        // Clean up the created employee if it succeeded
        if (res.statusCode === 201) {
            await Employee.destroy({ where: { email: req.body.email } });
            console.log('Test employee cleaned up.');
        }

    } catch (err) {
        console.error('Error running test:', err);
    } finally {
        process.exit(0);
    }
}

testCreateEmployeeEndpoint();
