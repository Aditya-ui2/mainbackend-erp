const { sequelize } = require('../models/sequelizeModels');

async function masterMigration() {
  const tasks = [
    { table: 'DepartmentTeams', column: 'id' },
    { table: 'team_leaders', column: 'id' },
    { table: 'candidates', column: 'id' },
    { table: 'candidates', column: 'addedById' },
    { table: 'candidates', column: 'clientId' },
    { table: 'candidates', column: 'positionId' },
    { table: 'candidates', column: 'teamLeaderId' },
    { table: 'interviews', column: 'id' },
    { table: 'interviews', column: 'interviewerId' },
    { table: 'interviews', column: 'clientId' },
    { table: 'interviews', column: 'positionId' },
    { table: 'interviews', column: 'candidateId' },
    { table: 'recruitment_positions', column: 'id' },
    { table: 'recruitment_positions', column: 'clientId' },
    { table: 'recruitment_positions', column: 'departmentTeamId' },
    { table: 'recruitment_positions', column: 'teamLeaderId' },
    { table: 'recruitment_positions', column: 'assignedToId' },
    { table: 'clients', column: 'id' },
    { table: 'clients', column: 'teamLeaderId' },
    { table: 'DailyReports', column: 'id' },
    { table: 'DailyReports', column: 'memberId' },
    { table: 'DepartmentTasks', column: 'id' },
    { table: 'DepartmentTasks', column: 'assignedBy' },
    { table: 'DepartmentTasks', column: 'assignedTo' }
  ];

  try {
    console.log('Starting Master Migration to VARCHAR...');
    for (const item of tasks) {
      try {
        console.log(`Converting ${item.table}.${item.column}...`);
        // We use a multi-step approach: 
        // 1. Drop constraints if needed (but we'll try simple conversion first)
        // 2. Convert to character varying
        await sequelize.query(`ALTER TABLE "${item.table}" ALTER COLUMN "${item.column}" TYPE character varying USING "${item.column}"::character varying`);
        console.log(`SUCCESS: ${item.table}.${item.column}`);
      } catch (err) {
        console.warn(`FAILED: ${item.table}.${item.column} - ${err.message}`);
      }
    }
    console.log('Master Migration Completed!');
    process.exit(0);
  } catch (err) {
    console.error('CRITICAL FAILURE:', err);
    process.exit(1);
  }
}

masterMigration();
