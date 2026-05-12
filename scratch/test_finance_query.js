const dotenv = require('dotenv');
dotenv.config();
const { sequelize, DepartmentTeam } = require('../models/sequelizeModels');

async function testQuery() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected.');

        console.log('Querying DepartmentTeam with Finance department...');
        const count = await DepartmentTeam.count({
            where: { department: 'Finance' }
        });
        console.log('Found:', count);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

testQuery();
