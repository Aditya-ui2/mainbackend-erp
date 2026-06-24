const { DepartmentTeam } = require('../models/sequelizeModels');
const { hashPassword } = require('../utils/bcryptUtils');

async function run() {
  try {
    const email = 'ashwin.mabicons@gmail.com';
    const newPasswordText = 'NJV5ASUP';
    const hp = await hashPassword(newPasswordText);
    
    const user = await DepartmentTeam.findOne({ where: { email } });
    if (!user) {
      console.log('Ashwin not found in DepartmentTeam!');
      return;
    }
    
    await user.update({ password: hp });
    console.log(`Successfully reset Ashwin's password in DB to: "${newPasswordText}"`);
    console.log('New hash stored:', hp);
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

run();
