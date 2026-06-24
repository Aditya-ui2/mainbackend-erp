const { Client, sequelize } = require('../models/sequelizeModels');

async function checkSchema() {
    try {
        const tableInfo = await sequelize.getQueryInterface().describeTable('clients');
        console.log('TABLE_COLUMNS:', JSON.stringify(Object.keys(tableInfo)));
        process.exit(0);
    } catch (error) {
        console.error('ERROR:', error);
        process.exit(1);
    }
}

checkSchema();
