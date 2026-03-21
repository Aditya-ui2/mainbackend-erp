require('dotenv').config();
const { sequelize, ResumeBank } = require('./models/sequelizeModels');

(async () => {
  try {
    console.log('Connecting to:', process.env.DB_HOST);
    await sequelize.authenticate();
    console.log('Connected to DB');
    
    // Create enum types if they don't exist
    try {
      await sequelize.query(`CREATE TYPE "public"."enum_ResumeBanks_fileType" AS ENUM ('pdf', 'doc', 'docx')`);
      console.log('Created fileType enum');
    } catch(e) { console.log('fileType enum exists'); }
    
    try {
      await sequelize.query(`CREATE TYPE "public"."enum_ResumeBanks_status" AS ENUM ('Available', 'Shortlisted', 'Contacted', 'Interview Scheduled', 'Hired', 'Rejected', 'Not Interested')`);
      console.log('Created status enum');
    } catch(e) { console.log('status enum exists'); }
    
    // Sync the model
    await ResumeBank.sync({ alter: true });
    console.log('ResumeBanks table created/updated');
    
    // Check table
    const count = await ResumeBank.count();
    console.log(`Current resume count: ${count}`);
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
