const { sequelize } = require('../models/sequelizeModels');

async function fixTypes() {
  try {
    console.log('Altering tables to fix type mismatches...');
    
    // Convert character varying columns to uuid using proper casting
    await sequelize.query('ALTER TABLE candidates ALTER COLUMN "addedById" TYPE uuid USING "addedById"::uuid');
    console.log('Converted candidates.addedById to uuid');
    
    await sequelize.query('ALTER TABLE interviews ALTER COLUMN "interviewerId" TYPE uuid USING "interviewerId"::uuid');
    console.log('Converted interviews.interviewerId to uuid');

    await sequelize.query('ALTER TABLE "DepartmentTasks" ALTER COLUMN "assignedBy" TYPE uuid USING "assignedBy"::uuid');
    await sequelize.query('ALTER TABLE "DepartmentTasks" ALTER COLUMN "assignedTo" TYPE uuid USING "assignedTo"::uuid');
    console.log('Converted DepartmentTasks columns to uuid');

    // Also check if clientId in candidates/interviews should be uuid if clients.id was uuid?
    // But check_db_types said clients.id is character varying. So we leave it as varying for now.
    
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

fixTypes();
