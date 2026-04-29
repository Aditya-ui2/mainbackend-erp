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
        }
    }
);

async function addProbabilityColumn() {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');

        // Add the column if it doesn't exist
        await sequelize.query(`
            ALTER TABLE "clients" 
            ADD COLUMN IF NOT EXISTS "probability" INTEGER DEFAULT 25;
        `);

        console.log('Column "probability" added successfully to "clients" table.');
    } catch (error) {
        console.error('Unable to add column:', error);
    } finally {
        await sequelize.close();
    }
}

addProbabilityColumn();
