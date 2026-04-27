const { sequelize } = require('./models/sequelizeModels');
const dotenv = require('dotenv');
dotenv.config();

async function checkSchema() {
    try {
        const [results] = await sequelize.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'clients'");
        console.log('Columns in clients table:', results.map(r => r.column_name).join(', '));
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

checkSchema();
