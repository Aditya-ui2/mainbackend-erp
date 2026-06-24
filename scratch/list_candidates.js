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
    logging: false,
    dialectOptions: {
      ssl: process.env.DB_SSL === 'false' ? false : {
        require: true,
        rejectUnauthorized: false
      }
    }
  }
);

// Define candidate mock schema for this check
const Candidate = sequelize.define('Candidate', {
  id: { type: Sequelize.STRING, primaryKey: true },
  name: Sequelize.STRING,
  stage: Sequelize.STRING,
  status: Sequelize.STRING,
  joiningDate: Sequelize.DATEONLY
}, {
  tableName: 'candidates',
  timestamps: true
});

async function list() {
  try {
    await sequelize.authenticate();
    const candidates = await Candidate.findAll({ raw: true });
    console.log('--- CANDIDATE LIST ---');
    candidates.forEach(c => {
      console.log(`ID: ${c.id} | Name: ${c.name} | Stage: ${c.stage} | Status: ${c.status} | Joining Date: ${c.joiningDate}`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
}

list();
