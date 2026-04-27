require('dotenv').config();
// Fixing paths to go up one level from scripts/ directory
const { DepartmentTeam, SuperAdmin } = require('../models/sequelizeModels');
const { hashPassword } = require('../utils/bcryptUtils');

async function addAshwin() {
  try {
    const email = 'ashwin.mabicons@gmail.com';
    const hp = await hashPassword('Ashwin@123');
    
    const userData = {
      name: 'Ashwin (Manager)',
      email: email,
      password: hp,
      role: 'Super Admin',
      department: 'HR Recruitment',
      status: 'Active'
    };

    // 1. First, check if he already exists in SuperAdmin (previous manual insert attempt)
    // and remove him so he is only in DepartmentTeam
    await SuperAdmin.destroy({ where: { email } }).catch(() => {});

    // 2. Add to DepartmentTeam
    const existing = await DepartmentTeam.findOne({ where: { email } });
    
    if (existing) {
      console.log('Ashwin already exists in DepartmentTeam. Updating...');
      await existing.update(userData);
      console.log('Ashwin updated successfully.');
    } else {
      console.log('Creating Ashwin in DepartmentTeam...');
      await DepartmentTeam.create(userData);
      console.log('Ashwin created successfully.');
    }
  } catch (err) {
    console.error('Error adding Ashwin:', err);
  } finally {
    process.exit(0);
  }
}

addAshwin();
