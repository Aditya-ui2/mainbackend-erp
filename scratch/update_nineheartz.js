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

async function updateNineheartz() {
    try {
        await sequelize.authenticate();
        const result = await Client.update(
            { status: 'Accepted', stage: 'All Clients', probability: 100 },
            { where: { companyName: 'Nineheartz' } }
        );
        console.log('Update result:', result);
    } catch (error) {
        console.error('Update failed:', error);
    } finally {
        await sequelize.close();
    }
}

updateNineheartz();
