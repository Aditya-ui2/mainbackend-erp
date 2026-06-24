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

async function renameStage() {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');

        // 1. Add the new ENUM value
        await sequelize.query(`
            ALTER TYPE "enum_clients_stage" ADD VALUE IF NOT EXISTS 'Onboarding Complete';
        `);

        // 2. Update existing rows
        await sequelize.query(`
            UPDATE "clients" SET "stage" = 'Onboarding Complete' WHERE "stage" = 'All Clients';
        `);

        console.log('Stage renamed from "All Clients" to "Onboarding Complete" in the database.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await sequelize.close();
    }
}

renameStage();
