const dotenv = require('dotenv');
dotenv.config();
const { sequelize, Candidate } = require('../models/sequelizeModels');

async function checkCandidate() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected.');

        const candidate = await Candidate.findByPk('d67178e1-9b5f-46fc-89f8-b5c59d024d10');
        if (candidate) {
            console.log('Candidate found:');
            console.log(JSON.stringify(candidate, null, 2));
        } else {
            console.log('Candidate not found.');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkCandidate();
