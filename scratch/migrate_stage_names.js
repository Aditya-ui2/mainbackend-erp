const { Sequelize } = require('sequelize');
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

async function renameStages() {
    try {
        await sequelize.authenticate();
        console.log('Connected to database.');

        // 1. Rename 'Finalize' to 'Lead Stage' (old Finalize is new Lead Stage)
        const [updated1] = await sequelize.query(`
            UPDATE clients 
            SET stage = 'Lead Stage', probability = 25
            WHERE stage = 'Finalize';
        `);
        console.log(`Updated clients from 'Finalize' to 'Lead Stage'.`);

        // 2. Rename 'Generate Password' to 'Finalize' (old Generate Password is new Finalize)
        const [updated2] = await sequelize.query(`
            UPDATE clients 
            SET stage = 'Finalize', probability = 50
            WHERE stage = 'Generate Password';
        `);
        console.log(`Updated clients from 'Generate Password' to 'Finalize'.`);

    } catch (error) {
        console.error('Failed to rename stages:', error);
    } finally {
        await sequelize.close();
    }
}

renameStages();
