require('dotenv').config();
const { sequelize } = require('../models/sequelizeModels');

async function fixExistingData() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected.');

        await sequelize.query("UPDATE clients SET stage = 'Lead Stage' WHERE stage IS NULL");
        await sequelize.query("UPDATE clients SET probability = 25 WHERE probability IS NULL");
        await sequelize.query("UPDATE clients SET industry = 'General' WHERE industry IS NULL");
        
        console.log('✅ Existing data fixed.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

fixExistingData();
