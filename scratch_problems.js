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
        logging: false
    }
);

async function check() {
    try {
        const [results] = await sequelize.query('SELECT * FROM "problems"');
        console.log("Problems in database:", JSON.stringify(results, null, 2));
    } catch (e) {
        console.error("Error querying Problems:", e);
    } finally {
        await sequelize.close();
    }
}

check();
