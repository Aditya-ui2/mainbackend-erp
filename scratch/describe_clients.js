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

async function describeTable() {
    try {
        await sequelize.authenticate();
        const [results] = await sequelize.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'clients';
        `);
        console.log('Columns in "clients" table:');
        results.forEach(row => {
            console.log(`- ${row.column_name} (${row.data_type})`);
        });
    } catch (error) {
        console.error('Failed to describe table:', error);
    } finally {
        await sequelize.close();
    }
}

describeTable();
