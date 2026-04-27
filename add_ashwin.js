require('dotenv').config();
const { SuperAdmin } = require('./models/sequelizeModels');
const { hashPassword } = require('./utils/bcryptUtils');

async function addAshwin() {
  try {
    const existing = await SuperAdmin.findOne({ where: { email: 'ashwin.mabicons@gmail.com' } });
    if (existing) {
      console.log('Ashwin already exists! Updating password...');
      const hp = await hashPassword('Ashwin@123');
      await existing.update({ password: hp, name: 'Ashwin (Super Admin)' });
      console.log('Ashwin updated.');
    } else {
      console.log('Creating Ashwin...');
      const hp = await hashPassword('Ashwin@123');
      await SuperAdmin.create({
        name: 'Ashwin (Super Admin)',
        email: 'ashwin.mabicons@gmail.com',
        password: hp
      });
      console.log('Ashwin created successfully.');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

addAshwin();
