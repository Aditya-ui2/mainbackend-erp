const dotenv = require('dotenv');
dotenv.config();
const { sequelize, ResumeBank } = require('../models/sequelizeModels');

async function checkResume() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected.');

        const resume = await ResumeBank.findByPk('d67178e1-9b5f-46fc-89f8-b5c59d024d10');
        if (resume) {
            console.log('Resume found:');
            console.log(JSON.stringify(resume, null, 2));
        } else {
            console.log('Resume not found by PK.');
            // Try by sharePointId or email
            const resume2 = await ResumeBank.findOne({ where: { sharePointId: 'd67178e1-9b5f-46fc-89f8-b5c59d024d10' } });
            if (resume2) {
                console.log('Resume found by sharePointId:');
                console.log(JSON.stringify(resume2, null, 2));
            } else {
                console.log('Resume not found by sharePointId either.');
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkResume();
