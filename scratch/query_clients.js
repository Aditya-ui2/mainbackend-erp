// scratch/query_clients.js
const { sequelize, Client } = require('../models/sequelizeModels');

async function run() {
    try {
        await sequelize.authenticate();
        console.log("Connected.");
        const clients = await Client.findAll();
        console.log(`Found ${clients.length} clients:`);
        clients.forEach(c => {
            console.log("\n------------------------------------");
            console.log("ID:", c.id);
            console.log("Name:", c.name);
            console.log("Email:", c.email);
            console.log("Category/Industry:", c.category || c.industry);
            console.log("Status:", c.status);
        });
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
