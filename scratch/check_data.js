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

async function checkData() {
    try {
        await sequelize.authenticate();
        const [results] = await sequelize.query(`
            SELECT "companyName", "status", "stage", "probability"
            FROM clients
            WHERE "companyName" IN ('HappyGot', 'mabicons', 'Nineheartz');
        `);
        console.table(results);
    } catch (error) {
        console.error('Failed:', error);
    } finally {
        await sequelize.close();
    }
}

checkData();
