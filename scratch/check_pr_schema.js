const { sequelize } = require('../models/sequelizeModels');

async function checkPaymentRequestSchema() {
    try {
        const [results] = await sequelize.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'payment_requests'
        `);
        console.log('--- Columns in payment_requests ---');
        const colNames = results.map(r => r.column_name);
        console.log(colNames.join(', '));
    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}

checkPaymentRequestSchema();
