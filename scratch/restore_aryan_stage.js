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

async function update() {
  try {
    await sequelize.authenticate();
    const result = await Candidate.update(
      { stage: 'Offer Sent' },
      { where: { id: '7fa41f2c-d925-492d-a3aa-6013194be2e4' } }
    );
    console.log('Update result:', result);
  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
}

update();
