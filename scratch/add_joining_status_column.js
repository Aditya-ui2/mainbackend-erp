require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: console.log,
    dialectOptions: {
      ssl: process.env.DB_SSL === 'false' ? false : {
        require: true,
        rejectUnauthorized: false
      }
    }
  }
);

async function migrate() {
  try {
    console.log("Starting migration to add joiningStatus column to candidates...");
    await sequelize.query(`
      ALTER TABLE "candidates" 
      ADD COLUMN IF NOT EXISTS "joiningStatus" VARCHAR(255) DEFAULT 'Pending';
    `);
    console.log("Added joiningStatus column successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

migrate();
