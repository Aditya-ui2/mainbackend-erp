const { sequelize } = require('../models/sequelizeModels');
const dotenv = require('dotenv');
dotenv.config();

async function checkNotificationsSchema() {
    try {
        const [results] = await sequelize.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'notifications'");
        console.log('Columns in notifications table:', JSON.stringify(results, null, 2));
        
        // Check userType ENUM
        const [userTypeEnum] = await sequelize.query(`
            SELECT enumlabel 
            FROM pg_enum 
            JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
            WHERE typname = 'enum_notifications_userType'
        `).catch(() => [[]]);
        console.log('ENUM values for userType:', userTypeEnum.map(r => r.enumlabel));

        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

checkNotificationsSchema();
