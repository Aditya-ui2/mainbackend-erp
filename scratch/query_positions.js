// scratch/query_positions.js
const { sequelize, RecruitmentPosition } = require('../models/sequelizeModels');

async function run() {
    try {
        await sequelize.authenticate();
        console.log("Connected.");
        const positions = await RecruitmentPosition.findAll();
        console.log(`Found ${positions.length} positions:`);
        positions.forEach(p => {
            console.log("\n------------------------------------");
            console.log("ID:", p.id);
            console.log("Title:", p.title);
            console.log("Company/Client:", p.clientName || p.clientId);
            console.log("Status:", p.status);
            console.log("Department:", p.department);
        });
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
