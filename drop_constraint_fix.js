require('dotenv').config();
const { sequelize } = require('./models/sequelizeModels');

async function fix() {
  try {
    console.log('Attempting to drop constraint...');
    await sequelize.query('ALTER TABLE candidates DROP CONSTRAINT IF EXISTS "candidates_addedById_fkey"');
    console.log('Constraint dropped successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Failed to drop constraint:', err);
    process.exit(1);
  }
}

fix();
