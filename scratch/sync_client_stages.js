const { Sequelize, Op } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        dialectOptions: {
            ssl: process.env.DB_SSL === 'false' ? false : {
                require: true,
                rejectUnauthorized: false
            }
        },
        logging: false
    }
);

async function fixClientStages() {
    try {
        await sequelize.authenticate();
        console.log('Connected to database.');

        // Update clients where status is Requested to have stage Finalize
        const [updatedCount] = await sequelize.query(`
            UPDATE clients 
            SET stage = 'Finalize', probability = 25
            WHERE status = 'Requested';
        `);
        
        console.log(`Updated ${updatedCount?.rowCount || updatedCount} clients to 'Finalize' stage.`);

        // Update clients where status is Accepted to have stage Onboarding Complete
        const [updatedCount2] = await sequelize.query(`
            UPDATE clients 
            SET stage = 'Onboarding Complete', probability = 100
            WHERE status = 'Accepted';
        `);

        console.log(`Updated ${updatedCount2?.rowCount || updatedCount2} clients to 'Onboarding Complete' stage.`);

    } catch (error) {
        console.error('Failed to fix client stages:', error);
    } finally {
        await sequelize.close();
    }
}

fixClientStages();
