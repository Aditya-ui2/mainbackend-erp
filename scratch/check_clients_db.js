const { sequelize } = require('../models/sequelizeModels');

async function run() {
  try {
    const [results] = await sequelize.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'clients'
    `);
    console.log('Clients columns:', results);
  } catch (error) {
    console.error('Error querying schema:', error);
  } finally {
    process.exit(0);
  }
}

run();
