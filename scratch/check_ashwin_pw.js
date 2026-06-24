const { DepartmentTeam } = require('../models/sequelizeModels');

async function run() {
  try {
    const user = await DepartmentTeam.findOne({ where: { email: 'ashwin.mabicons@gmail.com' } });
    if (!user) {
      console.log('Ashwin not found in DepartmentTeam!');
      return;
    }
    console.log('Ashwin found in DepartmentTeam:');
    console.log('ID:', user.id);
    console.log('Name:', user.name);
    console.log('Email:', user.email);
    console.log('Role:', user.role);
    console.log('Status:', user.status);
    console.log('Password hash:', user.password);
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

run();
