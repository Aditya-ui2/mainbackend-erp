const dotenv = require('dotenv');
dotenv.config();
const { sequelize, SharePointCandidate } = require('../models/sequelizeModels');

async function checkSpCandidate() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected.');

        const candidate = await SharePointCandidate.findByPk('d67178e1-9b5f-46fc-89f8-b5c59d024d10');
        if (candidate) {
            console.log('SharePointCandidate found by PK:');
            console.log(JSON.stringify(candidate, null, 2));
        } else {
            console.log('SharePointCandidate not found by PK.');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkSpCandidate();
