require('dotenv').config();
const { sequelize } = require('../models/sequelizeModels');
const { hashPassword } = require('../utils/bcryptUtils');

(async () => {
  try {
    console.log('Connecting to DB to update passwords...');
    await sequelize.authenticate();
    
    const newHash = await hashPassword('Mabicons@123');
    
    const emails = [
      'recruitment.mabicons@gmail.com',
      'operation.mabicons@gmail.com',
      'superadmin.mabicons@gmail.com',
      'admin.mabicons@gmail.com'
    ];
    
    for (const email of emails) {
      // Use double quotes for mixed-case table names, or match the exact tableName in sequelize definition
      await sequelize.query(`UPDATE "DepartmentTeams" SET password = '${newHash}' WHERE email = '${email}'`);
      await sequelize.query(`UPDATE "admins" SET password = '${newHash}' WHERE email = '${email}'`);
      await sequelize.query(`UPDATE "super_admins" SET password = '${newHash}' WHERE email = '${email}'`);
    }
    
    console.log('✅ Passwords updated to Mabicons@123 for major accounts');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error updating passwords:', err.message);
    process.exit(1);
  }
})();
