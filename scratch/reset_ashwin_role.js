require('dotenv').config();
const { DepartmentTeam, SuperAdmin } = require('../models/sequelizeModels');

async function resetAshwinRole() {
  try {
    const email = 'ashwin.mabicons@gmail.com';
    
    // 1. Double check and remove any legacy SuperAdmin record
    await SuperAdmin.destroy({ where: { email } }).catch(() => {});
    
    // 2. Find and update DepartmentTeam record
    const member = await DepartmentTeam.findOne({ where: { email } });
    if (member) {
      await member.update({
        role: 'Manager',
        department: 'CRM'
      });
      console.log('✅ Ashwin updated in DepartmentTeam table: Role = Manager, Department = CRM');
    } else {
      console.log('❌ Ashwin not found in DepartmentTeam table');
    }
  } catch (err) {
    console.error('❌ Error updating Ashwin:', err);
  } finally {
    process.exit(0);
  }
}

resetAshwinRole();
