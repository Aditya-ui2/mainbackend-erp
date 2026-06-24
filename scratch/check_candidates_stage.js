require('dotenv').config();
const { Sequelize, Op } = require('sequelize');

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

async function check() {
  try {
    await sequelize.authenticate();
    console.log('Postgres Connected.');

    // Count all candidates
    const count = await Candidate.count();
    console.log('Total Candidates in DB:', count);

    // Count by stage
    const stages = await Candidate.findAll({
      attributes: ['stage', [Sequelize.fn('COUNT', Sequelize.col('stage')), 'count']],
      group: ['stage'],
      raw: true
    });
    console.log('Candidates by stage:', stages);

    // Count by status
    const statuses = await Candidate.findAll({
      attributes: ['status', [Sequelize.fn('COUNT', Sequelize.col('status')), 'count']],
      group: ['status'],
      raw: true
    });
    console.log('Candidates by status:', statuses);

    // Get any candidate with stage='Joined' or status='Selected'
    const joinedCandidates = await Candidate.findAll({
      where: {
        [Op.or]: [
          { stage: 'Joined' },
          { status: 'Joined' }
        ]
      },
      limit: 10,
      raw: true
    });
    console.log('Candidates with stage/status = Joined (limit 10):', joinedCandidates);

  } catch (err) {
    console.error('Check failed:', err);
  } finally {
    await sequelize.close();
  }
}

check();
