const { sequelize } = require('../models/sequelizeModels');
const dotenv = require('dotenv');
dotenv.config();

async function checkHierarchy() {
    try {
        const [clients] = await sequelize.query(`SELECT id, name, email, status, "companyName" FROM "clients"`);
        console.log('--- Clients ---');
        console.log(clients);

        process.exit(0);
    } catch (err) {
        console.error('Error querying clients:', err.message);
        process.exit(1);
    }
}

checkHierarchy();
