require('dotenv').config();
const { sequelize } = require('../models/sequelizeModels');
const seedSuperAdmin = require('../db/seedSuperAdmin');

async function run() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');
    await seedSuperAdmin();
    console.log('Manual seeding completed.');
  } catch (error) {
    console.error('Error during manual seeding:', error);
  } finally {
    await sequelize.close();
  }
}
run();
