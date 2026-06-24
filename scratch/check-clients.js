require('dotenv').config();
const { Client } = require('../models/sequelizeModels');

(async () => {
    try {
        console.log('Fetching all clients...');
        const clients = await Client.findAll({
            attributes: ['id', 'name', 'email', 'companyName', 'status']
        });
        console.log('Total clients found:', clients.length);
        console.log(JSON.stringify(clients, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
})();
