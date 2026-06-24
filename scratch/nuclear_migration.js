const { sequelize } = require('../models/sequelizeModels');

async function nuclearMigration() {
  console.log('--- STARTING NUCLEAR SCHEMA CONVERSION (VARCHAR) ---');
  
  const tables = [
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
    { table: 'DepartmentTasks', column: 'assignedTo' },
    { table: 'ResumeBanks', column: 'id' },
    { table: 'ResumeBanks', column: 'candidateId' },
    { table: 'ResumeBanks', column: 'assignedPositionId' }
  ];

  try {
    // 1. Get all foreign key constraints in the database
    const [constraints] = await sequelize.query(`
      SELECT 
        tc.table_name, 
        tc.constraint_name
      FROM 
        information_schema.table_constraints AS tc 
      WHERE 
        tc.constraint_type = 'FOREIGN KEY';
    `);

    console.log(`Found ${constraints.length} foreign key constraints.`);

    // 2. Drop all foreign key constraints
    for (const c of constraints) {
      try {
        await sequelize.query(`ALTER TABLE "${c.table_name}" DROP CONSTRAINT "${c.constraint_name}" CASCADE`);
        console.log(`Dropped constraint ${c.constraint_name} on ${c.table_name}`);
      } catch (e) {
        console.warn(`Could not drop ${c.constraint_name}: ${e.message}`);
      }
    }

    // 3. Convert all columns to character varying
    for (const item of tables) {
      try {
        console.log(`Converting ${item.table}.${item.column} to VARCHAR...`);
        await sequelize.query(`ALTER TABLE "${item.table}" ALTER COLUMN "${item.column}" TYPE character varying USING "${item.column}"::character varying`);
        console.log(`SUCCESS: ${item.table}.${item.column}`);
      } catch (err) {
        console.warn(`FAILED: ${item.table}.${item.column} - ${err.message}`);
      }
    }

    console.log('--- NUCLEAR SCHEMA CONVERSION COMPLETED ---');
    process.exit(0);
  } catch (err) {
    console.error('--- CRITICAL FAILURE IN NUCLEAR MIGRATION ---', err);
    process.exit(1);
  }
}

nuclearMigration();
