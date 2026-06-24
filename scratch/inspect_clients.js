const { Client } = require('../models/sequelizeModels');

async function run() {
    try {
        const clients = await Client.findAll();
        console.log(`--- Total clients in DB: ${clients.length} ---`);
        clients.forEach(c => {
            console.log(`Client: ID=${c.id}, CompanyName=${c.companyName}, Email=${c.email}, Status=${c.status}, Stage=${c.stage}`);
        });
    } catch (error) {
        console.error('Error querying clients:', error);
    }
    process.exit(0);
}

run();
