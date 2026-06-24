const { Lead, sequelize } = require('../models/sequelizeModels');
require('dotenv').config();

async function run() {
    try {
        await sequelize.authenticate();
        console.log('Connected to DB');
        await Lead.sync({ alter: true });
        console.log('Lead table alter sync successful!');
        process.exit(0);
    } catch (err) {
        console.error('Sync failed:', err);
        process.exit(1);
    }
}
run();
