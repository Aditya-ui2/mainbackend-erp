require('dotenv').config();
const { Client, sequelize } = require('../models/sequelizeModels');

async function run() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');
    const clients = await Client.findAll();
    console.log('Clients count:', clients.length);
    console.log(JSON.stringify(clients.map(c => ({ id: c.id, name: c.name, companyName: c.companyName })), null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}
run();
