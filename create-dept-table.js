require('dotenv').config();
const { sequelize } = require('./models/sequelizeModels');
const { hashPassword } = require('./utils/bcryptUtils');

(async () => {
  try {
    console.log('Connecting to:', process.env.DB_HOST);
    await sequelize.authenticate();
    console.log('Connected to DB');
    
    // Create TeamLeaders table first if it doesnt exist
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "TeamLeaders" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(255),
        "email" VARCHAR(255),
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('TeamLeaders table ensured');
    
    // Create enum types if they dont exist
    try {
      await sequelize.query(`CREATE TYPE "public"."enum_DepartmentTeams_department" AS ENUM ('HR Operations', 'HR Recruitment')`);
    } catch(e) { console.log('Enum department exists'); }
    
    try {
      await sequelize.query(`CREATE TYPE "public"."enum_DepartmentTeams_status" AS ENUM ('Active', 'Inactive', 'On Leave')`);
    } catch(e) { console.log('Enum status exists'); }
    
    // Create DepartmentTeams table  
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "DepartmentTeams" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(255) NOT NULL,
        "email" VARCHAR(255) NOT NULL UNIQUE,
        "password" VARCHAR(255) NOT NULL,
        "phone" VARCHAR(255),
        "role" VARCHAR(255) DEFAULT 'Team Member',
        "department" "public"."enum_DepartmentTeams_department" NOT NULL,
        "managerId" UUID,
        "status" "public"."enum_DepartmentTeams_status" DEFAULT 'Active',
        "avatar" VARCHAR(255),
        "skills" JSONB DEFAULT '[]',
        "joinDate" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "tasksCompleted" INTEGER DEFAULT 0,
        "tasksAssigned" INTEGER DEFAULT 0,
        "avgResponseTime" FLOAT DEFAULT 0,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('DepartmentTeams table created');
    
    // Check if users exist
    const [results] = await sequelize.query(`SELECT * FROM "DepartmentTeams" WHERE email = 'recruitment.mabicons@gmail.com'`);
    if (results.length > 0) {
      console.log('Users already exist');
      process.exit(0);
    }
    
    const hash1 = await hashPassword('Recruitment@123');
    const hash2 = await hashPassword('Operation@123');
    
    await sequelize.query(`
      INSERT INTO "DepartmentTeams" (name, email, password, department, role, status)
      VALUES ('Sachin (HR Recruitment)', 'recruitment.mabicons@gmail.com', '${hash1}', 'HR Recruitment', 'Department Head', 'Active')
    `);
    console.log('Created recruitment user');
    
    await sequelize.query(`
      INSERT INTO "DepartmentTeams" (name, email, password, department, role, status)
      VALUES ('Ramesh (HR Operations)', 'operation.mabicons@gmail.com', '${hash2}', 'HR Operations', 'Department Head', 'Active')
    `);
    console.log('Created operations user');
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
