require('dotenv').config();
const { Client } = require('pg');

async function fix() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('Connecting to database directly...');
    await client.connect();
    console.log('Dropping candidates_addedById_fkey constraint...');
    await client.query('ALTER TABLE candidates DROP CONSTRAINT IF EXISTS "candidates_addedById_fkey"');
    console.log('Constraint dropped successfully!');
  } catch (err) {
    console.error('Failed to fix database:', err);
  } finally {
    await client.end();
  }
}

fix();
