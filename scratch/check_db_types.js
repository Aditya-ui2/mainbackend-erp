const { sequelize } = require('../models/sequelizeModels');

async function checkTypes() {
  try {
    const [results] = await sequelize.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('clients', 'recruitment_positions', 'candidates', 'interviews', 'DailyReports', 'DepartmentTeams', 'team_leaders', 'DepartmentTasks')
      AND column_name IN ('id', 'clientId', 'memberId', 'addedById', 'assignedTo', 'assignedBy', 'departmentTeamId', 'teamLeaderId', 'interviewerId')
      ORDER BY table_name, column_name;
    `);
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkTypes();
