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

async function addStageColumn() {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');

        // Add the ENUM type first if it doesn't exist
        await sequelize.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_clients_stage') THEN
                    CREATE TYPE "enum_clients_stage" AS ENUM('All Clients', 'Finalize', 'Generate Password');
                END IF;
            END$$;
        `);

        // Add the column if it doesn't exist
        await sequelize.query(`
            ALTER TABLE "clients" 
            ADD COLUMN IF NOT EXISTS "stage" "enum_clients_stage" DEFAULT 'All Clients';
        `);

        console.log('Column "stage" added successfully to "clients" table.');
    } catch (error) {
        console.error('Unable to add column:', error);
    } finally {
        await sequelize.close();
    }
}

addStageColumn();
