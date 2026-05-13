const { sequelize } = require('../models/sequelizeModels');
const dotenv = require('dotenv');
dotenv.config();

async function fixDailyReportsSchema() {
    try {
        console.log('Adding attachmentUrl and attachmentName to DailyReports table...');
        
        await sequelize.query('ALTER TABLE "DailyReports" ADD COLUMN IF NOT EXISTS "attachmentUrl" VARCHAR(255)');
        await sequelize.query('ALTER TABLE "DailyReports" ADD COLUMN IF NOT EXISTS "attachmentName" VARCHAR(255)');
        
        console.log('Columns added successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

fixDailyReportsSchema();
