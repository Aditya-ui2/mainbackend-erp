const { Sequelize, DataTypes } = require('sequelize');
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

const Client = sequelize.define('Client', {
    companyName: DataTypes.STRING,
    status: DataTypes.STRING,
    stage: DataTypes.STRING,
    probability: DataTypes.INTEGER
}, { tableName: 'clients', timestamps: false });

async function checkClients() {
    try {
        await sequelize.authenticate();
        const clients = await Client.findAll({
            where: { companyName: ['Nineheartz', 'mabicons'] }
        });
        console.log(JSON.stringify(clients, null, 2));
    } catch (error) {
        console.error('Failed:', error);
    } finally {
        await sequelize.close();
    }
}

checkClients();
